"""Optional .ppt/.pptx upload on Presentation. When set, the viewer uses an
Office Online iframe embed (animations + video preserved). When null, the
existing slide-image gallery is used."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("presentations", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="presentation",
            name="pptx_file",
            field=models.FileField(
                blank=True, null=True, upload_to="presentations/pptx/"
            ),
        ),
    ]
