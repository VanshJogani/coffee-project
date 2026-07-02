"""FastAPI dependencies for authentication."""

from dataclasses import dataclass

from fastapi import Request, HTTPException, Depends

from .utils import decode_access_token


@dataclass
class AuthUser:
    """Authenticated user data extracted from JWT."""
    id: int
    email: str
    display_name: str


def optional_auth(request: Request) -> AuthUser | None:
    """
    Extract user from access_token cookie or Authorization header.
    Returns None for anonymous users — never raises.
    """
    token = request.cookies.get("access_token")

    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    return AuthUser(
        id=int(payload["sub"]),
        email=payload["email"],
        display_name=payload["displayName"],
    )


def require_auth(user: AuthUser | None = Depends(optional_auth)) -> AuthUser:
    """
    Dependency that requires a valid authenticated user.
    Raises 401 if no valid token is present.
    """
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
