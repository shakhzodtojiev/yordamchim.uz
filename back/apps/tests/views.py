from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Attempt,
    AttemptQuestion,
    Question,
    QuestionObjection,
    Test,
)
from .serializers import (
    AttemptHistorySerializer,
    AttemptResultSerializer,
    AttemptStartSerializer,
    AttemptSubmitInputSerializer,
    QuestionObjectionInputSerializer,
    QuestionObjectionSerializer,
    TestListSerializer,
    submit_attempt,
)

HISTORY_LIMIT = 5


def _attach_rank(attempt: Attempt) -> Attempt:
    """Compute the attempt's standing among submitted siblings on the same
    test. Higher score wins; ties broken by earlier submission. We attach
    `rank` and `rank_total` as instance attributes — the serializer reads
    them via plain IntegerField. Null for in-progress attempts."""
    if attempt.status != Attempt.Status.SUBMITTED:
        attempt.rank = None
        attempt.rank_total = None
        return attempt
    siblings = Attempt.objects.filter(
        test=attempt.test, status=Attempt.Status.SUBMITTED
    )
    total = siblings.count()
    higher = siblings.filter(
        Q(score__gt=attempt.score)
        | Q(score=attempt.score, submitted_at__lt=attempt.submitted_at)
    ).count()
    attempt.rank = higher + 1
    attempt.rank_total = total
    return attempt


class TestListView(generics.ListAPIView):
    serializer_class = TestListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    # Subject is now on the pool — surface it as a filter via lookup.
    filterset_fields = {
        "pools__subject": ["exact"],
        "kind": ["exact"],
    }
    search_fields = ("title", "description")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)

    def get_queryset(self):
        return (
            Test.objects.filter(is_published=True)
            .prefetch_related("test_pools__pool__subject")
            .annotate(question_count=Count("pools__questions", distinct=True))
            .distinct()
        )


class TestDetailView(generics.RetrieveAPIView):
    """GET /tests/<id>/ → a single published test row. The teacher detail page
    reads through here instead of scanning the paginated list (which 404s for
    any test past page 1)."""

    serializer_class = TestListSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "test_id"

    def get_queryset(self):
        return (
            Test.objects.filter(is_published=True)
            .prefetch_related("test_pools__pool__subject")
            .annotate(question_count=Count("pools__questions", distinct=True))
            .distinct()
        )


def _materialize_attempt_questions(attempt: Attempt) -> None:
    """Pick the per-pool, per-difficulty random subset and persist it as
    AttemptQuestion rows. Buckets that come up short take whatever's there
    rather than failing — admins ramping up content shouldn't block users.

    Pools are processed in TestPool.order, so questions appear in the order
    the admin configured (Algebra block, then Geometry block, etc)."""
    test = attempt.test
    selected_ids: list[int] = []

    for tp in test.test_pools.select_related("pool").order_by("order", "id"):
        buckets = (
            (Question.Difficulty.EASY, tp.easy_count),
            (Question.Difficulty.MEDIUM, tp.medium_count),
            (Question.Difficulty.HARD, tp.hard_count),
        )
        for difficulty, target in buckets:
            if target <= 0:
                continue
            ids = list(
                tp.pool.questions.filter(difficulty=difficulty)
                .order_by("?")
                .values_list("id", flat=True)[:target]
            )
            selected_ids.extend(ids)

    if not selected_ids:
        raise ValidationError(
            {"detail": "Bu test bo'sh — to'plam(lar)da savol yo'q yoki sonlar 0."}
        )

    rows = [
        AttemptQuestion(attempt=attempt, question_id=qid, order=idx)
        for idx, qid in enumerate(selected_ids, start=1)
    ]
    AttemptQuestion.objects.bulk_create(rows)


