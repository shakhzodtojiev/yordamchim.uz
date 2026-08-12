"""Teachers can raise objections about specific questions (wrong answer,
typo, unclear wording, etc.) either during a test or after submission.
Admins triage them via the admin objections page."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attestation", "0009_test_pools"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="QuestionObjection",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "reason",
                    models.CharField(
                        choices=[
                            ("wrong_answer", "Noto'g'ri javob"),
                            ("wrong_question", "Noto'g'ri savol"),
                            ("typo", "Imloviy xato"),
                            ("unclear", "Tushunarsiz"),
                            ("other", "Boshqa"),
                        ],
                        default="other",
                        max_length=20,
                    ),
                ),
                ("body", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Ko'rib chiqilmoqda"),
                            ("resolved", "Hal qilindi"),
                            ("rejected", "Rad etildi"),
                        ],
                        default="pending",
                        max_length=10,
                    ),
                ),
                ("admin_note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="objections",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="objections",
                        to="attestation.question",
                    ),
                ),
                (
                    "attempt",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="objections",
                        to="attestation.attempt",
                    ),
                ),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddIndex(
            model_name="questionobjection",
            index=models.Index(
                fields=["status", "-created_at"],
                name="objection_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="questionobjection",
            index=models.Index(
                fields=["user", "-created_at"],
                name="objection_user_idx",
            ),
        ),
    ]
