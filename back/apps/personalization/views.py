from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Grade, Subject
from .serializers import (
    GradeSerializer,
    PreferencesReadSerializer,
    PreferencesWriteSerializer,
    SubjectSerializer,
)


class SubjectListView(generics.ListAPIView):
    """Public — register form needs this without auth."""
    queryset = Subject.objects.filter(is_active=True).order_by("name")
    serializer_class = SubjectSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class GradeListView(generics.ListAPIView):
    """Public — register form needs this without auth."""
    queryset = Grade.objects.filter(is_active=True).order_by("level")
    serializer_class = GradeSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class PreferencesView(APIView):
    """GET / PUT the authenticated user's subject + grade preferences.

    Preferences are set once at registration. After `has_completed_onboarding`
    flips to True, edits are rejected — content access is tied to these
    choices and we don't want a teacher to widen their scope after the fact.
    Admins can still edit via Django admin if a legitimate change is needed.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PreferencesReadSerializer(request.user).data)

    def put(self, request):
        if request.user.has_completed_onboarding:
            return Response(
                {
                    "detail": (
                        "Fan va sinflarni o'zgartirib bo'lmaydi. Tayyor "
                        "materiallar xavfsizligi uchun bu sozlama bir martalik. "
                        "O'zgartirish kerak bo'lsa administratorga murojaat qiling."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PreferencesWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save(user=request.user)
        return Response(PreferencesReadSerializer(user).data)
