from django.contrib import admin

from .models import Course, Lesson, LessonCompletion, Module, ModuleLesson


class ModuleLessonInline(admin.TabularInline):
    model = ModuleLesson
    extra = 0
    fields = ("order", "lesson")
    autocomplete_fields = ("lesson",)
    ordering = ("order",)


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 0
    fields = ("order", "title")
    ordering = ("order",)
    show_change_link = True


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "subject",
        "grade",
        "quarter",
        "is_published",
        "created_at",
    )
    list_filter = ("subject", "grade", "quarter", "is_published")
    search_fields = ("title", "description")
    autocomplete_fields = ("subject", "grade")
    inlines = [ModuleInline]
    readonly_fields = ("created_at", "updated_at")


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "order")
    list_filter = ("course",)
    search_fields = ("title",)
    autocomplete_fields = ("course",)
    inlines = [ModuleLessonInline]
    ordering = ("course", "order")


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "kind",
        "subject",
        "grade",
        "topic_pool",
        "is_published",
        "created_at",
    )
    list_filter = ("kind", "subject", "grade", "is_published")
    search_fields = ("title", "description")
    autocomplete_fields = ("subject", "grade", "topic_pool", "test")
    readonly_fields = ("created_at", "updated_at")


@admin.register(LessonCompletion)
class LessonCompletionAdmin(admin.ModelAdmin):
    """Read-only view — progress is user-owned; edits from staff would
    silently rewrite a teacher's own tracking."""

    list_display = ("user", "lesson", "completed_at")
    list_filter = ("completed_at",)
    autocomplete_fields = ("user", "lesson")
    readonly_fields = ("user", "lesson", "completed_at")

    def has_add_permission(self, request):
        return False
