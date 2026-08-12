import mimetypes

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import FileResponse, Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wallet import services as wallet_services

from .access import can_view, marketplace_queryset, preference_matches
from .generation import start_generation
from .models import (
    GenerationJob,
    Presentation,
    PresentationPurchase,
    PresentationView,
    Slide,
)
from .serializers import (
    GenerationJobSerializer,
    GenerationRequestSerializer,
    PresentationDetailSerializer,
    PresentationListSerializer,
)
from .signing import verify


def _personalized_queryset(user):
    """The marketplace catalog scoped to the caller's subject+grade
    preferences: free official decks + listed teacher decks. See
    `apps.presentations.access.marketplace_queryset`."""
    return marketplace_queryset(user)


class PresentationListView(generics.ListAPIView):
    """Only presentations matching the caller's (subject, grade) preferences.

    The `subject`/`grade` query filters narrow *within* that allowed set —
    there is deliberately no way to page past personalization, since the
    catalog (titles, covers) is itself scoped content.
    """

    serializer_class = PresentationListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("subject", "grade")
    search_fields = ("title", "description")
    ordering_fields = ("created_at", "view_count")
    ordering = ("-created_at",)

    def get_queryset(self):
        return _personalized_queryset(self.request.user)


class RecommendedPresentationsView(generics.ListAPIView):
    """Top picks for the dashboard 'Siz uchun mos taqdimotlar' section."""

    serializer_class = PresentationListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return _personalized_queryset(self.request.user).order_by(
            "-view_count", "-created_at"
        )[:8]


class PresentationDetailView(generics.RetrieveAPIView):
    """Returns presentation metadata + signed slide URLs.

    Marketplace-aware access:
    - Official deck without a matching preference -> 403 (not this teacher's
      content at all).
    - Unlisted teacher deck the caller doesn't own -> 404 (don't reveal it).
    - Listed teacher deck the caller hasn't bought -> 200 but **locked**:
      metadata only, `is_locked=true`, no slides. Drives the buy screen.
    - Owned / authored / official-with-match / admin -> full deck with slides.

    Only a real (unlocked) view bumps view_count.
    """

    serializer_class = PresentationDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Presentation.objects.filter(is_published=True).select_related(
            "subject", "grade", "author"
        ).prefetch_related("slides")

    def retrieve(self, request, *args, **kwargs):
        presentation = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
        user = request.user

        # Hide unlisted teacher decks from everyone but the author/admin.
        if (
            not presentation.is_official
            and presentation.author_id != user.id
            and not user.can_admin
            and not presentation.is_listed
        ):
            raise Http404

        viewable = can_view(user, presentation)
        if not viewable:
            # Official (no preference match) or a listed deck outside the
            # teacher's subjects: not purchasable, so deny outright.
            if presentation.is_official or (
                not user.can_admin
                and not preference_matches(user, presentation)
            ):
                self.permission_denied(
                    request,
                    message="Bu taqdimot sizning fan/sinfingizga mos emas.",
                )

        locked = not viewable
        if not locked:
            Presentation.objects.filter(pk=presentation.pk).update(
                view_count=F("view_count") + 1
            )
            PresentationView.objects.create(
                user=user, presentation=presentation
            )
            presentation.refresh_from_db(fields=("view_count",))

        serializer = self.get_serializer(presentation)
        serializer.context["locked"] = locked
        return Response(serializer.data)


class MyPresentationsView(generics.ListAPIView):
    """Decks the caller authored — any status (generating, published) and
    both listed + unlisted. Not preference-scoped: it's your own content."""

    serializer_class = PresentationListSerializer

    def get_queryset(self):
        return Presentation.objects.filter(
            author=self.request.user
        ).select_related("subject", "grade", "author")


class MyPurchasedPresentationsView(generics.ListAPIView):
    """Decks the caller has bought."""

    serializer_class = PresentationListSerializer

    def get_queryset(self):
        return (
            Presentation.objects.filter(purchases__buyer=self.request.user)
            .select_related("subject", "grade", "author")
            .distinct()
        )


