from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    issue_token_pair,
)
from .telegram import InitDataError, verify_init_data


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": issue_token_pair(user),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": issue_token_pair(user),
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                # token_blacklist is installed, so this genuinely revokes the
                # refresh token server-side (get_or_create OutstandingToken +
                # BlacklistedToken). A dead/garbage token just no-ops.
                RefreshToken(refresh).blacklist()
            except (TokenError, AttributeError):
                pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class RefreshView(TokenRefreshView):
    throttle_scope = "auth"


class TelegramAuthView(APIView):
    """POST /auth/telegram/ — exchanges Telegram WebApp `initData` for JWTs.

    The mini-app frontend sends `{"init_data": "<raw initData string>"}`.
    We verify the HMAC signature using the bot token, then look up (or
    create) a user by `telegram_id`. New users get a synthetic email and
    auto-completed onboarding=False so they're routed through the picker
    flow on first login."""

    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        init_data = request.data.get("init_data") or ""
        try:
            tg_user = verify_init_data(init_data)
        except InitDataError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )

        User = get_user_model()
        with transaction.atomic():
            user = (
                User.objects.filter(telegram_id=tg_user.id)
                .select_for_update()
                .first()
            )
            if user is None:
                # First-time login — create the account. The synthetic email
                # keeps the unique-email constraint satisfied while signalling
                # "Telegram-originated" to admins reviewing the user list.
                full_name = (
                    f"{tg_user.first_name} {tg_user.last_name}".strip()
                    or tg_user.username
                    or f"Telegram #{tg_user.id}"
                )
                user = User.objects.create_user(
                    email=f"tg-{tg_user.id}@noreply.yordamchim.local",
                    full_name=full_name,
                    password=None,
                )
                user.telegram_id = tg_user.id

            # Always refresh display fields so a username/avatar change in
            # Telegram propagates on next login.
            user.telegram_username = tg_user.username
            user.telegram_first_name = tg_user.first_name
            user.telegram_photo_url = tg_user.photo_url
            user.save(
                update_fields=[
                    "telegram_id",
                    "telegram_username",
                    "telegram_first_name",
                    "telegram_photo_url",
                ]
            )

        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": issue_token_pair(user),
            }
        )
