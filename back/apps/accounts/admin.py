from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("-date_joined",)
    list_display = (
        "email",
        "full_name",
        "role_display",
        "has_completed_onboarding",
    )
    list_filter = ("is_admin", "is_staff", "is_superuser", "is_active")
    search_fields = ("email", "full_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "has_completed_onboarding")}),
        (
            "Roles",
            {
                "fields": ("is_admin",),
                "description": (
                    "<b>is_admin</b> — custom admin paneliga kirish (kontent, "
                    "o'qituvchilarni nazorat qilish). Bu Django superuser emas."
                ),
            },
        ),
        (
            "Django access",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
                "description": (
                    "<b>is_staff</b> & <b>is_superuser</b> — Django admin (/admin/) "
                    "uchun. Faqat superadminlarga yoqing."
                ),
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "password1", "password2", "is_admin"),
            },
        ),
    )
    readonly_fields = ("date_joined", "last_login")

    def role_display(self, obj: User) -> str:
        return obj.role
    role_display.short_description = "Rol"
