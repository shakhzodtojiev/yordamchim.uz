"""Telegram Mini App auth — link a User to a Telegram account so login can
happen via initData (HMAC-signed by the bot token) instead of email/password.
Email stays unique; Telegram-only signups receive a synthetic email."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_is_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="telegram_id",
            field=models.BigIntegerField(blank=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="user",
            name="telegram_username",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="user",
            name="telegram_first_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="user",
            name="telegram_photo_url",
            field=models.URLField(blank=True, max_length=500),
        ),
    ]
