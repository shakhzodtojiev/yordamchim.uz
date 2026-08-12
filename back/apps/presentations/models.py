from django.db import models

from apps.personalization.models import Grade, Subject


def slide_upload_path(instance: "Slide", filename: str) -> str:
    return f"presentations/{instance.presentation_id}/slides/{instance.order:04d}_{filename}"


class Presentation(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    subject = models.ForeignKey(
        Subject, on_delete=models.PROTECT, related_name="presentations"
    )
    grade = models.ForeignKey(
        Grade, on_delete=models.PROTECT, related_name="presentations"
    )
    # Marketplace ownership. null == official/platform content (free, visible
    # to anyone with a matching subject+grade preference, as it always was).
    # A set author == teacher-generated content that must be purchased to view.
    # PROTECT: an author with published/sold decks can't be silently deleted
    # out from under buyers who paid for them.
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="authored_presentations",
        null=True,
        blank=True,
    )
    # Sale price in so'm. Ignored for official decks (author is null → free).
    price = models.PositiveIntegerField(default=0)
    # Teacher decks only: has the author put it on the marketplace for others
    # to buy? Unlisted decks stay private to the author. Official decks ignore
    # this flag (always visible + free).
    is_listed = models.BooleanField(default=False)
    # Academic quarter (1..4). Optional — universal materials that don't
    # belong to a specific quarter (e.g. reference decks) leave it null.
    quarter = models.PositiveSmallIntegerField(
        choices=[(1, "1"), (2, "2"), (3, "3"), (4, "4")],
        null=True,
        blank=True,
    )
    cover_image = models.ImageField(
        upload_to="presentations/covers/", blank=True, null=True
    )
    # Optional native .ppt/.pptx file. When present, the viewer embeds Office
    # Online iframe (animations + video preserved). When null, falls back to
    # the slide-image gallery.
    pptx_file = models.FileField(
        upload_to="presentations/pptx/", blank=True, null=True
    )
    slide_count = models.PositiveIntegerField(default=0)
    view_count = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("subject", "grade")),
            models.Index(fields=("is_published", "-created_at")),
            models.Index(fields=("author", "-created_at")),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def is_official(self) -> bool:
        """Platform-provided content — free, not part of the marketplace."""
        return self.author_id is None


class Slide(models.Model):
    presentation = models.ForeignKey(
        Presentation, on_delete=models.CASCADE, related_name="slides"
    )
    order = models.PositiveIntegerField()
    image = models.ImageField(upload_to=slide_upload_path)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=("presentation", "order"), name="slide_order_unique"
            )
        ]

    def __str__(self) -> str:
        return f"{self.presentation_id}#{self.order}"


class PresentationPurchase(models.Model):
    """A teacher's one-time purchase of another teacher's deck. Grants
    permanent view access. The money movement itself is recorded in the
    wallet ledger; this row is the access grant + a denormalised receipt."""

    buyer = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="presentation_purchases"
    )
    # PROTECT: a deck that has been sold can't be deleted — buyers keep it.
    presentation = models.ForeignKey(
        Presentation, on_delete=models.PROTECT, related_name="purchases"
    )
    price_paid = models.PositiveIntegerField()
    commission = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("buyer", "presentation"), name="unique_presentation_purchase"
            )
        ]
        indexes = [models.Index(fields=("buyer", "-created_at"))]

    def __str__(self) -> str:
        return f"{self.buyer_id} bought {self.presentation_id}"


class GenerationJob(models.Model):
    """A teacher's request to generate a deck via OmniRoute. Tracks the async
    lifecycle; on success `presentation` is populated with the finished deck."""

    class Status(models.TextChoices):
        PENDING = "pending", "Navbatda"
        PROCESSING = "processing", "Ishlanmoqda"
        DONE = "done", "Tayyor"
        FAILED = "failed", "Xatolik"

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="generation_jobs"
    )
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="+")
    grade = models.ForeignKey(Grade, on_delete=models.PROTECT, related_name="+")
    quarter = models.PositiveSmallIntegerField(null=True, blank=True)
    topic = models.CharField(max_length=200)
    num_slides = models.PositiveSmallIntegerField(default=10)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )
    # Set once the deck is built + rasterised. SET_NULL so deleting a deck
    # doesn't erase the job history.
    presentation = models.ForeignKey(
        Presentation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generation_job",
    )
    # Which OmniRoute-routed model actually answered (audit / debugging).
    model_used = models.CharField(max_length=80, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("user", "-created_at"))]

    def __str__(self) -> str:
        return f"job<{self.pk}> {self.status} {self.topic}"


class PresentationView(models.Model):
    """Lightweight tracking — fuel for the future ranking / popularity work."""

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="presentation_views"
    )
    presentation = models.ForeignKey(
        Presentation, on_delete=models.CASCADE, related_name="views"
    )
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=("user", "-viewed_at")),
            models.Index(fields=("presentation", "-viewed_at")),
        ]
