"""Django settings for the Yordamchim backend."""

from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

_INSECURE_SECRET = "dev-insecure-key-change-me"
SECRET_KEY = config("DJANGO_SECRET_KEY", default=_INSECURE_SECRET)
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)

# Never boot production on the shared fallback key — it would let anyone
# forge Django admin sessions and (since SLIDE_URL_SIGNING_KEY defaults to
# it) signed media URLs. Fail loud instead of silently running insecure.
if not DEBUG and SECRET_KEY == _INSECURE_SECRET:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set to a unique value when DJANGO_DEBUG=False."
    )
ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=Csv(),
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    # Enables server-side refresh-token revocation on logout.
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    # Local apps
    "apps.accounts",
    "apps.personalization",
    "apps.presentations",
    "apps.tests",
    "apps.courses",
    "apps.wallet",
    "apps.admin_api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "yordamchim.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "yordamchim.wsgi.application"
ASGI_APPLICATION = "yordamchim.asgi.application"


# Database — Postgres via DATABASE_URL.
# Falls back to SQLite locally so `manage.py check` works without a DB.

def _parse_database_url(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme.startswith("postgres"):
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": parsed.username or "",
            "PASSWORD": parsed.password or "",
            "HOST": parsed.hostname or "",
            "PORT": str(parsed.port or ""),
        }
    return {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(BASE_DIR / "db.sqlite3"),
    }


DATABASES = {
    "default": _parse_database_url(
        config("DATABASE_URL", default="sqlite:///db.sqlite3")
    )
}


# Some Postgres deployments (managed providers, stripped images) ship
# without a complete `pg_timezone_names` table and reject the
# `SET TIME ZONE 'UTC'` Django sends on every new connection — the
# resulting `DataError` blocks startup before any migration runs. Skip
# that statement unconditionally: psycopg parses `timestamptz` values
# from the wire offset (not session TZ), and Django uses settings
# .TIME_ZONE for display, so the only thing we lose is the TZ that
# Postgres's own `now()` reports — which nothing in our ORM uses.
if DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql":
    from django.db.backends.postgresql import base as _pg_base

    def _skip_tz(self, connection):
        return False

    _pg_base.DatabaseWrapper._configure_timezone = _skip_tz


AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# REST framework

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
    ),
    # Custom pagination class opts admins into a `?page_size=` query param
    # for options-style dropdowns that need the whole list. Capped at 1000
    # so a rogue query can't OOM the server.
    "DEFAULT_PAGINATION_CLASS": "yordamchim.pagination.PageNumberPaginationWithSize",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    # Rates are env-driven so dev (where you re-take the sample test 50
    # times in a row) can bump them without code changes. The defaults
    # below are tuned for production.
    "DEFAULT_THROTTLE_RATES": {
        "auth": config("THROTTLE_AUTH", default="20/min"),
        "test_submit": config("THROTTLE_TEST_SUBMIT", default="30/hour"),
        "slide_url": config("THROTTLE_SLIDE_URL", default="120/min"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("ACCESS_TOKEN_LIFETIME_MINUTES", default=30, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("REFRESH_TOKEN_LIFETIME_DAYS", default=14, cast=int)
    ),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}


# CORS — allow the Next.js frontend to call the API.

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3030",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True


# Production hardening — toggle via env in deployment, no-op for local dev.
#
# Behind a TLS-terminating proxy (nginx, Traefik, Cloudflare), Django sees
# plain HTTP on the inside. These settings tell it to trust the proxy's
# X-Forwarded-* headers so absolute URLs and `request.is_secure()` come
# out right.
USE_X_FORWARDED_HOST = config("USE_X_FORWARDED_HOST", default=False, cast=bool)
_proxy_header_name = config("SECURE_PROXY_SSL_HEADER_NAME", default="").strip()
if _proxy_header_name:
    SECURE_PROXY_SSL_HEADER = (
        _proxy_header_name,
        config("SECURE_PROXY_SSL_HEADER_VALUE", default="https"),
    )
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)

