from django.db import transaction
from rest_framework import serializers

from .models import Grade, Subject, UserPreference


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ("id", "name", "slug")


class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ("id", "name", "level")


class PreferencesReadSerializer(serializers.Serializer):
    """Returns the user's chosen subjects and grades as flat ID lists."""

    subjects = serializers.SerializerMethodField()
    grades = serializers.SerializerMethodField()

    def get_subjects(self, user) -> list[int]:
        return list(
            user.preferences.values_list("subject_id", flat=True).distinct()
        )

    def get_grades(self, user) -> list[int]:
        return list(
            user.preferences.values_list("grade_id", flat=True).distinct()
        )


class PreferencesWriteSerializer(serializers.Serializer):
    """Replaces the user's preferences with the cross-product of the inputs."""

    subjects = serializers.ListField(
        child=serializers.IntegerField(min_value=1), allow_empty=False
    )
    grades = serializers.ListField(
        child=serializers.IntegerField(min_value=1), allow_empty=False
    )

    def validate_subjects(self, value):
        ids = set(value)
        existing = set(
            Subject.objects.filter(id__in=ids, is_active=True).values_list(
                "id", flat=True
            )
        )
        missing = ids - existing
        if missing:
            raise serializers.ValidationError(
                f"Unknown subject id(s): {sorted(missing)}"
            )
        return list(ids)

    def validate_grades(self, value):
        ids = set(value)
        existing = set(
            Grade.objects.filter(id__in=ids, is_active=True).values_list(
                "id", flat=True
            )
        )
        missing = ids - existing
        if missing:
            raise serializers.ValidationError(
                f"Unknown grade id(s): {sorted(missing)}"
            )
        return list(ids)

    def save(self, *, user):
        subjects = self.validated_data["subjects"]
        grades = self.validated_data["grades"]

        with transaction.atomic():
            UserPreference.objects.filter(user=user).delete()
            UserPreference.objects.bulk_create(
                [
                    UserPreference(user=user, subject_id=s, grade_id=g)
                    for s in subjects
                    for g in grades
                ]
            )
            if not user.has_completed_onboarding:
                user.has_completed_onboarding = True
                user.save(update_fields=["has_completed_onboarding"])
        return user
