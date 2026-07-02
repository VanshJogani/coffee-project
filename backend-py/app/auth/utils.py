"""JWT, password hashing, and cookie utilities for authentication."""

import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt, JWTError

from ..config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: int, email: str, display_name: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_expiry_minutes)
    payload = {
        "sub": str(user_id),
        "email": email,
        "displayName": display_name,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    """Decode and verify a JWT. Returns payload dict or None if invalid."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload
    except JWTError:
        return None


def generate_refresh_token() -> str:
    return secrets.token_hex(40)


def get_refresh_token_expiry() -> str:
    expiry = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)
    return expiry.isoformat()


def set_token_cookies(response, access_token: str, refresh_token: str):
    """Set httpOnly auth cookies on the response."""
    is_production = settings.env == "production"

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.jwt_access_expiry_minutes * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        path="/api/auth",
        max_age=settings.refresh_token_days * 24 * 60 * 60,
    )


def clear_token_cookies(response):
    """Remove auth cookies."""
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token", path="/api/auth")
