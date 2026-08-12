from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.personalization.models import Subject


class TopicPool(models.Model):
    """A topic-based question bank. Admins fill it with questions of varying
    types and difficulties, then create one or more Tests that draw from it."""

    class Type(models.TextChoices):
        REGULAR = "oddiy", "Oddiy"
        THEORETICAL = "nazariy", "Nazariy"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    subject = models.ForeignKey(
        Subject, on_delete=models.PROTECT, related_name="topic_pools"
    )
    pool_type = models.CharField(
        max_length=10, choices=Type.choices, default=Type.REGULAR
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("subject", "pool_type"))]

    def __str__(self) -> str:
        return self.title


class Test(models.Model):
    class Kind(models.TextChoices):
        REGULAR = "regular", "Regular"
        MOCK = "mock", "Mock"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # A test can pull from one or more pools. Each link (TestPool) carries
    # its own per-difficulty quotas, so a single test can mix
    # "5 easy + 5 medium + 5 hard from Algebra" with
    # "3 easy + 2 medium + 2 hard from Geometry".
    pools = models.ManyToManyField(
        TopicPool, through="TestPool", related_name="tests"
    )
    duration_seconds = models.PositiveIntegerField(default=30 * 60)
    kind = models.CharField(
        max_length=10, choices=Kind.choices, default=Kind.REGULAR
    )
    # Mock-only window. Outside this range a mock test can't be started.
    available_from = models.DateTimeField(null=True, blank=True)
    available_until = models.DateTimeField(null=True, blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title

    @property
    def subjects(self):
        """All distinct subjects across the test's linked pools — preserves
        order by TestPool.order. Used in list serializers / personalization."""
        seen: set[int] = set()
        out = []
        for tp in self.test_pools.select_related("pool__subject").all():
            sid = tp.pool.subject_id
            if sid not in seen:
                seen.add(sid)
                out.append(tp.pool.subject)
        return out

    @property
    def primary_subject(self):
        first = self.subjects
        return first[0] if first else None

    @property
    def questions_per_attempt(self) -> int:
        total = 0
        for tp in self.test_pools.all():
            total += tp.easy_count + tp.medium_count + tp.hard_count
        return total

    @property
    def is_within_window(self) -> bool:
        if self.kind != self.Kind.MOCK:
            return True
        now = timezone.now()
        if self.available_from and now < self.available_from:
            return False
        if self.available_until and now > self.available_until:
            return False
        return True

    @property
    def has_started(self) -> bool:
        if self.available_from is None:
            return True
        return timezone.now() >= self.available_from

    @property
    def has_ended(self) -> bool:
        if self.available_until is None:
            return False
        return timezone.now() > self.available_until


class TestPool(models.Model):
    """Through model linking a Test to a TopicPool with per-difficulty quotas.

    Each attempt pulls `easy_count` easy + `medium_count` medium + `hard_count`
    hard questions from `pool` (random, capped at what's available)."""

    test = models.ForeignKey(
        Test, on_delete=models.CASCADE, related_name="test_pools"
    )
    pool = models.ForeignKey(
        TopicPool, on_delete=models.PROTECT, related_name="test_pools"
    )
    order = models.PositiveIntegerField(default=1)
    easy_count = models.PositiveIntegerField(default=0)
    medium_count = models.PositiveIntegerField(default=0)
    hard_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("test", "pool"), name="test_pool_unique"
            )
        ]


class Question(models.Model):
    class Type(models.TextChoices):
        SINGLE = "single", "Single choice"
        MULTI = "multi", "Multi choice"
        MATCHING = "matching", "Matching"

    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MEDIUM = "medium", "Medium"
        HARD = "hard", "Hard"

    pool = models.ForeignKey(
        TopicPool, on_delete=models.CASCADE, related_name="questions"
    )
    order = models.PositiveIntegerField()
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to="questions/q/", blank=True, null=True)
    question_type = models.CharField(
        max_length=10, choices=Type.choices, default=Type.SINGLE
    )
    difficulty = models.CharField(
        max_length=8, choices=Difficulty.choices, default=Difficulty.MEDIUM
    )

    class Meta:
        ordering = ("order",)
        indexes = [models.Index(fields=("pool", "difficulty"))]
        constraints = [
            models.UniqueConstraint(
                fields=("pool", "order"), name="question_order_unique"
            )
        ]


