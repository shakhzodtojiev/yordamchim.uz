"""Telegram Mini App initData verification.

When a user opens the mini app, Telegram passes a signed `initData` string
(URL-encoded query) like:
    query_id=AAH...&user=%7B%22id%22%3A123...%7D&auth_date=1717...&hash=abc...

This module:
  1. Parses it
  2. Verifies the HMAC signature using the bot token
  3. Checks freshness via `auth_date`
  4. Returns the parsed `user` dict (or raises a clean error)

Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

from django.conf import settings


# Telegram-recommended freshness window. 24 h leaves room for slow networks
# and timezone skew while still rejecting stale captures.
DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60


class InitDataError(ValueError):
    """Raised when initData fails parsing, signing, or freshness checks."""


@dataclass(frozen=True)
class TelegramUser:
    id: int
    first_name: str = ""
    last_name: str = ""
    username: str = ""
    photo_url: str = ""
    language_code: str = ""
    is_premium: bool = False


def _build_secret_key(bot_token: str) -> bytes:
    """Telegram's spec: secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token).
    Note the order — the bot token is the *message*, not the key."""
    return hmac.new(
        b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
    ).digest()


def verify_init_data(
    init_data: str,
    bot_token: str | None = None,
    max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS,
) -> TelegramUser:
    """Verify and parse a Telegram WebApp initData string.

    Returns the embedded user. Raises InitDataError on any failure (bad
    signature, expired, malformed, missing user)."""
    bot_token = bot_token or getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        raise InitDataError("Server-side TELEGRAM_BOT_TOKEN is not configured.")

    if not init_data or "hash=" not in init_data:
        raise InitDataError("initData is empty or missing the hash.")

    # parse_qsl preserves duplicate keys; Telegram doesn't use duplicates so
    # converting to dict is fine after this step.
    pairs = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=False))
    received_hash = pairs.pop("hash", "")
    if not received_hash:
        raise InitDataError("initData has no hash.")

    # Build the data-check string: sorted "key=value" lines, newline-separated.
    data_check_string = "\n".join(
        f"{k}={pairs[k]}" for k in sorted(pairs.keys())
    )

    secret_key = _build_secret_key(bot_token)
    expected_hash = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise InitDataError("initData signature mismatch.")

    # Freshness — `auth_date` is unix seconds.
    try:
        auth_date = int(pairs.get("auth_date", "0"))
    except ValueError as exc:
        raise InitDataError("initData auth_date is not an integer.") from exc
    if max_age_seconds and (time.time() - auth_date) > max_age_seconds:
        raise InitDataError("initData has expired.")

    # Extract the user payload.
    user_raw = pairs.get("user")
    if not user_raw:
        raise InitDataError("initData has no user payload.")
    try:
        user = json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise InitDataError("initData user payload is not valid JSON.") from exc

    try:
        user_id = int(user["id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise InitDataError("initData user.id missing or invalid.") from exc

    return TelegramUser(
        id=user_id,
        first_name=str(user.get("first_name") or ""),
        last_name=str(user.get("last_name") or ""),
        username=str(user.get("username") or ""),
        photo_url=str(user.get("photo_url") or ""),
        language_code=str(user.get("language_code") or ""),
        is_premium=bool(user.get("is_premium") or False),
    )