class PurchasePresentationView(APIView):
    """Buy a listed teacher deck. Idempotent — re-buying a deck you already
    own returns 200 without charging again. The wallet transfer and the
    access-grant row are written in one atomic transaction, so a failure on
    either side charges nothing."""

    def post(self, request, pk: int):
        presentation = get_object_or_404(
            Presentation.objects.filter(is_published=True).select_related("author"),
            pk=pk,
        )

        if presentation.is_official:
            return Response(
                {"detail": "Bu taqdimot bepul, sotib olish shart emas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if presentation.author_id == request.user.id:
            return Response(
                {"detail": "O'z taqdimotingizni sotib ololmaysiz."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not presentation.is_listed:
            return Response(
                {"detail": "Bu taqdimot sotuvda emas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Same scoping as the catalog — you can only buy within your subjects.
        if not request.user.can_admin and not preference_matches(
            request.user, presentation
        ):
            return Response(
                {"detail": "Bu taqdimot sizning fan/sinfingizga mos emas."},
                status=status.HTTP_403_FORBIDDEN,
            )

        price = presentation.price
        commission = price * settings.MARKETPLACE_COMMISSION_PERCENT // 100

        try:
            with transaction.atomic():
                # Claim the unique (buyer, presentation) slot first; the DB
                # constraint makes concurrent double-buys collapse to one.
                purchase, created = PresentationPurchase.objects.get_or_create(
                    buyer=request.user,
                    presentation=presentation,
                    defaults={"price_paid": price, "commission": commission},
                )
                if not created:
                    return Response(
                        {"detail": "Bu taqdimot sizda allaqachon bor.", "owned": True}
                    )
                wallet_services.purchase(
                    request.user,
                    presentation.author,
                    price,
                    commission=commission,
                    presentation=presentation,
                    note=f"'{presentation.title}' sotib olindi",
                )
        except wallet_services.InsufficientFunds:
            return Response(
                {"detail": "Balans yetarli emas. Hisobingizni to'ldiring."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except wallet_services.WalletError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )
        except IntegrityError:
            return Response(
                {"detail": "Bu taqdimot sizda allaqachon bor.", "owned": True}
            )

        balance = wallet_services.get_or_create_wallet(request.user).balance
        return Response(
            {"owned": True, "price_paid": price, "balance": balance},
            status=status.HTTP_201_CREATED,
        )


class GeneratePresentationView(APIView):
    """Kick off deck generation. Validates the request, ensures the caller
    owns the (subject, grade) as a preference, then charges + queues the job.
    Returns the pending job for the frontend to poll."""

    def post(self, request):
        serializer = GenerationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        subject = data["subject"]
        grade = data["grade"]
        # Same scoping as everything else: teachers generate within their own
        # subjects/grades. Admins may generate anything.
        if not request.user.can_admin:
            matches = request.user.preferences.filter(
                subject=subject, grade=grade
            ).exists()
            if not matches:
                return Response(
                    {"detail": "Bu fan/sinf sizning sozlamalaringizda yo'q."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        price = data.get("price")
        if price is None:
            price = settings.PRESENTATION_DEFAULT_PRICE

        try:
            job = start_generation(
                user=request.user,
                subject=subject,
                grade=grade,
                topic=data["topic"],
                num_slides=data["num_slides"],
                quarter=data.get("quarter"),
                price=price,
                is_listed=data["is_listed"],
            )
        except wallet_services.InsufficientFunds:
            return Response(
                {
                    "detail": (
                        "Balans yetarli emas. Generatsiya narxi: "
                        f"{settings.PRESENTATION_GENERATION_PRICE} so'm."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except wallet_services.WalletError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            GenerationJobSerializer(job).data, status=status.HTTP_202_ACCEPTED
        )


class GenerationJobListView(generics.ListAPIView):
    """The caller's own generation jobs, newest first."""

    serializer_class = GenerationJobSerializer

    def get_queryset(self):
        return GenerationJob.objects.filter(user=self.request.user)


class GenerationJobDetailView(generics.RetrieveAPIView):
    """Poll a single job's status."""

    serializer_class = GenerationJobSerializer

    def get_queryset(self):
        return GenerationJob.objects.filter(user=self.request.user)


class SlideRawView(generics.GenericAPIView):
    """Streams the slide image bytes, gated by HMAC signature.

    The token binds slide_id + user_id + expiry, so a leaked URL stops working
    in minutes and can't be used by another logged-in user.
    """

    permission_classes = [AllowAny]  # auth is via signature, not session
    throttle_scope = "slide_url"

    def get(self, request, slide_id: int):
        try:
            user_id = int(request.query_params.get("u", ""))
            expires_at = int(request.query_params.get("exp", ""))
        except (TypeError, ValueError):
            raise Http404
        signature = request.query_params.get("sig", "")
        if not signature or not verify(slide_id, user_id, expires_at, signature):
            raise Http404

        slide = get_object_or_404(Slide, id=slide_id)

        # Fast path — offload the actual byte transfer to S3/R2 via a 302
        # to a presigned URL. Only enable when SLIDE_SERVE_MODE=redirect and
        # the storage endpoint is browser-reachable (see settings).
        if settings.SLIDE_SERVE_MODE == "redirect":
            try:
                target = slide.image.url
            except (ValueError, FileNotFoundError) as exc:
                raise Http404 from exc
            return HttpResponseRedirect(target)

        # Derive the MIME from the stored filename — old uploads are .webp,
        # admin PPTX conversions are .png. Hardcoding either misrepresents
        # the other; browsers then fall back to download instead of inline.
        content_type = (
            mimetypes.guess_type(slide.image.name)[0] or "application/octet-stream"
        )
        try:
            response = FileResponse(slide.image.open("rb"), content_type=content_type)
        except FileNotFoundError as exc:  # storage missing the file
            raise Http404 from exc
        # Inline only — no Content-Disposition: attachment.
        response["Cache-Control"] = "private, max-age=60"
        response["X-Content-Type-Options"] = "nosniff"
        return response


# PresentationPptxRawView removed — admin-uploaded .pptx files are now
# rasterised server-side into Slide PNGs in apps.presentations.conversion
# and the original deck is deleted from storage. No public route can
# stream the raw file.