class Choice(models.Model):
    """Option for single/multi-choice questions. `is_correct` is server-only —
    never serialized to test-takers, only revealed in results after submission."""

    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="choices"
    )
    order = models.PositiveSmallIntegerField()
    text = models.CharField(max_length=400, blank=True)
    image = models.ImageField(upload_to="questions/c/", blank=True, null=True)
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=("question", "order"), name="choice_order_unique"
            )
        ]


class MatchPair(models.Model):
    """A (left, right) row belonging to a matching-type Question. The pair's
    own id is the canonical "correct match": user-submitted matches are scored
    by checking that each chosen left.id == chosen right.id."""

    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="pairs"
    )
    order = models.PositiveSmallIntegerField()
    left_text = models.CharField(max_length=400, blank=True)
    left_image = models.ImageField(upload_to="questions/p/", blank=True, null=True)
    right_text = models.CharField(max_length=400, blank=True)
    right_image = models.ImageField(upload_to="questions/p/", blank=True, null=True)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=("question", "order"), name="pair_order_unique"
            )
        ]


class Attempt(models.Model):
    """A single run of a test by a user."""

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        SUBMITTED = "submitted", "Submitted"
        EXPIRED = "expired", "Expired"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts"
    )
    test = models.ForeignKey(Test, on_delete=models.PROTECT, related_name="attempts")
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    deadline_at = models.DateTimeField()
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.IN_PROGRESS
    )
    correct_count = models.PositiveIntegerField(default=0)
    total_count = models.PositiveIntegerField(default=0)
    score = models.FloatField(default=0.0)  # 0..100

    class Meta:
        ordering = ("-started_at",)
        indexes = [
            models.Index(fields=("user", "-started_at")),
            models.Index(fields=("test", "-started_at")),
        ]

    @property
    def is_expired(self) -> bool:
        return (
            self.status == self.Status.IN_PROGRESS and self.deadline_at < timezone.now()
        )


class AttemptQuestion(models.Model):
    """The materialized random subset of pool questions assigned to an Attempt
    at start time. Persisting this means refresh/resume always shows the same
    set in the same order, instead of re-shuffling on each visit."""

    attempt = models.ForeignKey(
        Attempt, on_delete=models.CASCADE, related_name="attempt_questions"
    )
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=("attempt", "question"), name="attempt_question_unique"
            ),
            models.UniqueConstraint(
                fields=("attempt", "order"), name="attempt_question_order_unique"
            ),
        ]


class Answer(models.Model):
    """User's answer to a Question within an Attempt. Shape depends on the
    question's type:
      - single/multi: `selected_choices` holds the picked Choices.
      - matching: `match_payload` is a list of [left_pair_id, right_pair_id]."""

    attempt = models.ForeignKey(
        Attempt, on_delete=models.CASCADE, related_name="answers"
    )
    question = models.ForeignKey(
        Question, on_delete=models.PROTECT, related_name="answers"
    )
    selected_choices = models.ManyToManyField(
        Choice, blank=True, related_name="answers"
    )
    match_payload = models.JSONField(default=list, blank=True)
    is_correct = models.BooleanField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("attempt", "question"), name="answer_per_question_unique"
            )
        ]


class QuestionObjection(models.Model):
    """A teacher's objection about a specific Question — wrong answer, typo,
    unclear wording, etc. Raised either while taking the test or after seeing
    results, surfaced to admins via the admin objections page."""

    class Reason(models.TextChoices):
        WRONG_ANSWER = "wrong_answer", "Noto'g'ri javob"
        WRONG_QUESTION = "wrong_question", "Noto'g'ri savol"
        TYPO = "typo", "Imloviy xato"
        UNCLEAR = "unclear", "Tushunarsiz"
        OTHER = "other", "Boshqa"

    class Status(models.TextChoices):
        PENDING = "pending", "Ko'rib chiqilmoqda"
        RESOLVED = "resolved", "Hal qilindi"
        REJECTED = "rejected", "Rad etildi"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="objections",
    )
    question = models.ForeignKey(
        Question, on_delete=models.PROTECT, related_name="objections"
    )
    # Optional context — set when the objection was raised inside an attempt
    # (during the run or on the results page). Null for free-form admin reports.
    attempt = models.ForeignKey(
        Attempt,
        on_delete=models.SET_NULL,
        related_name="objections",
        null=True,
        blank=True,
    )
    reason = models.CharField(
        max_length=20, choices=Reason.choices, default=Reason.OTHER
    )
    body = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    admin_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status", "-created_at")),
            models.Index(fields=("user", "-created_at")),
        ]

