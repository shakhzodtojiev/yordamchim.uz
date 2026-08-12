from rest_framework import serializers

from apps.personalization.models import Grade, Subject
from apps.personalization.serializers import GradeSerializer, SubjectSerializer

from .models import GenerationJob, Presentation, PresentationPurchase, Slide


def _relative_image_url(image_field) -> str | None:
    """Always return a relative path. Frontend prepends the public API base."""
    if not image_field:
        return None
    try:
        return image_field.url
    except ValueError:
        return None


class MarketplaceFieldsMixin:
    """Shared ownership/pricing fields for list + detail serializers."""

    def get_is_official(self, obj: Presentation) -> bool:
        return obj.is_official

    def get_author_name(self, obj: Presentation) -> str | None:
        if obj.author_id is None:
            return None
        return obj.author.full_name or obj.author.email

    def get_is_owned(self, obj: Presentation) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        if obj.author_id == user.id:
            return True
        # `marketplace_queryset` annotates this to avoid an N+1; fall back to a
        # direct lookup for endpoints that don't (e.g. detail).
        purchased = getattr(obj, "_purchased", None)
        if purchased is not None:
            return bool(purchased)
        return PresentationPurchase.objects.filter(
            buyer=user, presentation=obj
        ).exists()


class PresentationListSerializer(MarketplaceFieldsMixin, serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    grade = GradeSerializer(read_only=True)
    cover_image = serializers.SerializerMethodField()
    is_official = serializers.SerializerMethodField()
    is_owned = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Presentation
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "grade",
            "quarter",
            "cover_image",
            "slide_count",
            "view_count",
            "created_at",
            "price",
            "is_listed",
            "is_official",
            "is_owned",
            "author_name",
        )

    def get_cover_image(self, obj: Presentation) -> str | None:
        return _relative_image_url(obj.cover_image)


class SlideSignedSerializer(serializers.Serializer):
    """Slide payload returned to the viewer — no raw file path leaks."""

    id = serializers.IntegerField()
    order = serializers.IntegerField()
    width = serializers.IntegerField(allow_null=True)
    height = serializers.IntegerField(allow_null=True)
    image_url = serializers.CharField()
    expires_at = serializers.IntegerField()


class PresentationDetailSerializer(MarketplaceFieldsMixin, serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    grade = GradeSerializer(read_only=True)
    cover_image = serializers.SerializerMethodField()
    slides = serializers.SerializerMethodField()
    is_official = serializers.SerializerMethodField()
    is_owned = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Presentation
        fields = (
            "id",
            "title",
            "description",
            "subject",
            "grade",
            "quarter",
            "cover_image",
            "slide_count",
            "view_count",
            "created_at",
            "price",
            "is_listed",
            "is_official",
            "is_owned",
            "is_locked",
            "author_name",
            "slides",
        )

    def get_cover_image(self, obj: Presentation) -> str | None:
        return _relative_image_url(obj.cover_image)

    def get_is_locked(self, obj: Presentation) -> bool:
        # Set by the detail view: a listed teacher deck the caller hasn't
        # bought yet. The buy screen renders off this instead of slides.
        return bool(self.context.get("locked"))

    def get_slides(self, presentation: Presentation) -> list[dict]:
        # Locked (un-purchased) decks never leak slide URLs.
        if self.context.get("locked"):
            return []
        # Admin-uploaded .pptx files are server-side rasterised into Slide
        # rows before the viewer ever sees the deck — see
        # apps.presentations.conversion. The raw .pptx is deleted after the
        # conversion, so the public API has no way to expose it. End-users
        # only ever fetch signed, short-lived PNG URLs.
        from .signing import build_signed_url

        request = self.context.get("request")
        user = request.user if request is not None else None
        out = []
        for slide in presentation.slides.all():
            image_url, expires_at = build_signed_url(slide, user)
            out.append(
                {
                    "id": slide.id,
                    "order": slide.order,
                    "width": slide.width,
                    "height": slide.height,
                    "image_url": image_url,
                    "expires_at": expires_at,
                }
            )
        return out


class SlideUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Slide
        fields = ("id", "presentation", "order", "image", "width", "height")


class GenerationJobSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = GenerationJob
        fields = (
            "id",
            "topic",
            "num_slides",
            "quarter",
            "status",
            "status_display",
            "presentation",
            "model_used",
            "error",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class GenerationRequestSerializer(serializers.Serializer):
    """Validates a generate request. subject/grade are ids the caller must
    have as a preference (enforced in the view)."""

    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    grade = serializers.PrimaryKeyRelatedField(queryset=Grade.objects.all())
    topic = serializers.CharField(max_length=200)
    num_slides = serializers.IntegerField(min_value=3, max_value=20, default=10)
    quarter = serializers.IntegerField(
        min_value=1, max_value=4, required=False, allow_null=True
    )
    price = serializers.IntegerField(min_value=0, required=False)
    is_listed = serializers.BooleanField(default=False)
