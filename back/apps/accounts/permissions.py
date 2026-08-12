from rest_framework.permissions import BasePermission


class IsAdminOrSuperuser(BasePermission):
    """Custom admin panel access.

    Lets through both the dedicated `is_admin` role (content/teacher
    moderators) and Django superusers. Plain `is_staff` is *not* enough —
    that flag is for /admin/ access only.
    """

    message = "Bu bo'limga kirish huquqingiz yo'q."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or getattr(user, "is_admin", False))
        )
