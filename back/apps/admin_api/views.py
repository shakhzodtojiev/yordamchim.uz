import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Avg, Count, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, parsers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models.deletion import ProtectedError

from apps.accounts.permissions import IsAdminOrSuperuser
from apps.personalization.models import UserPreference
from apps.presentations.models import Presentation, PresentationView, Slide
from apps.wallet import services as wallet_services
from apps.wallet.serializers import WalletTransactionSerializer
from django.db.models import Count

from apps.tests.models import (
    Attempt,
    Question,
    QuestionObjection,
    Test,
    TopicPool,
)

from .serializers import (
    AdminObjectionSerializer,
    AdminWalletActionSerializer,
    AdminPoolListSerializer,
    AdminPoolSerializer,
    AdminPresentationSerializer,
    AdminQuestionSerializer,
    AdminSlideSerializer,
    AdminTeacherPreferencesSerializer,
    AdminTeacherUpdateSerializer,
    AdminTestListSerializer,
    AdminTestSerializer,
    TeacherListSerializer,
)

User = get_user_model()

# Teachers = anyone who isn't an admin/superuser/staff. Used by every admin
# rollup so the numbers reflect only real teachers, not the moderators.
TEACHER_FILTER = Q(is_staff=False) & Q(is_admin=False) & Q(is_superuser=False)


class StatsView(APIView):
    """KPIs for the admin dashboard."""

    permission_classes = [IsAdminOrSuperuser]

    def get(self, request):
        seven_days_ago = timezone.now() - timedelta(days=7)

        teachers_qs = User.objects.filter(TEACHER_FILTER)
        teachers_total = teachers_qs.count()
        teachers_onboarded = teachers_qs.filter(has_completed_onboarding=True).count()
        teachers_active_7d = teachers_qs.filter(
            last_login__gte=seven_days_ago
        ).count()

        presentations_total = Presentation.objects.count()
        presentations_published = Presentation.objects.filter(
            is_published=True
        ).count()
        slide_views_7d = PresentationView.objects.filter(
            viewed_at__gte=seven_days_ago
        ).count()

        attempts_total = Attempt.objects.filter(
            status=Attempt.Status.SUBMITTED
        ).count()
        attempts_7d = Attempt.objects.filter(
            status=Attempt.Status.SUBMITTED,
            submitted_at__gte=seven_days_ago,
        ).count()
        average_score = (
            Attempt.objects.filter(status=Attempt.Status.SUBMITTED).aggregate(
                avg=Avg("score")
            )["avg"]
            or 0.0
        )
        pending_objections = QuestionObjection.objects.filter(
            status=QuestionObjection.Status.PENDING
        ).count()

        top_presentations = list(
            Presentation.objects.filter(is_published=True)
            .select_related("subject", "grade")
            .order_by("-view_count")[:5]
            .values("id", "title", "view_count", "subject__name", "grade__name")
        )

        return Response(
            {
                "teachers": {
                    "total": teachers_total,
                    "onboarded": teachers_onboarded,
                    "active_7d": teachers_active_7d,
                },
                "presentations": {
                    "total": presentations_total,
                    "published": presentations_published,
                    "views_7d": slide_views_7d,
                },
                "tests": {
                    "attempts_total": attempts_total,
                    "attempts_7d": attempts_7d,
                    "average_score": round(average_score, 2),
                },
                "objections": {
                    "pending": pending_objections,
                },
                "top_presentations": [
                    {
                        "id": item["id"],
                        "title": item["title"],
                        "view_count": item["view_count"],
                        "subject": item["subject__name"],
                        "grade": item["grade__name"],
                    }
                    for item in top_presentations
                ],
            }
        )


