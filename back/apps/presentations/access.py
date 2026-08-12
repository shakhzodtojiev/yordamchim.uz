"""Who may see which presentation.

Two content tiers coexist:

* **Official** (``author is None``) — platform content. Free; visible to any
  teacher whose subject+grade preference matches (the pre-marketplace rule).
* **Teacher-generated** (``author`` set) — marketplace content. Listed decks
  are browsable by matching teachers, but the slides only open once the deck
  is owned (authored or purchased).

Admins and superusers always pass — they moderate/preview content.
"""

from __future__ import annotations

from django.db.models import Exists, OuterRef, Q

from apps.personalization.models import UserPreference

from .models import Presentation, PresentationPurchase


def preference_matches(user, presentation) -> bool:
    return user.preferences.filter(
        subject_id=presentation.subject_id, grade_id=presentation.grade_id
    ).exists()


def can_view(user, presentation: Presentation) -> bool:
    if user.is_superuser or getattr(user, "is_admin", False):
        return True
    if presentation.is_official:
        return preference_matches(user, presentation)
    if presentation.author_id == user.id:
        return True
    return PresentationPurchase.objects.filter(
        buyer=user, presentation=presentation
    ).exists()


def marketplace_queryset(user):
    """The catalog a teacher browses: published official decks + published,
    listed teacher decks, scoped to the caller's subject+grade preferences.

    Annotates ``_purchased`` (Exists) so serializers can report ownership
    without an N+1. Authorship is combined with it in the serializer.
    """
    matches = UserPreference.objects.filter(
        user=user, subject_id=OuterRef("subject_id"), grade_id=OuterRef("grade_id")
    )
    purchased = PresentationPurchase.objects.filter(
        buyer=user, presentation_id=OuterRef("pk")
    )
    return (
        Presentation.objects.filter(is_published=True)
        .filter(Q(author__isnull=True) | Q(is_listed=True))
        .annotate(_match=Exists(matches), _purchased=Exists(purchased))
        .filter(_match=True)
        .select_related("subject", "grade", "author")
    )
