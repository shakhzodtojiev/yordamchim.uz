from django.contrib import admin

from .models import Grade, Subject, UserPreference


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("name", "level", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("level",)


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "subject", "grade", "created_at")
    list_filter = ("subject", "grade")
    autocomplete_fields = ("user", "subject", "grade")
    search_fields = ("user__email",)
