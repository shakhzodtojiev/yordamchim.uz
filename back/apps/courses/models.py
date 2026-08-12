from django.conf import settings
from django.db import models

from apps.personalization.models import Grade, Subject
from apps.tests.models import Test, TopicPool


def lesson_video_upload_path(instance: "Lesson", filename: str) -> str:
    return f"courses/lessons/{instance.id or 'new'}/{filename}"


def course_cover_upload_path(instance: "Course", filename: str) -> str:
    return f"courses/covers/{instance.id or 'new'}/{filename}"


class Lesson(models.Model):
    """Atomic content unit — a single video, text, or test link.

    Reused across module-based Courses and the system-recommended "Mening
    o'quv rejam" list. Content is tagged by subject/grade for personalization
    and (optionally) by topic_pool for weakness-based recommendation.
    """

    class Kind(models.TextChoices):
        VIDEO = "video", "Video"
        TEXT = "text", "Matnli"
        TEST = "test", "Test"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices)

    subject = models.ForeignKey(
        Subject, on_delete=models.PROTECT, related_name="lessons"
    )
    grade = models.ForeignKey(
        Grade, on_delete=models.PROTECT, related_name="lessons"
    )
    # The recommendation engine matches a user's weak TopicPools (via their
    # attempt scores) against Lessons tagged with the same pool. Nullable so
    # generic/introductory lessons that don't map to a pool can still exist.
    topic_pool = models.ForeignKey(
        TopicPool,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lessons",
    )

    # Kind-specific fields — only one is populated per row based on `kind`.
    video_url = models.URLField(blank=True)
    video_file = models.FileField(
        upload_to=lesson_video_upload_path, blank=True, null=True
    )
    body = models.TextField(blank=True)  # for kind=text (HTML from WYSIWYG)
    test = models.ForeignKey(
        Test,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lessons",
    )

    # Admin-entered — we don't extract from the video file to avoid needing
    # ffmpeg in the backend image.
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)

    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("subject", "grade")),
            models.Index(fields=("kind", "is_published")),
            models.Index(fields=("topic_pool", "kind")),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()}: {self.title}"


class Course(models.Model):
    """Admin-curated modular course — a container for Modules of Lessons."""

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    subject = models.ForeignKey(
        Subject, on_delete=models.PROTECT, related_name="courses"
    )
    grade = models.ForeignKey(
        Grade, on_delete=models.PROTECT, related_name="courses"
    )
    # Same optional 1..4 quarter as Presentation — universal courses leave null.
    quarter = models.PositiveSmallIntegerField(
        choices=[(1, "1"), (2, "2"), (3, "3"), (4, "4")],
        null=True,
        blank=True,
    )
    cover_image = models.ImageField(
        upload_to=course_cover_upload_path, blank=True, null=True
    )
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("subject", "grade")),
            models.Index(fields=("is_published", "-created_at")),
        ]

    def __str__(self) -> str:
        return self.title


class Module(models.Model):
    """A section within a Course — groups lessons and holds their order."""

    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="modules"
    )
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=("course", "order"), name="module_order_unique"
            )
        ]

    def __str__(self) -> str:
        return f"{self.course_id}#{self.order}: {self.title}"


class ModuleLesson(models.Model):
    """Through model — same Lesson can be attached to multiple Modules.

    Order is per-module (a lesson can be #2 in Module A and #5 in Module B).
    """

    module = models.ForeignKey(
        Module, on_delete=models.CASCADE, related_name="module_lessons"
    )
    lesson = models.ForeignKey(
        Lesson, on_delete=models.PROTECT, related_name="module_links"
    )
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=("module", "order"), name="module_lesson_order_unique"
            ),
            models.UniqueConstraint(
                fields=("module", "lesson"),
                name="module_lesson_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"module={self.module_id} lesson={self.lesson_id} order={self.order}"


class LessonCompletion(models.Model):
    """Per-user, per-lesson completion mark. Global — a lesson finished in
    one course context counts as finished everywhere it appears."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lesson_completions",
    )
    # PROTECT (not CASCADE) — a hard-deleted Lesson would otherwise silently
    # wipe every teacher's "I finished this" record. Mirrors the pattern on
    # Answer.question. Admins must detach the lesson from all modules first,
    # then null-out its completions explicitly if they really mean to.
    lesson = models.ForeignKey(
        Lesson, on_delete=models.PROTECT, related_name="completions"
    )
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "lesson"), name="lesson_completion_unique"
            )
        ]
        indexes = [
            models.Index(fields=("user", "-completed_at")),
        ]

    def __str__(self) -> str:
        return f"user={self.user_id} lesson={self.lesson_id}"
