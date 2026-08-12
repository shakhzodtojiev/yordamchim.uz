from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=120, blank=True)

    is_active = models.BooleanField(default=True)
    # `is_staff` controls Django admin (/admin/) access — kept only for true
    # superadmins. Custom admin panel access uses `is_admin` instead.
    is_staff = models.BooleanField(default=False)
    # Custom admin panel role — content + teacher monitoring, but no Django
    # admin / shell privileges.
    is_admin = models.BooleanField(default=False)

    # True once the user has picked at least one subject AND one grade.
    # Stored on the user (not derived) so middleware/auth checks stay fast.
    has_completed_onboarding = models.BooleanField(default=False)

    # Telegram link — populated when the user signs in via Telegram Mini App.
    # Email-only users keep these null; Telegram-only users get a synthetic
    # email (`tg-<telegram_id>@noreply.yordamchim.local`) at create time so the
    # NOT-NULL email constraint stays satisfied without leaking PII.
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    telegram_username = models.CharField(max_length=64, blank=True)
    telegram_first_name = models.CharField(max_length=120, blank=True)
    telegram_photo_url = models.URLField(max_length=500, blank=True)

    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        ordering = ("-date_joined",)

    def __str__(self) -> str:
        return self.email

    @property
    def can_admin(self) -> bool:
        """May access the custom admin panel."""
        return bool(self.is_admin or self.is_superuser)

    @property
    def role(self) -> str:
        """Role label used in the API + admin UI (read-only)."""
        if self.is_superuser:
            return "superadmin"
        if self.is_admin:
            return "admin"
        return "teacher"
