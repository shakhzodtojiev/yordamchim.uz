from rest_framework.permissions import BasePermission

from .access import can_view


class HasMatchingPreference(BasePermission):
    """Object-level: user must have a UserPreference matching the
    presentation's (subject, grade) pair.

    Admins (custom panel role) and superusers always pass — they preview
    content as part of their job.
    """

    message = "You don't have a matching subject + grade preference for this content."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser or getattr(user, "is_admin", False):
            return True
        return user.preferences.filter(
            subject_id=obj.subject_id, grade_id=obj.grade_id
        ).exists()


class CanViewPresentation(BasePermission):
    """Object-level view gate for the marketplace era: official decks need a
    matching preference; teacher decks must be owned (authored or purchased)."""

    message = "Bu taqdimotni ko'rish uchun avval sotib olishingiz kerak."

    def has_object_permission(self, request, view, obj):
        return can_view(request.user, obj)
