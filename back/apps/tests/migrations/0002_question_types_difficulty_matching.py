"""Add question types (single/multi/matching) and difficulty (easy/medium/hard).

Schema changes:
  - Test gains `easy_per_attempt`, `medium_per_attempt`, `hard_per_attempt`
    (default 10 each) — drives the random per-attempt subset selection.
  - Question gains `question_type` (default `single`) and `difficulty`
    (default `medium`).
  - New MatchPair model — pairs for matching-type questions.
  - New AttemptQuestion through model — materializes the random subset for
    each attempt so refresh/resume keeps the same questions.
  - Answer.choice (FK) is replaced by `selected_choices` (M2M) so multi-choice
    answers can hold N picks. `match_payload` (JSON) holds left↔right pairs
    for matching answers.

Data migration: existing single-choice answers' `choice` is copied into the
new `selected_choices` M2M before the old column is dropped.
"""

import django.db.models.deletion
from django.db import migrations, models


def copy_choice_to_selected(apps, schema_editor):
    Answer = apps.get_model("attestation", "Answer")
    for answer in Answer.objects.all().iterator():
        if answer.choice_id:
            answer.selected_choices.add(answer.choice_id)


def restore_choice_from_selected(apps, schema_editor):
    Answer = apps.get_model("attestation", "Answer")
    for answer in Answer.objects.all().iterator():
        first = answer.selected_choices.order_by("id").first()
        if first is not None:
            answer.choice_id = first.id
            answer.save(update_fields=["choice"])


class Migration(migrations.Migration):

    dependencies = [
        ("attestation", "0001_initial"),
    ]

    operations = [
        # --- Test: per-attempt difficulty bucket counts ---
        migrations.AddField(
            model_name="test",
            name="easy_per_attempt",
            field=models.PositiveIntegerField(default=10),
        ),
        migrations.AddField(
            model_name="test",
            name="medium_per_attempt",
            field=models.PositiveIntegerField(default=10),
        ),
        migrations.AddField(
            model_name="test",
            name="hard_per_attempt",
            field=models.PositiveIntegerField(default=10),
        ),
        # --- Question: type and difficulty ---
        migrations.AddField(
            model_name="question",
            name="question_type",
            field=models.CharField(
                choices=[
                    ("single", "Single choice"),
                    ("multi", "Multi choice"),
                    ("matching", "Matching"),
                ],
                default="single",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="question",
            name="difficulty",
            field=models.CharField(
                choices=[
                    ("easy", "Easy"),
                    ("medium", "Medium"),
                    ("hard", "Hard"),
                ],
                default="medium",
                max_length=8,
            ),
        ),
        migrations.AddIndex(
            model_name="question",
            index=models.Index(
                fields=["test", "difficulty"],
                name="attestation_test_id_diff_idx",
            ),
        ),
        # --- MatchPair (for matching questions) ---
        migrations.CreateModel(
            name="MatchPair",
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
                ("order", models.PositiveSmallIntegerField()),
                ("left_text", models.CharField(max_length=400)),
                ("right_text", models.CharField(max_length=400)),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pairs",
                        to="attestation.question",
                    ),
                ),
            ],
            options={"ordering": ("order",)},
        ),
        migrations.AddConstraint(
            model_name="matchpair",
            constraint=models.UniqueConstraint(
                fields=("question", "order"), name="pair_order_unique"
            ),
        ),
        # --- AttemptQuestion (materialized random subset) ---
        migrations.CreateModel(
            name="AttemptQuestion",
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
                ("order", models.PositiveIntegerField()),
                (
                    "attempt",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attempt_questions",
                        to="attestation.attempt",
                    ),
                ),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to="attestation.question",
                    ),
                ),
            ],
            options={"ordering": ("order",)},
        ),
        migrations.AddConstraint(
            model_name="attemptquestion",
            constraint=models.UniqueConstraint(
                fields=("attempt", "question"), name="attempt_question_unique"
            ),
        ),
        migrations.AddConstraint(
            model_name="attemptquestion",
            constraint=models.UniqueConstraint(
                fields=("attempt", "order"), name="attempt_question_order_unique"
            ),
        ),
        # --- Answer: M2M selected_choices + match_payload, drop choice FK ---
        migrations.AddField(
            model_name="answer",
            name="selected_choices",
            field=models.ManyToManyField(
                blank=True, related_name="multi_answers", to="attestation.choice"
            ),
        ),
        migrations.AddField(
            model_name="answer",
            name="match_payload",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(
            copy_choice_to_selected, reverse_code=restore_choice_from_selected
        ),
        migrations.RemoveField(
            model_name="answer",
            name="choice",
        ),
        migrations.AlterField(
            model_name="answer",
            name="selected_choices",
            field=models.ManyToManyField(
                blank=True, related_name="answers", to="attestation.choice"
            ),
        ),
    ]
