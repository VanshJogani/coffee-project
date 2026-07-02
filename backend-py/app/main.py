"""Café Indica — FastAPI backend application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import get_db, init_schema, run_migrations, close_db
from .auth import auth_router
from .routers import (
    products_router,
    recipes_router,
    inventory_router,
    brew_logs_router,
    brew_notes_router,
    posts_router,
    roasters_router,
    reviews_router,
    processes_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database schema on startup, close on shutdown."""
    db = get_db()
    init_schema(db)
    run_migrations(db)
    yield
    close_db()


app = FastAPI(
    title="Café Indica API",
    description="Specialty coffee companion — browse, brew, share.",
    version="2.0.0",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────

origins = [o.strip() for o in settings.cors_origin.split(",") if o.strip()]
if settings.env == "development":
    # Explicitly allow common local dev origins — never use "*" with credentials
    dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    for o in dev_origins:
        if o not in origins:
            origins.append(o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ──────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(products_router)
app.include_router(recipes_router)
app.include_router(inventory_router)
app.include_router(brew_logs_router)
app.include_router(brew_notes_router)
app.include_router(posts_router)
app.include_router(roasters_router)
app.include_router(reviews_router)
app.include_router(processes_router)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    db = get_db()
    row = db.execute("SELECT COUNT(*) FROM products").fetchone()
    product_count = row[0] if row else 0

    return {
        "status": "ok",
        "dbMode": "turso" if settings.turso_database_url else "local",
        "tursoUrlSet": bool(settings.turso_database_url),
        "tursoTokenSet": bool(settings.turso_auth_token),
        "productCount": product_count,
    }
