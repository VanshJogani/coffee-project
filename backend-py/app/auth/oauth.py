"""OAuth2 handlers for Google and GitHub login."""

import logging
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse

from ..config import settings
from ..database import get_db
from .utils import (
    create_access_token,
    generate_refresh_token,
    get_refresh_token_expiry,
    set_token_cookies,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── Google OAuth2 ───────────────────────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google")
async def google_login():
    """Redirect to Google OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{query}")


@router.get("/google/callback")
async def google_callback(request: Request, code: str = ""):
    """Handle Google OAuth callback — exchange code, find or create user."""
    if not code:
        return _error_redirect("Missing authorization code")

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.google_redirect_uri,
            })

        if token_resp.status_code != 200:
            return _error_redirect("Failed to exchange code with Google")

        tokens = token_resp.json()
        access_token = tokens.get("access_token")

        # Get user info
        async with httpx.AsyncClient() as client:
            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

        if userinfo_resp.status_code != 200:
            return _error_redirect("Failed to get Google user info")

        userinfo = userinfo_resp.json()
        email = userinfo.get("email", "").lower()
        name = userinfo.get("name", email.split("@")[0])
        avatar = userinfo.get("picture", "")
        provider_id = userinfo.get("id", "")

        # Find or create user
        user = await _find_or_create_oauth_user(email, name, avatar, "google", provider_id)

        # Issue tokens
        jwt_token = create_access_token(user["id"], user["email"], user["displayName"])
        refresh_token = generate_refresh_token()
        now = datetime.now(timezone.utc).isoformat()
        expires_at = get_refresh_token_expiry()

        db = get_db()
        db.execute(
            "INSERT INTO refresh_tokens (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
            [user["id"], refresh_token, expires_at, now],
        )
        db.commit()

        # Redirect to frontend with cookies set
        response = RedirectResponse(url=settings.cors_origin, status_code=302)
        set_token_cookies(response, jwt_token, refresh_token)
        return response

    except Exception as e:
        logger.exception("Google OAuth callback failed")
        return _error_redirect("Google sign-in failed. Please try again.")


# ─── GitHub OAuth2 ───────────────────────────────────────────────────────────

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"


@router.get("/github")
async def github_login():
    """Redirect to GitHub OAuth consent screen."""
    if not settings.github_client_id:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured")

    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_redirect_uri,
        "scope": "read:user user:email",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{GITHUB_AUTH_URL}?{query}")


@router.get("/github/callback")
async def github_callback(request: Request, code: str = ""):
    """Handle GitHub OAuth callback."""
    if not code:
        return _error_redirect("Missing authorization code")

    try:
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                GITHUB_TOKEN_URL,
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                    "redirect_uri": settings.github_redirect_uri,
                },
                headers={"Accept": "application/json"},
            )

        if token_resp.status_code != 200:
            return _error_redirect("Failed to exchange code with GitHub")

        tokens = token_resp.json()
        access_token = tokens.get("access_token")

        if not access_token:
            return _error_redirect("No access token from GitHub")

        # Get user info
        headers = {"Authorization": f"token {access_token}", "Accept": "application/json"}
        async with httpx.AsyncClient() as client:
            user_resp = await client.get(GITHUB_USER_URL, headers=headers)
            emails_resp = await client.get(GITHUB_EMAILS_URL, headers=headers)

        if user_resp.status_code != 200:
            return _error_redirect("Failed to get GitHub user info")

        gh_user = user_resp.json()
        provider_id = str(gh_user.get("id", ""))
        name = gh_user.get("name") or gh_user.get("login", "")
        avatar = gh_user.get("avatar_url", "")

        # Get primary email
        email = gh_user.get("email", "")
        if not email and emails_resp.status_code == 200:
            emails = emails_resp.json()
            primary = next((e for e in emails if e.get("primary")), None)
            if primary:
                email = primary["email"]

        if not email:
            return _error_redirect("Could not get email from GitHub")

        email = email.lower()

        # Find or create user
        user = await _find_or_create_oauth_user(email, name, avatar, "github", provider_id)

        # Issue tokens
        jwt_token = create_access_token(user["id"], user["email"], user["displayName"])
        refresh_token = generate_refresh_token()
        now = datetime.now(timezone.utc).isoformat()
        expires_at = get_refresh_token_expiry()

        db = get_db()
        db.execute(
            "INSERT INTO refresh_tokens (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
            [user["id"], refresh_token, expires_at, now],
        )
        db.commit()

        response = RedirectResponse(url=settings.cors_origin, status_code=302)
        set_token_cookies(response, jwt_token, refresh_token)
        return response

    except Exception as e:
        logger.exception("GitHub OAuth callback failed")
        return _error_redirect("GitHub sign-in failed. Please try again.")


# ─── Shared ──────────────────────────────────────────────────────────────────


def _error_redirect(message: str) -> RedirectResponse:
    """Redirect to frontend with an error message in the query string."""
    params = urlencode({"auth_error": message})
    return RedirectResponse(url=f"{settings.cors_origin}?{params}", status_code=302)


async def _find_or_create_oauth_user(
    email: str, name: str, avatar: str, provider: str, provider_id: str
) -> dict:
    """Find an existing user by email or create a new OAuth user."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    row = db.execute("SELECT id, email, displayName FROM users WHERE email = ?", [email]).fetchone()

    if row:
        # Update provider info if not already set
        db.execute(
            "UPDATE users SET provider = ?, providerId = ?, avatarUrl = ?, updatedAt = ? WHERE id = ? AND provider = 'local'",
            [provider, provider_id, avatar, now, row[0]],
        )
        db.commit()
        return {"id": row[0], "email": row[1], "displayName": row[2]}

    # Create new user (no password for OAuth users)
    cursor = db.execute(
        "INSERT INTO users (email, passwordHash, displayName, provider, providerId, avatarUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [email, None, name, provider, provider_id, avatar, now, now],
    )
    db.commit()
    user_id = cursor.lastrowid
    return {"id": user_id, "email": email, "displayName": name}
