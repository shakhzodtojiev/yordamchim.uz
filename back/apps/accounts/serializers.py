from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from apps.personalization.models import Grade, Subject, UserPreference

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Single-step signup: account + subject/grade preferences set together.

    Teachers must pick at least one subject AND one grade — the app's
    personalization is strict, so an account with no scope can't see content.
    Once registered, the preferences are locked (see PreferencesView.put).
    """

    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password], min_length=8
    )
    subjects = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        allow_empty=False,
    )
    grades = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        allow_empty=False,
    )

    class Meta:
        model = User
        fields = ("email", "full_name", "password", "subjects", "grades")

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

    @transaction.atomic
    def create(self, validated_data):
        subjects = validated_data.pop("subjects")
        grades = validated_data.pop("grades")
        user = User.objects.create_user(**validated_data)
        UserPreference.objects.bulk_create(
            [
                UserPreference(user=user, subject_id=s, grade_id=g)
                for s in subjects
                for g in grades
            ]
        )
        user.has_completed_onboarding = True
        user.save(update_fields=["has_completed_onboarding"])
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"],
            password=attrs["password"],
        )
        if not user or not user.is_active:
            raise serializers.ValidationError(
                {"detail": "Invalid email or password."}
            )
        attrs["user"] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(read_only=True)
    can_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "has_completed_onboarding",
            "is_admin",
            "is_superuser",
            "can_admin",
            "role",
        )
        read_only_fields = fields


def issue_token_pair(user) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}