# Cookies are only used by Django admin (DRF auth is bearer-token). Off in
# DEBUG so dev can hit localhost over plain HTTP.
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# CSRF trusted origins — only relevant for Django admin POST forms. Pass
# the full scheme+host (e.g. `https://api.example.com`).
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="",
    cast=Csv(),
)


# Upload size limits — primarily for admin PPTX uploads (taqdimot
# yaratish). Django defaults (2.5 MB) reject typical school presentations
# outright with 413. DATA_UPLOAD bounds the whole multipart request;
# FILE_UPLOAD_MAX_MEMORY stays small so big files spill to a temp file
# on disk instead of being buffered in RAM. Tune via env in prod.
# Nginx (`client_max_body_size`) and Next.js (`serverActions.bodySizeLimit`)
# must be raised in lockstep — they sit in front of Django.
_MAX_UPLOAD_MB = config("DJANGO_MAX_UPLOAD_MB", default=50, cast=int)
DATA_UPLOAD_MAX_MEMORY_SIZE = _MAX_UPLOAD_MB * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024


# Logging. Django's default config silently drops 5xx tracebacks when
# DEBUG=False (mail_admins -> NullHandler), which is why prod 500s
# appear as gunicorn access lines with zero Python traceback. Replace
# it with an explicit stdout console handler so gunicorn captures
# everything and `docker compose logs backend` shows the real cause.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": config("DJANGO_LOG_LEVEL", default="INFO"),
    },
    "loggers": {
        # 5xx responses bubble through here with full traceback.
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        # App loggers — info-level by default so conversion progress,
        # auth events, etc. land in the log too.
        "apps": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}


# Slide URL signing — used by presentations app.

# Grace window (seconds) accepted past a test attempt's deadline. Covers
# client clock skew and paused timers on locked mobile devices so a slightly
# late auto-submit is still scored rather than discarded.
TEST_SUBMIT_GRACE_SECONDS = config("TEST_SUBMIT_GRACE_SECONDS", default=120, cast=int)

SLIDE_URL_TTL_SECONDS = config("SLIDE_URL_TTL_SECONDS", default=300, cast=int)
SLIDE_URL_SIGNING_KEY = config(
    "SLIDE_URL_SIGNING_KEY",
    default=SECRET_KEY,
)


# Marketplace / wallet economics. All amounts in so'm (UZS), whole numbers.
# A teacher pays GENERATION_PRICE to generate a deck (pure platform revenue —
# OmniRoute generation is free); other teachers buy it for the deck's own
# price (defaults to DEFAULT_PRICE), of which COMMISSION_PERCENT goes to the
# platform and the rest to the author.
PRESENTATION_GENERATION_PRICE = config(
    "PRESENTATION_GENERATION_PRICE", default=15000, cast=int
)
PRESENTATION_DEFAULT_PRICE = config(
    "PRESENTATION_DEFAULT_PRICE", default=5000, cast=int
)
MARKETPLACE_COMMISSION_PERCENT = config(
    "MARKETPLACE_COMMISSION_PERCENT", default=20, cast=int
)


# OmniRoute — OpenAI-compatible AI gateway used to generate slide outlines.
# It runs as a local proxy (default port 20128). From inside Docker, the
# host's OmniRoute is reachable at host.docker.internal, not localhost.
# `auto` lets OmniRoute pick the cheapest/fastest healthy provider itself.
OMNIROUTE_BASE_URL = config(
    "OMNIROUTE_BASE_URL", default="http://host.docker.internal:20128/v1"
)
OMNIROUTE_API_KEY = config("OMNIROUTE_API_KEY", default="")
OMNIROUTE_MODEL = config("OMNIROUTE_MODEL", default="auto")
OMNIROUTE_TIMEOUT_SECONDS = config("OMNIROUTE_TIMEOUT_SECONDS", default=120, cast=int)


# LLM provider for slide generation: "gemini" (default) or "omniroute".
LLM_PROVIDER = config("LLM_PROVIDER", default="gemini")

