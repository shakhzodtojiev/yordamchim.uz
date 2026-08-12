"""Restructure tests: introduce TopicPool (mavzulashtirilgan to'plam) which
owns the questions, and have Test reference a pool. Tests gain a `kind`
(regular/mock) and an availability window for mocks.

Data migration: each existing Test becomes a TopicPool with the same title /
description / subject; its questions are reattached to the new pool; the Test
row itself is kept (preserving Attempt history) but rewired to point at the
new pool. Test.subject is dropped — subject now lives on the pool.
"""

import django.db.models.deletion
from django.db import migrations, models


def migrate_tests_to_pools(apps, schema_editor):
    Test = apps.get_model("attestation", "Test")
    Question = apps.get_model("attestation", "Question")
    TopicPool = apps.get_model("attestation", "TopicPool")

    for test in Test.objects.all():
        pool = TopicPool.objects.create(
            title=test.title,
            description=test.description,
            subject_id=test.subject_id,
            pool_type="oddiy",
        )
        Question.objects.filter(test_id=test.id).update(pool_id=pool.id)
        test.pool_id = pool.id
        test.save(update_fields=["pool"])


def revert_pools_to_tests(apps, schema_editor):
    Test = apps.get_model("attestation", "Test")
    Question = apps.get_model("attestation", "Question")
    TopicPool = apps.get_model("attestation", "TopicPool")

    for test in Test.objects.all():
        if test.pool_id:
            pool = TopicPool.objects.get(id=test.pool_id)
            test.subject_id = pool.subject_id
            test.save(update_fields=["subject"])
            Question.objects.filter(pool_id=pool.id).update(test_id=test.id)


class Migration(migrations.Migration):

    dependencies = [
        ("personalization", "0001_initial"),
        ("attestation", "0004_question_choice_pair_images"),
    ]

    operations = [
        # --- Create TopicPool ---
        migrations.CreateModel(
            name="TopicPool",
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
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                (
                    "pool_type",
                    models.CharField(
                        choices=[("oddiy", "Oddiy"), ("nazariy", "Nazariy")],
                        default="oddiy",
                        max_length=10,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "subject",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="topic_pools",
                        to="personalization.subject",
                    ),
                ),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddIndex(
            model_name="topicpool",
            index=models.Index(
                fields=["subject", "pool_type"], name="attestation_pool_subject_idx"
            ),
        ),
        # --- Add nullable pool FK on Test and Question (data migration fills) ---
        migrations.AddField(
            model_name="test",
            name="pool",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="tests",
                to="attestation.topicpool",
            ),
        ),
        migrations.AddField(
            model_name="question",
            name="pool",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="questions",
                to="attestation.topicpool",
            ),
        ),
        # --- Mock support on Test ---
        migrations.AddField(
            model_name="test",
            name="kind",
            field=models.CharField(
                choices=[("regular", "Regular"), ("mock", "Mock")],
                default="regular",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="test",
            name="available_from",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="test",
            name="available_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
        # --- Migrate existing data ---
        migrations.RunPython(migrate_tests_to_pools, reverse_code=revert_pools_to_tests),
        # --- Lock down: pool is required, drop old test FK on Question, drop
        # subject on Test ---
        migrations.AlterField(
            model_name="test",
            name="pool",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="tests",
                to="attestation.topicpool",
            ),
        ),
        migrations.AlterField(
            model_name="question",
            name="pool",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="questions",
                to="attestation.topicpool",
            ),
        ),
        # The old (test, order) unique constraint and (test, difficulty) index
        # were tied to Question.test — remove before dropping the FK.
        migrations.RemoveConstraint(
            model_name="question",
            name="question_order_unique",
        ),
        migrations.RemoveIndex(
            model_name="question",
            name="attestation_test_id_fc1226_idx",
        ),
        migrations.RemoveField(
            model_name="question",
            name="test",
        ),
        migrations.AddConstraint(
            model_name="question",
            constraint=models.UniqueConstraint(
                fields=("pool", "order"), name="question_order_unique"
            ),
        ),
        migrations.AddIndex(
            model_name="question",
            index=models.Index(
                fields=["pool", "difficulty"], name="attestation_pool_diff_idx"
            ),
        ),
        # Test.subject is now derived from pool.subject — drop it.
        migrations.RemoveIndex(
            model_name="test",
            name="attestation_subject_024d1e_idx",
        ),
        migrations.RemoveField(
            model_name="test",
            name="subject",
        ),
        migrations.AddIndex(
            model_name="test",
            index=models.Index(
                fields=["pool", "is_published"], name="attestation_test_pool_pub_idx"
            ),
        ),
    ]
