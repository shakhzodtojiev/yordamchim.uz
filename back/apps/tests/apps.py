from django.apps import AppConfig


class TestsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tests"
    label = "attestation"
    verbose_name = "Attestation Tests"