class AttemptStartView(APIView):
    """POST /tests/<id>/start → creates an Attempt and returns questions.

    Mock tests have extra rules:
      - can only start within `[available_from, available_until]`
      - the user gets exactly one attempt — once submitted/expired, the door
        is closed."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "test_submit"

    def post(self, request, test_id: int):
        test = get_object_or_404(
            Test.objects.prefetch_related("test_pools__pool__subject").filter(
                is_published=True
            ),
            pk=test_id,
        )
        now = timezone.now()

        if test.kind == Test.Kind.MOCK:
            if not test.has_started:
                return Response(
                    {"detail": "Mock test hali boshlanmagan."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if test.has_ended:
                return Response(
                    {"detail": "Mock test vaqti tugagan."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            already = Attempt.objects.filter(
                user=request.user, test=test
            ).exclude(status=Attempt.Status.IN_PROGRESS).exists()
            if already:
                return Response(
                    {
                        "detail": "Mock testda faqat bitta urinishga ruxsat — "
                        "siz allaqachon topshirgansiz."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Reuse an in-progress attempt if one exists and isn't expired.
        existing = (
            Attempt.objects.filter(
                user=request.user,
                test=test,
                status=Attempt.Status.IN_PROGRESS,
            )
            .order_by("-started_at")
            .first()
        )
        if existing and existing.deadline_at >= now:
            attempt = existing
        else:
            if existing:
                existing.status = Attempt.Status.EXPIRED
                existing.submitted_at = now
                existing.save(update_fields=["status", "submitted_at"])
            with transaction.atomic():
                # Mock deadline is the earlier of (test_duration, window_end) so a
                # late start can't run past the closing bell.
                deadline = now + timedelta(seconds=test.duration_seconds)
                if test.kind == Test.Kind.MOCK and test.available_until:
                    deadline = min(deadline, test.available_until)
                attempt = Attempt.objects.create(
                    user=request.user,
                    test=test,
                    deadline_at=deadline,
                )
                _materialize_attempt_questions(attempt)
        serializer = AttemptStartSerializer(attempt)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AttemptCurrentView(APIView):
    """GET /tests/<id>/current/ → the caller's active in-progress attempt for
    this test, *without* creating one. 404 when there's no live attempt.

    Starting an attempt is a mutation and lives in AttemptStartView (POST).
    The run page reads through this endpoint so a bookmarked/prefetched GET
    can never silently start (and, for mock tests, burn) an attempt."""

    permission_classes = [IsAuthenticated]

    def get(self, request, test_id: int):
        now = timezone.now()
        attempt = (
            Attempt.objects.filter(
                user=request.user,
                test_id=test_id,
                status=Attempt.Status.IN_PROGRESS,
            )
            .order_by("-started_at")
            .first()
        )
        if not attempt or attempt.deadline_at < now:
            return Response(
                {"detail": "Faol urinish topilmadi."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(AttemptStartSerializer(attempt).data)


class AttemptSubmitView(APIView):
    """POST /tests/attempts/<id>/submit"""

    permission_classes = [IsAuthenticated]
    throttle_scope = "test_submit"

    def post(self, request, attempt_id: int):
        attempt = get_object_or_404(
            Attempt.objects.select_related("test"),
            pk=attempt_id,
            user=request.user,
        )
        payload = AttemptSubmitInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        finalized = submit_attempt(attempt, payload.validated_data["answers"])
        hydrated = (
            finalized.__class__.objects.prefetch_related(
                "answers__question__pool",
                "answers__question__choices",
                "answers__question__pairs",
                "answers__selected_choices",
            )
            .select_related("test")
            .prefetch_related("test__test_pools__pool__subject")
            .get(pk=finalized.pk)
        )
        _attach_rank(hydrated)
        return Response(AttemptResultSerializer(hydrated).data)


class AttemptDetailView(generics.RetrieveAPIView):
    serializer_class = AttemptResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Attempt.objects.filter(user=self.request.user)
            .select_related("test").prefetch_related("test__test_pools__pool__subject")
            .prefetch_related(
                "answers__question__pool",
                "answers__question__choices",
                "answers__question__pairs",
                "answers__selected_choices",
            )
        )

    def get_object(self):
        # Hook into the lookup so rank is attached on every retrieval, not
        # only after submit.
        attempt = super().get_object()
        return _attach_rank(attempt)


class AttemptHistoryView(generics.ListAPIView):
    """Last 5 submitted/expired attempts — drives the dashboard history list."""

    serializer_class = AttemptHistorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (
            Attempt.objects.filter(user=self.request.user)
            .exclude(status=Attempt.Status.IN_PROGRESS)
            .select_related("test").prefetch_related("test__test_pools__pool__subject")
            .order_by("-started_at")[:HISTORY_LIMIT]
        )


class StatsView(APIView):
    """Tiny rollup for the dashboard cards."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Attempt.objects.filter(
            user=request.user, status=Attempt.Status.SUBMITTED
        )
        total = qs.count()
        avg = (
            sum(qs.values_list("score", flat=True)) / total if total else 0.0
        )
        return Response(
            {
                "tests_taken": total,
                "average_score": round(avg, 2),
            }
        )


class ObjectionListCreateView(generics.ListCreateAPIView):
    """User-facing — teachers raise objections about specific questions and
    see their own past objections. Admins use a separate admin endpoint that
    sees all objections."""

    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = QuestionObjectionSerializer

    def get_queryset(self):
        return (
            QuestionObjection.objects.filter(user=self.request.user)
            .select_related("question", "attempt")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        payload = QuestionObjectionInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        try:
            question = Question.objects.get(pk=data["question_id"])
        except Question.DoesNotExist:
            return Response(
                {"detail": "Savol topilmadi."}, status=status.HTTP_404_NOT_FOUND
            )

        # Only let a user object to a question they actually saw in one of
        # their own attempts. Without this an arbitrary question_id would
        # echo back `question_text`, letting anyone enumerate the whole
        # question bank via this endpoint.
        has_seen = AttemptQuestion.objects.filter(
            attempt__user=request.user, question=question
        ).exists()
        if not has_seen:
            return Response(
                {"detail": "Bu savolga e'tiroz bildirish uchun avval uni "
                 "test topshirishda ko'rgan bo'lishingiz kerak."},
                status=status.HTTP_403_FORBIDDEN,
            )

        attempt = None
        if data.get("attempt_id"):
            attempt = Attempt.objects.filter(
                pk=data["attempt_id"], user=request.user
            ).first()

        objection = QuestionObjection.objects.create(
            user=request.user,
            question=question,
            attempt=attempt,
            reason=data["reason"],
            body=data.get("body", ""),
        )
        return Response(
            QuestionObjectionSerializer(objection).data,
            status=status.HTTP_201_CREATED,
        )
