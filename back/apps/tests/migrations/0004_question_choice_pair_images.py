"""Optional images on Question, Choice, and MatchPair (left + right).

Text fields are also relaxed to `blank=True` so an admin can ship a question
made entirely of images. Existing rows already have non-empty text, so no
data migration is needed.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "attestation",
            "0003_rename_attestation_test_id_diff_idx_attestation_test_id_fc1226_idx",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="question",
            name="image",
            field=models.ImageField(blank=True, null=True, upload_to="questions/q/"),
        ),
        migrations.AlterField(
            model_name="question",
            name="text",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="choice",
            name="image",
            field=models.ImageField(blank=True, null=True, upload_to="questions/c/"),
        ),
        migrations.AlterField(
            model_name="choice",
            name="text",
            field=models.CharField(blank=True, max_length=400),
        ),
        migrations.AddField(
            model_name="matchpair",
            name="left_image",
            field=models.ImageField(blank=True, null=True, upload_to="questions/p/"),
        ),
        migrations.AddField(
            model_name="matchpair",
            name="right_image",
            field=models.ImageField(blank=True, null=True, upload_to="questions/p/"),
        ),
        migrations.AlterField(
            model_name="matchpair",
            name="left_text",
            field=models.CharField(blank=True, max_length=400),
        ),
        migrations.AlterField(
            model_name="matchpair",
            name="right_text",
            field=models.CharField(blank=True, max_length=400),
        ),
    ]
