"""A test can now reference multiple pools, each with its own per-difficulty
quotas. The single-pool fields on Test are replaced by a TestPool through
model.

Schema:
  - New TestPool(test, pool, order, easy_count, medium_count, hard_count)
  - Test loses: pool FK, easy_per_attempt, medium_per_attempt, hard_per_attempt

Data migration: every existing Test gets a single TestPool entry that
preserves its old (pool, counts) configuration."""

import django.db.models.deletion
from django.db import migrations, models


def copy_pool_to_testpool(apps, schema_editor):
    Test = apps.get_model("attestation", "Test")
    TestPool = apps.get_model("attestation", "TestPool")
    for test in Test.objects.all():
        if test.pool_id:
            TestPool.objects.create(
                test=test,
                pool_id=test.pool_id,
                order=1,
                easy_count=test.easy_per_attempt,
                medium_count=test.medium_per_attempt,
                hard_count=test.hard_per_attempt,
            )


def restore_pool_from_testpool(apps, schema_editor):
    Test = apps.get_model("attestation", "Test")
    for test in Test.objects.all():
        first = test.test_pools.order_by("order", "id").first()
        if first:
            test.pool_id = first.pool_id
            test.easy_per_attempt = first.easy_count
            test.medium_per_attempt = first.medium_count
            test.hard_per_attempt = first.hard_count
            test.save(
                update_fields=[
                    "pool",
                    "easy_per_attempt",
                    "medium_per_attempt",
                    "hard_per_attempt",
                ]
            )


class Migration(migrations.Migration):

    dependencies = [
        ("attestation", "0007_drop_test_grade"),
    ]

    operations = [
        # --- Create TestPool through model ---
        migrations.CreateModel(
            name="TestPool",
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
                ("order", models.PositiveIntegerField(default=1)),
                ("easy_count", models.PositiveIntegerField(default=0)),
                ("medium_count", models.PositiveIntegerField(default=0)),
                ("hard_count", models.PositiveIntegerField(default=0)),
                (
                    "test",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="test_pools",
                        to="attestation.test",
                    ),
                ),
                (
                    "pool",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="test_pools",
                        to="attestation.topicpool",
                    ),
                ),
            ],
            options={"ordering": ("order", "id")},
        ),
        migrations.AddConstraint(
            model_name="testpool",
            constraint=models.UniqueConstraint(
                fields=("test", "pool"), name="test_pool_unique"
            ),
        ),
        # --- Backfill existing tests into TestPool ---
        migrations.RunPython(
            copy_pool_to_testpool, reverse_code=restore_pool_from_testpool
        ),
        # --- Drop the now-redundant single-pool fields on Test ---
        migrations.RemoveIndex(
            model_name="test",
            name="attestation_pool_id_81e62e_idx",
        ),
        migrations.RemoveField(model_name="test", name="pool"),
        migrations.RemoveField(model_name="test", name="easy_per_attempt"),
        migrations.RemoveField(model_name="test", name="medium_per_attempt"),
        migrations.RemoveField(model_name="test", name="hard_per_attempt"),
    ]
