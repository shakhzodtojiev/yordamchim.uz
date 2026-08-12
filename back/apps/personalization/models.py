from django.conf import settings
from django.db import models


class Subject(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Grade(models.Model):
    name = models.CharField(max_length=40, unique=True)
    level = models.PositiveSmallIntegerField(unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("level",)

    def __str__(self) -> str:
        return self.name


class UserPreference(models.Model):
    """Per-user pivot of which subjects + grades a teacher works with.

    A single row links one user to one (subject, grade) pair, so the
    cross-product is explicit. This makes filtering presentations a single
    EXISTS join and lets us distinguish "teaches Math for grade 5" from
    "teaches Math for grade 11".
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preferences",
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="preferences"
    )
    grade = models.ForeignKey(
        Grade, on_delete=models.CASCADE, related_name="preferences"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "subject", "grade"),
                name="user_subject_grade_unique",
            )
        ]
        indexes = [
            models.Index(fields=("user",)),
            models.Index(fields=("subject", "grade")),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.subject_id}/{self.grade_id}"
