"""HMAC-signed, short-lived URLs for slide images.

Why our own signing scheme: we don't want users to be able to share or
download slide assets. The token binds (slide_id, user_id, expiry) so a leaked
URL stops working in minutes and can't be reused by another account.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from dataclasses import dataclass

from django.conf import settings
from django.urls import reverse


@dataclass(frozen=True)
class SignedSlideToken:
    slide_id: int
    user_id: int
    expires_at: int  # unix seconds

    @property
    def payload(self) -> str:
        return f"{self.slide_id}.{self.user_id}.{self.expires_at}"


def _hmac(payload: str) -> str:
    key = settings.SLIDE_URL_SIGNING_KEY.encode()
    digest = hmac.new(key, payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def sign(slide_id: int, user_id: int, ttl: int | None = None) -> SignedSlideToken:
    ttl = ttl if ttl is not None else settings.SLIDE_URL_TTL_SECONDS
    return SignedSlideToken(
        slide_id=slide_id,
        user_id=user_id,
        expires_at=int(time.time()) + ttl,
    )


def encode(token: SignedSlideToken) -> str:
    return _hmac(token.payload)


def verify(slide_id: int, user_id: int, expires_at: int, signature: str) -> bool:
    if expires_at < int(time.time()):
        return False
    expected = _hmac(SignedSlideToken(slide_id, user_id, expires_at).payload)
    return hmac.compare_digest(expected, signature)


def build_signed_url(slide, user) -> tuple[str, int]:
    """Return (relative_url, expires_at_unix).

    Relative on purpose — the frontend prepends its own public base URL.
    Otherwise, in containerized setups, Django would build URLs against the
    internal Docker hostname (`backend:8000`), which the browser can't reach.
    """
    token = sign(slide.id, user.id)
    sig = encode(token)
    path = reverse("slide-raw", args=[slide.id])
    qs = f"?u={token.user_id}&exp={token.expires_at}&sig={sig}"
    return path + qs, token.expires_at


# The presentation-pptx signing helper was removed when we switched to
# server-side PPTX→PNG rasterisation — admins upload .pptx, the backend
# turns it into Slide PNGs, deletes the original, and the public API has
# no path that streams the .pptx back to the browser.
