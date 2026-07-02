"""Auth router — register, login, logout, refresh, me, claim."""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Response, Depends, HTTPException
from pydantic import BaseModel

from ..database import get_db
from .dependencies import AuthUser, optional_auth, require_auth
from .utils import (
    hash_password,
    verify_password,
    create_access_token,
    generate_refresh_token,
    get_refresh_token_expiry,
    set_token_cookies,
    clear_token_cookies,
)
from . import oauth as oauth_router

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Include OAuth routes
router.include_router(oauth_router.router)

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


# ─── Request Models ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    displayName: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ClaimRequest(BaseModel):
    displayName: str


# ─── POST /api/auth/register ─────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(body: RegisterRequest, response: Response):
    errors = []
    if not body.email or not body.email.strip():
        errors.append("Email is required")
    elif not EMAIL_REGEX.match(body.email.strip()):
        errors.append("Invalid email format")
    if not body.password:
        errors.append("Password is required")
    if not body.displayName or not body.displayName.strip():
        errors.append("Display name is required")

    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    db = get_db()
    email = body.email.strip().lower()
    display_name = body.displayName.strip()

    existing = db.execute("SELECT id FROM users WHERE email = ?", [email]).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    password_hash = hash_password(body.password)
    now = datetime.now(timezone.utc).isoformat()

    cursor = db.execute(
        "INSERT INTO users (email, passwordHash, displayName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        [email, password_hash, display_name, now, now],
    )
    db.commit()
    user_id = cursor.lastrowid

    user = {"id": user_id, "email": email, "displayName": display_name}

    # Generate tokens
    access_token = create_access_token(user_id, email, display_name)
    refresh_token = generate_refresh_token()
    expires_at = get_refresh_token_expiry()

    db.execute(
        "INSERT INTO refresh_tokens (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
        [user_id, refresh_token, expires_at, now],
    )
    db.commit()

    set_token_cookies(response, access_token, refresh_token)
    return {"user": user}


# ─── POST /api/auth/login ────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest, response: Response):
    errors = []
    if not body.email or not body.email.strip():
        errors.append("Email is required")
    if not body.password:
        errors.append("Password is required")
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    db = get_db()
    email = body.email.strip().lower()

    row = db.execute(
        "SELECT id, email, passwordHash, displayName FROM users WHERE email = ?",
        [email],
    ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id, user_email, password_hash, display_name = row[0], row[1], row[2], row[3]

    if not password_hash or not verify_password(body.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = {"id": user_id, "email": user_email, "displayName": display_name}

    access_token = create_access_token(user_id, user_email, display_name)
    refresh_token = generate_refresh_token()
    now = datetime.now(timezone.utc).isoformat()
    expires_at = get_refresh_token_expiry()

    db.execute(
        "INSERT INTO refresh_tokens (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
        [user_id, refresh_token, expires_at, now],
    )
    db.commit()

    set_token_cookies(response, access_token, refresh_token)
    return {"user": user}


# ─── POST /api/auth/logout ───────────────────────────────────────────────────

@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        db = get_db()
        db.execute("DELETE FROM refresh_tokens WHERE token = ?", [refresh_token])
        db.commit()
    clear_token_cookies(response)
    return None


# ─── GET /api/auth/me ────────────────────────────────────────────────────────

@router.get("/me")
async def me(user: AuthUser | None = Depends(optional_auth)):
    if user:
        return {"user": {"id": user.id, "email": user.email, "displayName": user.display_name}}
    return {"user": None}


# ─── POST /api/auth/refresh ──────────────────────────────────────────────────

@router.post("/refresh")
async def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    db = get_db()
    row = db.execute(
        """SELECT rt.id, rt.userId, rt.expiresAt, u.email, u.displayName
           FROM refresh_tokens rt
           JOIN users u ON u.id = rt.userId
           WHERE rt.token = ?""",
        [refresh_token],
    ).fetchone()

    if not row:
        clear_token_cookies(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    rt_id, user_id, expires_at, email, display_name = row[0], row[1], row[2], row[3], row[4]

    # Check expiry
    if datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
        db.execute("DELETE FROM refresh_tokens WHERE id = ?", [rt_id])
        db.commit()
        clear_token_cookies(response)
        raise HTTPException(status_code=401, detail="Refresh token expired")

    # Rotate tokens
    new_access_token = create_access_token(user_id, email, display_name)
    new_refresh_token = generate_refresh_token()
    now = datetime.now(timezone.utc).isoformat()
    new_expires_at = get_refresh_token_expiry()

    db.execute("DELETE FROM refresh_tokens WHERE id = ?", [rt_id])
    db.execute(
        "INSERT INTO refresh_tokens (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
        [user_id, new_refresh_token, new_expires_at, now],
    )
    db.commit()

    set_token_cookies(response, new_access_token, new_refresh_token)
    return {"user": {"id": user_id, "email": email, "displayName": display_name}}


# ─── POST /api/auth/claim/preview ────────────────────────────────────────────

@router.post("/claim/preview")
async def claim_preview(body: ClaimRequest, user: AuthUser = Depends(require_auth)):
    if not body.displayName or not body.displayName.strip():
        raise HTTPException(status_code=400, detail="Display name is required")

    db = get_db()
    name = body.displayName.strip()

    recipes = db.execute(
        "SELECT COUNT(*) FROM recipes WHERE authorName = ? AND userId IS NULL", [name]
    ).fetchone()[0]
    brew_notes = db.execute(
        "SELECT COUNT(*) FROM brew_notes WHERE authorName = ? AND userId IS NULL", [name]
    ).fetchone()[0]
    posts = db.execute(
        "SELECT COUNT(*) FROM community_posts WHERE authorName = ? AND userId IS NULL", [name]
    ).fetchone()[0]
    reviews = db.execute(
        "SELECT COUNT(*) FROM reviews WHERE reviewerName = ? AND userId IS NULL", [name]
    ).fetchone()[0]

    return {
        "claimable": {
            "recipes": recipes,
            "brewNotes": brew_notes,
            "posts": posts,
            "reviews": reviews,
        }
    }


# ─── POST /api/auth/claim ────────────────────────────────────────────────────

@router.post("/claim")
async def claim(body: ClaimRequest, user: AuthUser = Depends(require_auth)):
    if not body.displayName or not body.displayName.strip():
        raise HTTPException(status_code=400, detail="Display name is required")

    db = get_db()
    name = body.displayName.strip()
    user_id = user.id

    recipes = db.execute(
        "UPDATE recipes SET userId = ? WHERE authorName = ? AND userId IS NULL",
        [user_id, name],
    ).rowcount
    brew_notes = db.execute(
        "UPDATE brew_notes SET userId = ? WHERE authorName = ? AND userId IS NULL",
        [user_id, name],
    ).rowcount
    posts = db.execute(
        "UPDATE community_posts SET userId = ? WHERE authorName = ? AND userId IS NULL",
        [user_id, name],
    ).rowcount
    reviews = db.execute(
        "UPDATE reviews SET userId = ? WHERE reviewerName = ? AND userId IS NULL",
        [user_id, name],
    ).rowcount
    db.commit()

    return {
        "claimed": {
            "recipes": recipes,
            "brewNotes": brew_notes,
            "posts": posts,
            "reviews": reviews,
        }
    }