class TeacherListView(generics.ListAPIView):
    serializer_class = TeacherListSerializer
    permission_classes = [IsAdminOrSuperuser]
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("email", "full_name")
    ordering_fields = ("date_joined", "last_login")
    ordering = ("-date_joined",)

    def get_queryset(self):
        return (
            User.objects.filter(TEACHER_FILTER)
            .annotate(
                attempts_count=Count(
                    "attempts",
                    filter=Q(attempts__status=Attempt.Status.SUBMITTED),
                    distinct=True,
                ),
                presentation_views_count=Count(
                    "presentation_views", distinct=True
                ),
            )
            .prefetch_related("preferences__subject", "preferences__grade")
        )


def _assert_target_editable(target, caller):
    """Gate for admin-write endpoints on other users.

    - Superusers can edit anyone.
    - Plain admins can edit only unprivileged users (teachers). This blocks
      lateral privilege attacks: admin A resetting admin B's password,
      wiping a superuser's preferences, or locking a peer out.
    Raises DRF ValidationError so callers get a 400 with a friendly Uzbek
    message rather than a bare 403."""
    if caller.is_superuser:
        return
    if target.is_superuser or target.is_admin:
        raise ValidationError(
            {
                "detail": (
                    "Boshqa admin yoki superuser hisobini o'zgartirish uchun "
                    "superuser huquqi kerak (Django admin paneli orqali)."
                )
            }
        )


class TeacherDetailView(generics.RetrieveAPIView):
    """Read-only detail with the same annotated rollups the list uses.
    Updates go through the sibling PATCH view so we can enforce narrow
    field-level rules that don't belong in a generic RetrieveUpdate."""

    serializer_class = TeacherListSerializer
    permission_classes = [IsAdminOrSuperuser]

    def get_queryset(self):
        # Plain admins see teachers only — mirrors the list scope so they
        # can't enumerate superuser or peer-admin profiles. Superusers see
        # everyone.
        base = User.objects.all()
        if not self.request.user.is_superuser:
            base = base.filter(TEACHER_FILTER)
        return (
            base
            .annotate(
                attempts_count=Count(
                    "attempts",
                    filter=Q(attempts__status=Attempt.Status.SUBMITTED),
                    distinct=True,
                ),
                presentation_views_count=Count(
                    "presentation_views", distinct=True
                ),
            )
            .prefetch_related("preferences__subject", "preferences__grade")
        )


class TeacherUpdateView(generics.UpdateAPIView):
    """PATCH-only surface for admin-editable user fields (full_name,
    is_admin, is_active, has_completed_onboarding). Kept separate from the
    read view so the write payload can't smuggle extra fields."""

    serializer_class = AdminTeacherUpdateSerializer
    permission_classes = [IsAdminOrSuperuser]
    http_method_names = ("patch", "options")

    def get_queryset(self):
        return User.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        _assert_target_editable(instance, request.user)
        # Two self-lockout guards: role and active flag. Either would brick
        # the caller's own access if flipped alone; blocking both prevents
        # accidental one-way lockouts.
        if instance.pk == request.user.pk:
            if "is_admin" in request.data:
                raise ValidationError(
                    {"is_admin": "O'zingizni bu joydan admin rolidan olib bo'lmaydi."}
                )
            if request.data.get("is_active") is False:
                raise ValidationError(
                    {"is_active": "O'zingizni bloklab bo'lmaydi."}
                )
        return super().update(request, *args, **kwargs)


