from django.db import transaction
from rest_framework import serializers

from apps.personalization.models import Grade, Subject
from apps.personalization.serializers import GradeSerializer, SubjectSerializer
from apps.tests.models import Test, TopicPool

from .models import Course, Lesson, LessonCompletion, Module, ModuleLesson


def _relative_image_url(image_field) -> str | None:
    """Match presentations' convention — relative path; the frontend prepends
    the browser-facing base."""
    if not image_field:
        return None
    try:
        return image_field.url
    except ValueError:
        return None


# ---- Teacher-facing (read-only) ----


class TeacherLessonSerializer(serializers.ModelSerializer):
    """Lesson payload for the teacher viewer. Only exposes what's needed to
    render the player — no admin bookkeeping fields."""

    subject = SubjectSerializer(read_only=True)
    grade = GradeSerializer(read_only=True)
    video_file = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = (
            "id",
            "title",
            "description",
            "kind",
            "subject",
            "grade",
            "video_url",
            "video_file",
            "body",
            "test",
            "duration_seconds",
            "is_completed",
        )

    def get_video_file(self, obj: Lesson) -> str | None:
        return _relative_image_url(obj.video_file)

    def get_is_completed(self, obj: Lesson) -> bool:
        # Truth is the LessonCompletion row itself, not a per-course tree —
        # completion is global (a lesson finished anywhere counts everywhere).
        # Deep-links to /courses/B/lessons/L where L lives in Course A would
        # otherwise render "Tamom" and silently toggle-off on click.
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from .models import LessonCompletion
        return LessonCompletion.objects.filter(
            user=request.user, lesson=obj
        ).exists()


class TeacherLessonListItemSerializer(serializers.ModelSerializer):
    """Compact lesson shape used inside a course tree — no body/URL."""

    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = (
            "id",
            "title",
            "kind",
            "duration_seconds",
            "is_completed",
        )

    def get_is_completed(self, obj: Lesson) -> bool:
        completed_ids = self.context.get("completed_lesson_ids", set())
        return obj.id in completed_ids


class TeacherModuleSerializer(serializers.ModelSerializer):
    lessons = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ("id", "title", "order", "lessons")

    def get_lessons(self, obj: Module) -> list[dict]:
        # module_lessons is prefetched with select_related lesson in the view;
        # re-ordering is a no-op because the ORM applies its Meta.ordering.
        entries = obj.module_lessons.all()
        return TeacherLessonListItemSerializer(
            [entry.lesson for entry in entries],
            many=True,
            context=self.context,
        ).data


class TeacherCourseListSerializer(serializers.ModelSerializer):
    """List item shape — no nested modules, only aggregate counts."""

    subject = SubjectSerializer(read_only=True)
    grade = GradeSerializer(read_only=True)
    cover_image = serializers.SerializerMethodField()
    lesson_count = serializers.IntegerField(read_only=True)
    completed_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "grade",
            "quarter",
            "cover_image",
            "lesson_count",
            "completed_count",
            "created_at",
        )

    def get_cover_image(self, obj: Course) -> str | None:
        return _relative_image_url(obj.cover_image)


class TeacherCourseDetailSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    grade = GradeSerializer(read_only=True)
    cover_image = serializers.SerializerMethodField()
    modules = TeacherModuleSerializer(many=True, read_only=True)
    lesson_count = serializers.IntegerField(read_only=True)
    completed_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "grade",
            "quarter",
            "cover_image",
            "modules",
            "lesson_count",
            "completed_count",
            "created_at",
        )

    def get_cover_image(self, obj: Course) -> str | None:
        return _relative_image_url(obj.cover_image)


class LessonCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonCompletion
        fields = ("id", "lesson", "completed_at")


# ---- Admin-facing (CRUD) ----


class AdminLessonSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    grade = GradeSerializer(read_only=True)
    topic_pool_name = serializers.SerializerMethodField()

    subject_id = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), source="subject", write_only=True
    )
    grade_id = serializers.PrimaryKeyRelatedField(
        queryset=Grade.objects.all(), source="grade", write_only=True
    )
    topic_pool_id = serializers.PrimaryKeyRelatedField(
        queryset=TopicPool.objects.all(),
        source="topic_pool",
        write_only=True,
        required=False,
        allow_null=True,
    )
    test_id = serializers.PrimaryKeyRelatedField(
        queryset=Test.objects.all(),
        source="test",
        write_only=True,
        required=False,
        allow_null=True,
    )

    video_file = serializers.SerializerMethodField()
    video_file_upload = serializers.FileField(
        write_only=True, required=False, allow_null=True, source="video_file"
    )

    class Meta:
        model = Lesson
        fields = (
            "id",
            "title",
            "description",
            "kind",
            "subject",
            "grade",
            "topic_pool_name",
            "video_url",
            "video_file",
            "body",
            "test",
            "duration_seconds",
            "is_published",
            "created_at",
            "updated_at",
            # write-only
            "subject_id",
            "grade_id",
            "topic_pool_id",
            "test_id",
            "video_file_upload",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_topic_pool_name(self, obj: Lesson) -> str | None:
        return obj.topic_pool.title if obj.topic_pool else None

    def get_video_file(self, obj: Lesson) -> str | None:
        return _relative_image_url(obj.video_file)

    def validate(self, attrs):
        # Kind-specific requiredness: enforce here rather than at the DB layer
        # so admins get a friendly per-field error instead of an IntegrityError.
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        if kind == Lesson.Kind.VIDEO:
            has_url = attrs.get("video_url", getattr(self.instance, "video_url", ""))
            has_file = attrs.get(
                "video_file", getattr(self.instance, "video_file", None)
            )
            if not has_url and not has_file:
                raise serializers.ValidationError(
                    {"video_url": "Video URL yoki fayl kerak."}
                )
        elif kind == Lesson.Kind.TEXT:
            body = attrs.get("body", getattr(self.instance, "body", ""))
            if not body.strip():
                raise serializers.ValidationError({"body": "Matn kerak."})
        elif kind == Lesson.Kind.TEST:
            test = attrs.get("test", getattr(self.instance, "test", None))
            if test is None:
                raise serializers.ValidationError({"test_id": "Test tanlang."})

        # Kind change on PATCH must clear the previous kind's fields —
        # otherwise a video→text edit leaks video_url/video_file through
        # the read serializer to the teacher viewer.
        prev_kind = getattr(self.instance, "kind", None)
        if prev_kind and kind and prev_kind != kind:
            if kind != Lesson.Kind.VIDEO:
                attrs["video_url"] = ""
                # Capture the old file for post-commit deletion — deleting
                # inline would orphan the DB row (still pointing at the
                # blob path) if the save then fails downstream.
                if self.instance and self.instance.video_file:
                    old_file = self.instance.video_file
                    transaction.on_commit(lambda f=old_file: f.delete(save=False))
                attrs["video_file"] = None
                attrs["duration_seconds"] = None
            if kind != Lesson.Kind.TEXT:
                attrs["body"] = ""
            if kind != Lesson.Kind.TEST:
                attrs["test"] = None
        return attrs


class AdminModuleLessonSerializer(serializers.ModelSerializer):
    lesson = serializers.SerializerMethodField()
    lesson_id = serializers.PrimaryKeyRelatedField(
        queryset=Lesson.objects.all(), source="lesson", write_only=True
    )

    class Meta:
        model = ModuleLesson
        fields = ("id", "lesson", "lesson_id", "order")

    def get_lesson(self, obj: ModuleLesson) -> dict:
        lesson = obj.lesson
        return {
            "id": lesson.id,
            "title": lesson.title,
            "kind": lesson.kind,
            "duration_seconds": lesson.duration_seconds,
        }


class AdminModuleSerializer(serializers.ModelSerializer):
    lessons = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ("id", "title", "order", "lessons")
        # `order` is server-assigned on create (max+1) and reorderable via a
        # dedicated endpoint in Phase 3. Accepting it via generic PATCH would
        # let an admin set an already-taken value and hit the (course, order)
        # unique constraint as a 500.
        read_only_fields = ("order",)

    def get_lessons(self, obj: Module) -> list[dict]:
        return AdminModuleLessonSerializer(
            obj.module_lessons.all(), many=True
        ).data


class AdminCourseSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    grade = GradeSerializer(read_only=True)
    subject_id = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), source="subject", write_only=True
    )
    grade_id = serializers.PrimaryKeyRelatedField(
        queryset=Grade.objects.all(), source="grade", write_only=True
    )
    # ImageField's default output is an absolute URL built from the current
    # request's Host header — which becomes `http://backend:8000/...` when
    # Next.js RSC calls Django over the Docker net, and the browser can't
    # reach that host. Return a relative path instead so the frontend's
    # `absolutize()` can prepend the public base URL.
    cover_image = serializers.SerializerMethodField()
    cover_image_upload = serializers.ImageField(
        write_only=True, required=False, allow_null=True, source="cover_image"
    )
    modules = AdminModuleSerializer(many=True, read_only=True)
    lesson_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "grade",
            "subject_id",
            "grade_id",
            "quarter",
            "cover_image",
            "cover_image_upload",
            "is_published",
            "modules",
            "lesson_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_cover_image(self, obj: Course) -> str | None:
        return _relative_image_url(obj.cover_image)