# Google Gemini via its OpenAI-compatible endpoint. GEMINI_API_KEY is the
# free-tier key (tried first); GEMINI_API_KEY_PAID is the paid-tier fallback
# used automatically once the free quota is exhausted (HTTP 429). Leave the
# paid key empty to run free-only. Get keys at https://aistudio.google.com.
GEMINI_BASE_URL = config(
    "GEMINI_BASE_URL",
    default="https://generativelanguage.googleapis.com/v1beta/openai",
)
GEMINI_API_KEY = config("GEMINI_API_KEY", default="")
GEMINI_API_KEY_PAID = config("GEMINI_API_KEY_PAID", default="")
GEMINI_MODEL = config("GEMINI_MODEL", default="gemini-2.5-flash")
GEMINI_TIMEOUT_SECONDS = config("GEMINI_TIMEOUT_SECONDS", default=120, cast=int)

# AI slide images (Google Imagen via the Gemini API). Best-effort: a deck still
# builds (styled, text-only) if this is off or fails. Imagen needs a
# billing-enabled key (no free tier), so the paid Gemini key is used.
GENERATE_IMAGES = config("GENERATE_IMAGES", default=True, cast=bool)
GEMINI_IMAGE_MODEL = config("GEMINI_IMAGE_MODEL", default="gemini-2.5-flash-image")

# Anthropic Claude (paid API). Used when LLM_PROVIDER=claude. Model is
# configurable; claude-opus-5 is highest quality, claude-sonnet-5 /
# claude-haiku-4-5 are cheaper + faster for high-volume generation.
CLAUDE_API_KEY = config("ANTHROPIC_API_KEY", default="")
CLAUDE_MODEL = config("CLAUDE_MODEL", default="claude-opus-5")
CLAUDE_TIMEOUT_SECONDS = config("CLAUDE_TIMEOUT_SECONDS", default=120, cast=int)


# Telegram Mini App — bot token used to verify initData HMAC signatures.
# Empty in non-TMA environments; the auth endpoint rejects requests when unset.

TELEGRAM_BOT_TOKEN = config("TELEGRAM_BOT_TOKEN", default="")


# Storage backend toggle.

STORAGE_BACKEND = config("STORAGE_BACKEND", default="local")

if STORAGE_BACKEND == "s3":
    # Shared options for any S3-compatible backend (AWS, Cloudflare R2,
    # MinIO, Wasabi, …). Switching providers is just an env change.
    _s3_options = {
        "bucket_name": config("AWS_STORAGE_BUCKET_NAME"),
        "region_name": config("AWS_S3_REGION_NAME", default="us-east-1"),
        "access_key": config("AWS_ACCESS_KEY_ID", default=""),
        "secret_key": config("AWS_SECRET_ACCESS_KEY", default=""),
        "querystring_auth": True,
        "default_acl": "private",
    }
    # MinIO / self-hosted S3 — set the endpoint so boto3 stops talking to
    # AWS. Path-style URLs are required for MinIO (it doesn't do
    # vhost-style bucket subdomains by default).
    _s3_endpoint = config("AWS_S3_ENDPOINT_URL", default="").strip()
    if _s3_endpoint:
        _s3_options["endpoint_url"] = _s3_endpoint
        _s3_options["addressing_style"] = config(
            "AWS_S3_ADDRESSING_STYLE", default="path"
        )
        _s3_options["use_ssl"] = _s3_endpoint.startswith("https://")
        # The signer needs to know whether we're talking https for
        # presigned-URL generation; in MinIO over plain http this is False.
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": _s3_options,
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }


# Slide image serving mode.
#   - "stream" (default) — Django reads bytes from storage and streams them.
#     Works everywhere, but every image request round-trips through the app
#     server, which is a real bottleneck when slides live in S3.
#   - "redirect" — Django verifies the HMAC token and 302s to the storage
#     backend's own presigned URL. Browser fetches the image directly from
#     S3/R2, bypassing Django entirely. Only enable when the storage
#     endpoint is publicly reachable from the browser (i.e. AWS S3,
#     Cloudflare R2, or MinIO behind a public proxy — NOT Docker-internal
#     minio:9000).
SLIDE_SERVE_MODE = config("SLIDE_SERVE_MODE", default="stream")