class TeacherPreferencesView(APIView):
    """Overwrites a teacher's (subject × grade) preferences and marks
    onboarding complete. Public PUT /preferences/ is one-shot per rule #3
    in CLAUDE.md — this admin endpoint is the sanctioned override."""

    permission_classes = [IsAdminOrSuperuser]

    def put(self, request, pk: int):
        try:
            teacher = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"detail": "Foydalanuvchi topilmadi."},
                status=status.HTTP_404_NOT_FOUND,
            )
        _assert_target_editable(teacher, request.user)
        serializer = AdminTeacherPreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subjects = serializer.validated_data["subjects"]
        grades = serializer.validated_data["grades"]
        # Reject accidental one-sided wipes — sending {subjects:[X], grades:[]}
        # would cross-product to nothing, silently zeroing the teacher's
        # scope. Require both sides to be set together (or both empty for
        # an explicit clear).
        if bool(subjects) != bool(grades):
            raise ValidationError(
                "Fanlar va sinflar birga to'ldirilishi kerak (yoki ikkalasi bo'sh)."
            )

        # Full replace, not merge — matches the public endpoint's semantics
        # and keeps the admin's mental model simple ("what I send is the
        # complete set"). Cross-product mirrors PublicPreferencesUpdate.
        with transaction.atomic():
            UserPreference.objects.filter(user=teacher).delete()
            UserPreference.objects.bulk_create(
                UserPreference(user=teacher, subject_id=s, grade_id=g)
                for s in subjects
                for g in grades
            )
            teacher.has_completed_onboarding = True
            teacher.save(update_fields=["has_completed_onboarding"])

        return Response(
            {"subjects": subjects, "grades": grades},
            status=status.HTTP_200_OK,
        )


