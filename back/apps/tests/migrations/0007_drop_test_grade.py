"""Drop Test.grade — tests are now grade-agnostic since teachers prepare for
the general subject exam rather than per-grade content.

UserPreference.grade and Presentation.grade are unaffected (those still
filter teacher-facing content)."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("attestation", "0006_rename_attestation_pool_diff_idx_attestation_pool_id_12cac1_idx_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="test",
            name="grade",
        ),
    ]
