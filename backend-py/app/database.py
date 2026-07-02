"""Database module — uses stdlib sqlite3 for local/test, libsql for Turso production."""

import sqlite3
from .config import settings

_connection = None


def get_db():
    """Get or create the database connection."""
    global _connection
    if _connection is not None:
        return _connection

    if settings.turso_database_url:
        # Production: use libsql for remote Turso (Linux/Docker only)
        try:
            import libsql_experimental as libsql
            _connection = libsql.connect(
                database=settings.turso_database_url,
                auth_token=settings.turso_auth_token,
            )
        except ImportError:
            raise RuntimeError(
                "libsql-experimental is required for Turso connections. "
                "Install it in your production environment (Linux)."
            )
    elif settings.env == "test":
        _connection = sqlite3.connect(":memory:", check_same_thread=False)
        _connection.execute("PRAGMA foreign_keys = ON")
    else:
        _connection = sqlite3.connect(settings.database_path, check_same_thread=False)
        _connection.execute("PRAGMA foreign_keys = ON")

    return _connection


def close_db():
    """Close the database connection."""
    global _connection
    if _connection is not None:
        _connection.close()
        _connection = None


def init_schema(db):
    """Create all tables if they don't exist."""
    db.executescript(SCHEMA_SQL)
    db.executescript(INDEXES_SQL)


def run_migrations(db):
    """Run additive schema migrations."""
    # Add userId columns to content tables if missing
    user_id_tables = [
        "bean_inventory", "brew_logs", "recipes",
        "brew_notes", "community_posts", "reviews",
    ]
    for table in user_id_tables:
        cols = [row[1] for row in db.execute(f"PRAGMA table_info({table})").fetchall()]
        if "userId" not in cols:
            db.execute(
                f"ALTER TABLE {table} ADD COLUMN userId INTEGER REFERENCES users(id) ON DELETE SET NULL"
            )

    # Add OAuth columns to users table if missing
    user_cols = [row[1] for row in db.execute("PRAGMA table_info(users)").fetchall()]
    if "provider" not in user_cols:
        db.execute("ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'local'")
    if "providerId" not in user_cols:
        db.execute("ALTER TABLE users ADD COLUMN providerId TEXT")
    if "avatarUrl" not in user_cols:
        db.execute("ALTER TABLE users ADD COLUMN avatarUrl TEXT")

    db.commit()


# ─── Schema SQL ──────────────────────────────────────────────────────────────

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId TEXT UNIQUE,
    name TEXT NOT NULL,
    roaster TEXT,
    roastType TEXT,
    origin TEXT,
    process TEXT,
    tastingNotes TEXT,
    score REAL,
    price REAL,
    imageUrl TEXT,
    cuppingDate TEXT,
    description TEXT,
    url TEXT,
    quantity TEXT,
    category TEXT
);

CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    quantity TEXT,
    price REAL,
    originalProductId TEXT,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    reviewerName TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    userId INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    passwordHash TEXT,
    displayName TEXT NOT NULL,
    provider TEXT DEFAULT 'local',
    providerId TEXT,
    avatarUrl TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    displayName TEXT DEFAULT 'Brewer',
    defaultGrinder TEXT,
    defaultBrewer TEXT,
    createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brewerType TEXT NOT NULL,
    grindSize TEXT,
    coffeeGrams REAL,
    waterGrams REAL,
    waterTempC INTEGER,
    bloomTimeSec INTEGER,
    targetBrewTimeSec INTEGER,
    steps TEXT,
    isBuiltIn INTEGER DEFAULT 0,
    sourceRecipe TEXT,
    notes TEXT,
    isPublic INTEGER DEFAULT 0,
    authorName TEXT,
    authorSetup TEXT,
    roastLevel TEXT,
    coffeeBrand TEXT,
    coffeeName TEXT,
    userId INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bean_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER,
    customName TEXT,
    customRoaster TEXT,
    gramsRemaining REAL DEFAULT 0,
    purchaseDate TEXT,
    openedDate TEXT,
    notes TEXT,
    userId INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS brew_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipeId INTEGER,
    beanInventoryId INTEGER,
    brewerName TEXT,
    grinderName TEXT,
    grindSize TEXT,
    coffeeGrams REAL,
    waterGrams REAL,
    waterTempC INTEGER,
    brewTimeSec INTEGER,
    rating INTEGER,
    notes TEXT,
    isPublic INTEGER DEFAULT 1,
    userId INTEGER,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE SET NULL,
    FOREIGN KEY (beanInventoryId) REFERENCES bean_inventory(id) ON DELETE SET NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS brew_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    authorName TEXT NOT NULL,
    body TEXT NOT NULL,
    brewLogId INTEGER,
    userId INTEGER,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (brewLogId) REFERENCES brew_logs(id) ON DELETE SET NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT,
    authorName TEXT,
    recipeId INTEGER,
    likes INTEGER DEFAULT 0,
    userId INTEGER,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE SET NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS roasters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    websiteUrl TEXT,
    establishedYear INTEGER,
    description TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roaster_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roasterId INTEGER NOT NULL UNIQUE,
    overallRating REAL DEFAULT 0,
    consistencyRating REAL DEFAULT 0,
    experimentationRating REAL DEFAULT 0,
    totalReviews INTEGER DEFAULT 0,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (roasterId) REFERENCES roasters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roaster_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roasterId INTEGER NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    country TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    phoneNumber TEXT,
    menuUrl TEXT,
    operatingHours TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (roasterId) REFERENCES roasters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS process_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS process_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoryId INTEGER NOT NULL,
    name TEXT NOT NULL UNIQUE,
    aliases TEXT,
    parentMethodId INTEGER,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (categoryId) REFERENCES process_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (parentMethodId) REFERENCES process_methods(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recipe_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    recipeId INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    UNIQUE(userId, recipeId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE
);
"""

INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_products_roaster ON products(roaster);
CREATE INDEX IF NOT EXISTS idx_products_roastType ON products(roastType);
CREATE INDEX IF NOT EXISTS idx_products_origin ON products(origin);
CREATE INDEX IF NOT EXISTS idx_products_process ON products(process);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_cuppingDate ON products(cuppingDate);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_product_variants_productId ON product_variants(productId);
CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId);
CREATE INDEX IF NOT EXISTS idx_brew_logs_beanInventoryId ON brew_logs(beanInventoryId);
CREATE INDEX IF NOT EXISTS idx_brew_logs_recipeId ON brew_logs(recipeId);
CREATE INDEX IF NOT EXISTS idx_brew_notes_productId ON brew_notes(productId);
CREATE INDEX IF NOT EXISTS idx_bean_inventory_productId ON bean_inventory(productId);
CREATE INDEX IF NOT EXISTS idx_roasters_name ON roasters(name);
CREATE INDEX IF NOT EXISTS idx_roaster_ratings_roasterId ON roaster_ratings(roasterId);
CREATE INDEX IF NOT EXISTS idx_roaster_locations_roasterId ON roaster_locations(roasterId);
CREATE INDEX IF NOT EXISTS idx_roaster_locations_city ON roaster_locations(city);
CREATE INDEX IF NOT EXISTS idx_roaster_locations_country ON roaster_locations(country);
CREATE INDEX IF NOT EXISTS idx_process_categories_name ON process_categories(name);
CREATE INDEX IF NOT EXISTS idx_process_methods_name ON process_methods(name);
CREATE INDEX IF NOT EXISTS idx_process_methods_categoryId ON process_methods(categoryId);
CREATE INDEX IF NOT EXISTS idx_process_methods_parentMethodId ON process_methods(parentMethodId);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId ON refresh_tokens(userId);
CREATE INDEX IF NOT EXISTS idx_bean_inventory_userId ON bean_inventory(userId);
CREATE INDEX IF NOT EXISTS idx_brew_logs_userId ON brew_logs(userId);
CREATE INDEX IF NOT EXISTS idx_recipes_userId ON recipes(userId);
CREATE INDEX IF NOT EXISTS idx_brew_notes_userId ON brew_notes(userId);
CREATE INDEX IF NOT EXISTS idx_community_posts_userId ON community_posts(userId);
CREATE INDEX IF NOT EXISTS idx_reviews_userId ON reviews(userId);
CREATE INDEX IF NOT EXISTS idx_recipe_likes_userId ON recipe_likes(userId);
CREATE INDEX IF NOT EXISTS idx_recipe_likes_recipeId ON recipe_likes(recipeId);
"""
