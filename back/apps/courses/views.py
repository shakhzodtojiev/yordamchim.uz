from django.db import transaction
from django.db.models import Count, Exists, Max, OuterRef, Prefetch, Q
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, parsers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrSuperuser
from apps.personalization.models import UserPreference

from .models import Course, Lesson, LessonCompletion, Module, ModuleLesson
from .serializers import (
    AdminCourseSerializer,
    AdminLessonSerializer,
    AdminModuleLessonSerializer,
    AdminModuleSerializer,
    LessonCompletionSerializer,
    TeacherCourseDetailSerializer,
    TeacherCourseListSerializer,
    TeacherLessonSerializer,
)


# ---- Teacher views ------------------------------------------------------


def _is_admin(user) -> bool:
    """Custom admin role OR Django superuser — matches HasMatchingPreference
    in the presentations app."""
    return bool(user.is_superuser or getattr(user, "is_admin", False))


def _personalized_course_queryset(user, *, bypass_for_admin: bool = False):
    """Courses whose (subject, grade) match a user preference. Mirrors the
    presentations app — teachers see only what they subscribed to.

    `bypass_for_admin=True` lets admins see any published course — used by
    detail/lesson/complete views so the "Ko'rib chiqish" button on
    /admin/courses/<id> works even when the admin's own personalization
    doesn't cover the course's subject×grade pair. Kept off for the list
    view to match presentations' scoping ergonomics."""
    base = Course.objects.filter(is_published=True).select_related(
        "subject", "grade"
    )
    if bypass_for_admin and _is_admin(user):
        return base
    matches = UserPreference.objects.filter(
        user=user,
        subject_id=OuterRef("subject_id"),
        grade_id=OuterRef("grade_id"),
    )
    return (
        base.annotate(_match=Exists(matches))
        .filter(_match=True)
    )


def _annotate_progress(queryset, user):
    """Attach lesson_count + completed_count to each Course row so the
    teacher list can render progress without an N+1.

    Both counts are DISTINCT on lesson_id so a lesson attached to multiple
    modules of the same course only counts once — otherwise a user who
    finished it would see e.g. 1/2 instead of 1/1."""
    return queryset.annotate(
        lesson_count=Count(
            "modules__module_lessons__lesson",
            distinct=True,
        ),
        completed_count=Count(
            "modules__module_lessons__lesson",
            filter=Q(modules__module_lessons__lesson__completions__user=user),
            distinct=True,
        ),
    )


class CourseListView(generics.ListAPIView):
    """Teacher-facing course list. Personalization + optional filters."""

    serializer_class = TeacherCourseListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("subject", "grade", "quarter")
    search_fields = ("title", "description")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = _personalized_course_queryset(self.request.user)
        return _annotate_progress(qs, self.request.user)