class TeacherPasswordResetView(APIView):
    """Generates a short-lived random password for the target user and
    returns it once in the response. Admin shows it to the teacher through
    a side channel (in-person, Telegram, phone) — the app has no email
    dispatch infrastructure, so link-based reset isn't an option."""

    permission_classes = [IsAdminOrSuperuser]

    def post(self, request, pk: int):
        import secrets
        import string

        try:
            teacher = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"detail": "Foydalanuvchi topilmadi."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if teacher.pk == request.user.pk:
            return Response(
                {"detail": "O'zingizga bu yerdan parol reset qilib bo'lmaydi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        _assert_target_editable(teacher, request.user)

        # 12 chars — mixed case + digits, no ambiguous symbols so it can be
        # dictated over the phone without typos. Teacher must change it on
        # next login (documented in the UI copy; no enforcement flag yet).
        alphabet = string.ascii_letters + string.digits
        new_password = "".join(secrets.choice(alphabet) for _ in range(12))

        with transaction.atomic():
            teacher.set_password(new_password)
            teacher.save(update_fields=["password"])
            # Invalidate every outstanding refresh token for this user so a
            # stolen refresh token can't outlive the reset. Wrapped in a
            # try/except because token_blacklist may not be installed in
            # all envs (though it is in ours per settings.INSTALLED_APPS).
            try:
                from rest_framework_simplejwt.token_blacklist.models import (
                    OutstandingToken,
                    BlacklistedToken,
                )

                for token in OutstandingToken.objects.filter(user=teacher):
                    BlacklistedToken.objects.get_or_create(token=token)
            except ImportError:
                pass

        response = Response(
            {"password": new_password}, status=status.HTTP_200_OK
        )
        # Prevent intermediary caches / APM sniffers from persisting the
        # one-shot password in the response body.
        response["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response["Pragma"] = "no-cache"
        return response


class AdminPresentationListCreateView(generics.ListCreateAPIView):
    """Admin list (incl. unpublished) and create."""

    serializer_class = AdminPresentationSerializer
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("subject", "grade", "quarter")
    search_fields = ("title", "description")
    ordering_fields = ("created_at", "view_count")
    ordering = ("-created_at",)

    def get_queryset(self):
        return Presentation.objects.select_related("subject", "grade").all()


class AdminPresentationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminPresentationSerializer
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_queryset(self):
        return Presentation.objects.select_related("subject", "grade").all()


class AdminSlideUploadView(APIView):
    """POST multiple files at once to a presentation; appends in given order.

    Form field name: `slides` (multiple). Files are sorted by filename before
    being assigned sequential `order` values starting from `slide_count + 1`.
    """

    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser)

    def post(self, request, presentation_id: int):
        try:
            presentation = Presentation.objects.get(pk=presentation_id)
        except Presentation.DoesNotExist:
            return Response(
                {"detail": "Presentation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        files = request.FILES.getlist("slides")
        if not files:
            return Response(
                {"detail": "Kamida bitta rasm fayl yuboring (`slides`)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        files.sort(key=lambda f: f.name)
        starting_order = presentation.slide_count + 1
        created: list[Slide] = []
        for offset, f in enumerate(files):
            slide = Slide.objects.create(
                presentation=presentation,
                order=starting_order + offset,
                image=f,
            )
            created.append(slide)

        # Refresh slide_count to match reality.
        presentation.slide_count = presentation.slides.count()
        presentation.save(update_fields=["slide_count"])

        return Response(
            AdminSlideSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class AdminSlideDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAdminOrSuperuser]

    def get_queryset(self):
        return Slide.objects.select_related("presentation")

    def perform_destroy(self, instance: Slide):
        presentation = instance.presentation
        instance.delete()
        # Recompute slide_count and re-pack `order` values so they stay 1..N
        # (avoids gaps when admin deletes a middle slide).
        slides = list(presentation.slides.order_by("order"))
        for new_order, slide in enumerate(slides, start=1):
            if slide.order != new_order:
                slide.order = new_order
                slide.save(update_fields=["order"])
        presentation.slide_count = len(slides)
        presentation.save(update_fields=["slide_count"])


# ---- Topic pool admin ----


class AdminPoolListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrSuperuser]
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("title", "description")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)

    def get_queryset(self):
        return (
            TopicPool.objects.select_related("subject")
            .annotate(question_count=Count("questions"))
        )

    def get_serializer_class(self):
        # POST returns the full detail (with empty questions list); list view
        # uses the lightweight serializer.
        return (
            AdminPoolSerializer
            if self.request.method == "POST"
            else AdminPoolListSerializer
        )


class AdminPoolDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminPoolSerializer
    permission_classes = [IsAdminOrSuperuser]

    def get_queryset(self):
        return (
            TopicPool.objects.select_related("subject")
            .prefetch_related("questions__choices", "questions__pairs")
            .annotate(question_count=Count("questions"))
        )

    def perform_destroy(self, instance: TopicPool):
        # If any Test references this pool (PROTECT), Django will refuse the
        # delete and we surface a friendly error.
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers_protected_error(exc) from exc


# ---- Tests admin ----


class AdminTestListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrSuperuser]
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("title", "description")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)

    def get_queryset(self):
        return Test.objects.prefetch_related("test_pools__pool__subject")

    def get_serializer_class(self):
        return AdminTestSerializer if self.request.method == "POST" else AdminTestListSerializer


class AdminTestDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve / patch test metadata and delete the whole test."""

    serializer_class = AdminTestSerializer
    permission_classes = [IsAdminOrSuperuser]

    def get_queryset(self):
        return Test.objects.prefetch_related("test_pools__pool__subject")

    def perform_destroy(self, instance: Test):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers_protected_error(exc) from exc


# ---- Question multipart helpers ----
#
# Both create and update accept multipart/form-data with:
#   - `data` (string): JSON envelope with text, question_type, difficulty,
#     choices: [{text, is_correct}, ...], pairs: [{left_text, right_text}, ...]
#   - `q_image` (file, optional): question image
#   - `q_image_clear` ("1", optional): drop the existing question image
#   - `choice_image_<idx>` (file, optional): image for the choice at that
#     index in `data.choices`. After save the choices are ordered idx+1.
#   - `choice_image_clear_<idx>` ("1"): drop existing choice image
#   - `pair_left_image_<idx>` / `pair_right_image_<idx>` (file)
#   - `pair_left_image_clear_<idx>` / `pair_right_image_clear_<idx>` ("1")
#
# Pure-JSON requests (no images) are also accepted, for symmetry with the
# old API and for tooling.


def _parse_question_payload(request) -> dict:
    raw = request.data.get("data")
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValidationError(
                {"data": "JSON yuborishda xato bor."}
            ) from exc
    # Fallback: pure-JSON body — DRF already parsed it into request.data.
    return {k: request.data[k] for k in request.data.keys() if k != "data"}


def _apply_question_images(question: Question, request) -> None:
    """Attach uploaded files and clear existing ones (if requested) on the
    question, its choices, or its pairs. Called *after* the serializer has
    materialized children so we can match by ordered index."""
    files = request.FILES
    flags = request.data

    # Question image
    q_modified = False
    if flags.get("q_image_clear") == "1" and question.image:
        question.image.delete(save=False)
        question.image = None
        q_modified = True
    if "q_image" in files:
        question.image = files["q_image"]
        q_modified = True
    if q_modified:
        question.save(update_fields=["image"])

    if question.question_type in (Question.Type.SINGLE, Question.Type.MULTI):
        for idx, choice in enumerate(question.choices.order_by("order")):
            modified = False
            if flags.get(f"choice_image_clear_{idx}") == "1" and choice.image:
                choice.image.delete(save=False)
                choice.image = None
                modified = True
            file_key = f"choice_image_{idx}"
            if file_key in files:
                choice.image = files[file_key]
                modified = True
            if modified:
                choice.save(update_fields=["image"])

    elif question.question_type == Question.Type.MATCHING:
        for idx, pair in enumerate(question.pairs.order_by("order")):
            for side in ("left", "right"):
                attr = f"{side}_image"
                clear_key = f"pair_{side}_image_clear_{idx}"
                file_key = f"pair_{side}_image_{idx}"
                modified = False
                current = getattr(pair, attr)
                if flags.get(clear_key) == "1" and current:
                    current.delete(save=False)
                    setattr(pair, attr, None)
                    modified = True
                if file_key in files:
                    setattr(pair, attr, files[file_key])
                    modified = True
                if modified:
                    pair.save(update_fields=[attr])


class AdminQuestionCreateView(APIView):
    """POST /admin/pools/<id>/questions/ — create a new question in this pool.
    Accepts multipart/form-data (with optional image files) or pure JSON."""

    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def post(self, request, pool_id: int):
        try:
            pool = TopicPool.objects.get(pk=pool_id)
        except TopicPool.DoesNotExist:
            return Response(
                {"detail": "To'plam topilmadi."}, status=status.HTTP_404_NOT_FOUND
            )

        payload = _parse_question_payload(request)
        serializer = AdminQuestionSerializer(
            data=payload, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        question = serializer.save(pool=pool)
        _apply_question_images(question, request)
        return Response(
            AdminQuestionSerializer(question).data,
            status=status.HTTP_201_CREATED,
        )


class AdminQuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminQuestionSerializer
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_queryset(self):
        return (
            Question.objects.select_related("pool")
            .prefetch_related("choices", "pairs")
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        payload = _parse_question_payload(request)
        serializer = self.get_serializer(
            instance, data=payload, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        _apply_question_images(question, request)
        return Response(AdminQuestionSerializer(question).data)

    def perform_destroy(self, instance: Question):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise serializers_protected_error(exc) from exc


def serializers_protected_error(exc: ProtectedError) -> Exception:
    """Translate Django's ProtectedError into a friendly DRF 400.

    Inspect the actual protector model so the message points to the right
    fix (detach from lesson vs. finish attempt vs. remove from test pool)
    instead of a one-size-fits-all "test attempts" line that's wrong for
    most cases."""
    from rest_framework.exceptions import ValidationError

    protectors = getattr(exc, "protected_objects", ()) or ()
    protector_labels = {
        type(obj)._meta.label for obj in protectors
    }

    if "courses.Lesson" in protector_labels:
        detail = (
            "Bu test darsga bog'langan. Avval Kurslar → Darslar bo'limidan "
            "darsni ajrating yoki test turini o'zgartiring."
        )
    elif "attestation.TestPool" in protector_labels:
        detail = (
            "Bu to'plam bir yoki bir nechta testga bog'langan. Avval "
            "testlardan ajrating."
        )
    elif "attestation.Answer" in protector_labels:
        detail = (
            "Bu savolga foydalanuvchilar javob bergan. Tahrirlashni "
            "urinishlar to'xtaganidan keyin bajaring."
        )
    else:
        # Generic fallback for future FK PROTECT relations we haven't
        # branched on yet — still friendly, no more claiming "attempts".
        detail = (
            "Bu yozuvni o'chirib bo'lmaydi — unga bog'liq boshqa ma'lumotlar "
            "bor. Avval shu bog'lanishlarni uzing."
        )

    return ValidationError({"detail": detail})


# ---- Objections admin ----


class AdminObjectionListView(generics.ListAPIView):
    """List all objections — supports `?status=pending|resolved|rejected`
    and `?search=` against question text / user email. Returns a flat list
    (no pagination) so the admin page can render everything at once."""

    serializer_class = AdminObjectionSerializer
    permission_classes = [IsAdminOrSuperuser]
    pagination_class = None
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("question__text", "user__email", "user__full_name", "body")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = (
            QuestionObjection.objects.select_related(
                "user", "question", "question__pool", "attempt"
            )
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminObjectionDetailView(generics.RetrieveUpdateAPIView):
    """PATCH to update status / admin_note. We don't allow deletes —
    objections are an audit trail."""

    serializer_class = AdminObjectionSerializer
    permission_classes = [IsAdminOrSuperuser]

    def get_queryset(self):
        return QuestionObjection.objects.select_related(
            "user", "question", "question__pool", "attempt"
        )


class AdminTeacherWalletView(APIView):
    """A teacher's wallet balance + recent ledger — the admin's read view
    before topping up or paying out."""

    permission_classes = [IsAdminOrSuperuser]

    def get(self, request, pk: int):
        teacher = _get_teacher_or_404(request, pk)
        wallet = wallet_services.get_or_create_wallet(teacher)
        transactions = wallet.transactions.select_related("presentation")[:50]
        return Response(
            {
                "balance": wallet.balance,
                "transactions": WalletTransactionSerializer(
                    transactions, many=True
                ).data,
            }
        )


class AdminTeacherWalletTopupView(APIView):
    """Manual balance top-up. This is the MVP stand-in for a payment gateway:
    the teacher pays out-of-band (bank transfer, cash) and an admin credits
    their balance here. Payme/Click will later call `deposit` the same way."""

    permission_classes = [IsAdminOrSuperuser]

    def post(self, request, pk: int):
        teacher = _get_teacher_or_404(request, pk)
        _assert_target_editable(teacher, request.user)
        serializer = AdminWalletActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        note = serializer.validated_data.get("note") or (
            f"Admin to'ldirdi: {request.user.email}"
        )
        tx = wallet_services.deposit(teacher, amount, note=note)
        return Response(
            {"balance": tx.balance_after, "amount": amount},
            status=status.HTTP_201_CREATED,
        )


class AdminTeacherWalletPayoutView(APIView):
    """Record a payout: reduce the teacher's balance once the platform has
    actually paid them (bank transfer). Fails with 400 if the balance is
    short."""

    permission_classes = [IsAdminOrSuperuser]

    def post(self, request, pk: int):
        teacher = _get_teacher_or_404(request, pk)
        _assert_target_editable(teacher, request.user)
        serializer = AdminWalletActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        note = serializer.validated_data.get("note") or (
            f"Admin payout: {request.user.email}"
        )
        try:
            tx = wallet_services.withdraw(teacher, amount, note=note)
        except wallet_services.InsufficientFunds:
            raise ValidationError({"amount": "Balans yetarli emas."})
        except wallet_services.WalletError as exc:
            raise ValidationError({"amount": str(exc)})
        return Response(
            {"balance": tx.balance_after, "amount": amount},
            status=status.HTTP_201_CREATED,
        )


def _get_teacher_or_404(request, pk: int):
    """Resolve a user the caller is allowed to see. Plain admins are scoped to
    teachers (mirrors TeacherDetailView); superusers see everyone."""
    base = User.objects.all()
    if not request.user.is_superuser:
        base = base.filter(TEACHER_FILTER)
    try:
        return base.get(pk=pk)
    except User.DoesNotExist:
        raise ValidationError({"detail": "Foydalanuvchi topilmadi."})