class CourseDetailView(generics.RetrieveAPIView):
    """Course with modules + lessons + per-user completion state."""

    serializer_class = TeacherCourseDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Personalization gate — bypassed for admins so the "Ko'rib chiqish"
        # button on /admin/courses/<id> works even when the admin's own
        # preferences don't cover the course's subject × grade pair.
        qs = _personalized_course_queryset(
            self.request.user, bypass_for_admin=True
        )
        return _annotate_progress(qs, self.request.user).prefetch_related(
            Prefetch(
                "modules",
                queryset=Module.objects.prefetch_related(
                    Prefetch(
                        "module_lessons",
                        queryset=ModuleLesson.objects.select_related("lesson"),
                    )
                ),
            )
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # Pre-load completion ids into a set so nested serializers can look
        # up is_completed in O(1) without hitting the DB per lesson. Scoped
        # to lessons reachable from the requested course only.
        pk = self.kwargs.get("pk")
        ctx["completed_lesson_ids"] = set(
            LessonCompletion.objects.filter(
                user=self.request.user,
                lesson__module_links__module__course_id=pk,
            ).values_list("lesson_id", flat=True)
        )
        return ctx


class LessonDetailView(generics.RetrieveAPIView):
    """Lesson content for playback. Gated by the teacher's personalization —
    a lesson is reachable only if it lives in a module of a course whose
    (subject, grade) matches one of the user's UserPreference rows.
    Prevents ID-guessing across subjects the teacher didn't subscribe to."""

    serializer_class = TeacherLessonSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Same admin bypass as CourseDetailView — an admin previewing a
        # lesson from /admin/courses/<id> must reach the player even when
        # their own preferences don't intersect the parent course.
        allowed_courses = _personalized_course_queryset(
            self.request.user, bypass_for_admin=True
        )
        return (
            Lesson.objects.filter(
                is_published=True,
                module_links__module__course__in=allowed_courses,
            )
            .select_related("subject", "grade", "test")
            .distinct()
        )


class LessonCompleteView(APIView):
    """Toggle completion state for a lesson. Idempotent per direction.

    The gate is one-sided on purpose:
      - CREATE checks personalization + publish state so a teacher can't
        poison their progress with arbitrary lesson IDs (would leak into
        the Phase 3 recommendation feed).
      - DELETE looks the row up directly by (user, lesson_id). If admin
        unpublishes the course between complete and uncomplete, the user
        can still remove their own mark; otherwise the row would be
        trapped and re-publishing would flip the toggle backwards from
        the user's perspective.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id: int):
        existing = LessonCompletion.objects.filter(
            user=request.user, lesson_id=lesson_id
        ).first()
        if existing:
            existing.delete()
            return Response(
                {"is_completed": False}, status=status.HTTP_200_OK
            )

        allowed_courses = _personalized_course_queryset(
            request.user, bypass_for_admin=True
        )
        lesson = get_object_or_404(
            Lesson.objects.filter(
                is_published=True,
                module_links__module__course__in=allowed_courses,
            ).distinct(),
            pk=lesson_id,
        )
        # get_or_create + atomic keeps concurrent double-clicks safe — the
        # UniqueConstraint(user, lesson) would otherwise raise IntegrityError
        # on a naive SELECT-then-INSERT race.
        with transaction.atomic():
            completion, created = LessonCompletion.objects.get_or_create(
                user=request.user, lesson=lesson
            )
            if not created:
                # Lost race — another request created it first. Idempotent
                # semantics: report the current state as "completed".
                return Response(
                    LessonCompletionSerializer(completion).data,
                    status=status.HTTP_200_OK,
                )
        return Response(
            LessonCompletionSerializer(completion).data,
            status=status.HTTP_201_CREATED,
        )


# ---- Admin views --------------------------------------------------------


class AdminLessonListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminLessonSerializer
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("subject", "grade", "kind", "topic_pool", "is_published")
    search_fields = ("title", "description")
    ordering_fields = ("created_at", "title")
    ordering = ("-created_at",)

    def get_queryset(self):
        return Lesson.objects.select_related(
            "subject", "grade", "topic_pool", "test"
        ).all()


class AdminLessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminLessonSerializer
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_queryset(self):
        return Lesson.objects.select_related(
            "subject", "grade", "topic_pool", "test"
        ).all()

    @transaction.atomic
    def perform_update(self, serializer):
        # The serializer's validate() defers old-video-file deletion via
        # transaction.on_commit — but on_commit only actually defers when
        # a transaction is open. Without this atomic wrapper we'd be in
        # autocommit mode and the callback would fire inline, defeating
        # the point (file gone even if the subsequent save fails).
        serializer.save()

    def perform_destroy(self, instance):
        # Two PROTECT FKs point at Lesson:
        #   - ModuleLesson.lesson  (a course still needs it)
        #   - LessonCompletion.lesson (a teacher's progress record depends on it)
        # Translate the raw ProtectedError into a friendly 400 pointing at
        # the actual blocker(s) so admins know what to unwire.
        try:
            instance.delete()
        except ProtectedError as exc:
            from rest_framework.exceptions import ValidationError

            protectors = {
                type(obj)._meta.label for obj in exc.protected_objects
            }
            if "courses.ModuleLesson" in protectors:
                msg = (
                    "Dars kurs modullarida ishlatilmoqda. Avval o'sha "
                    "modullardan olib tashlang."
                )
            elif "courses.LessonCompletion" in protectors:
                msg = (
                    "Bu dars foydalanuvchilar tomonidan tugatilgan deb "
                    "belgilangan. O'chirish uchun avval progress "
                    "yozuvlarini tozalash kerak."
                )
            else:
                msg = "Bu darsni o'chirib bo'lmaydi — bog'liq yozuvlar bor."
            raise ValidationError(msg) from exc


class AdminCourseListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminCourseSerializer
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("subject", "grade", "quarter", "is_published")
    search_fields = ("title", "description")
    ordering_fields = ("created_at", "title")
    ordering = ("-created_at",)

    def get_queryset(self):
        return (
            Course.objects.select_related("subject", "grade")
            .prefetch_related(
                Prefetch(
                    "modules",
                    queryset=Module.objects.prefetch_related(
                        Prefetch(
                            "module_lessons",
                            queryset=ModuleLesson.objects.select_related("lesson"),
                        )
                    ),
                )
            )
            .annotate(
                lesson_count=Count(
                    "modules__module_lessons__lesson", distinct=True
                )
            )
        )


class AdminCourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminCourseSerializer
    permission_classes = [IsAdminOrSuperuser]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_queryset(self):
        return (
            Course.objects.select_related("subject", "grade")
            .prefetch_related(
                Prefetch(
                    "modules",
                    queryset=Module.objects.prefetch_related(
                        Prefetch(
                            "module_lessons",
                            queryset=ModuleLesson.objects.select_related("lesson"),
                        )
                    ),
                )
            )
            .annotate(
                lesson_count=Count(
                    "modules__module_lessons__lesson", distinct=True
                )
            )
        )


class AdminModuleCreateView(APIView):
    """POST /admin/courses/{course_id}/modules/ — create a module."""

    permission_classes = [IsAdminOrSuperuser]

    def post(self, request, course_id: int):
        course = get_object_or_404(Course, pk=course_id)
        title = (request.data.get("title") or "").strip()
        if not title:
            return Response({"detail": "Sarlavha kerak."}, status=400)
        if len(title) > Module._meta.get_field("title").max_length:
            return Response({"detail": "Sarlavha juda uzun."}, status=400)
        # max(order)+1 must run under select_for_update on the parent Course
        # so two concurrent creates don't both compute the same "next" and
        # trip the (course, order) unique constraint with a 500.
        with transaction.atomic():
            Course.objects.select_for_update().filter(pk=course.pk).exists()
            current_max = course.modules.aggregate(m=Max("order"))["m"] or 0
            module = Module.objects.create(
                course=course, title=title, order=current_max + 1
            )
        return Response(AdminModuleSerializer(module).data, status=201)


class AdminModuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminModuleSerializer
    permission_classes = [IsAdminOrSuperuser]

    def get_queryset(self):
        return Module.objects.prefetch_related(
            Prefetch(
                "module_lessons",
                queryset=ModuleLesson.objects.select_related("lesson"),
            )
        )


class AdminModuleLessonCreateView(APIView):
    """POST /admin/modules/{module_id}/lessons/ — attach an existing lesson."""

    permission_classes = [IsAdminOrSuperuser]

    def post(self, request, module_id: int):
        module = get_object_or_404(Module, pk=module_id)
        raw = request.data.get("lesson_id")
        try:
            lesson_id = int(raw) if raw is not None else None
        except (TypeError, ValueError):
            return Response({"detail": "lesson_id noto'g'ri."}, status=400)
        if lesson_id is None:
            return Response({"detail": "lesson_id kerak."}, status=400)
        try:
            lesson = Lesson.objects.get(pk=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"detail": "Dars topilmadi."}, status=404)
        # Lock the parent Module row so concurrent attaches compute the same
        # max(order) sequentially — otherwise both land on the same order
        # and one 500s on the (module, order) unique constraint.
        with transaction.atomic():
            Module.objects.select_for_update().filter(pk=module.pk).exists()
            if ModuleLesson.objects.filter(
                module=module, lesson=lesson
            ).exists():
                return Response(
                    {"detail": "Bu dars allaqachon shu modulda."}, status=400
                )
            current_max = module.module_lessons.aggregate(
                m=Max("order")
            )["m"] or 0
            link = ModuleLesson.objects.create(
                module=module, lesson=lesson, order=current_max + 1
            )
        return Response(AdminModuleLessonSerializer(link).data, status=201)


class AdminModuleLessonDetailView(generics.DestroyAPIView):
    """Detach a lesson from a module. The Lesson row itself stays."""

    permission_classes = [IsAdminOrSuperuser]
    queryset = ModuleLesson.objects.all()


