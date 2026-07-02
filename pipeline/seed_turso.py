"""
Seed cleaned product data into Turso (libsql over HTTP).
Mirrors backend/seed.js logic: normalize, dedup, insert products + variants + sample reviews.

Uses the Turso HTTP API directly (no extra dependency beyond `requests`).
Requires env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
"""
import json
import os
import re
import sys
from pathlib import Path

import requests


# ── Configuration ────────────────────────────────────────────────────────────

def _get_turso_url():
    return os.environ.get("TURSO_DATABASE_URL", "")

def _get_turso_token():
    return os.environ.get("TURSO_AUTH_TOKEN", "")

# Turso HTTP API endpoint — convert libsql:// URL to https:// with /v2/pipeline
# e.g. libsql://coffee-proj-vanshj2005.turso.io -> https://coffee-proj-vanshj2005.turso.io
def _get_http_url() -> str:
    url = _get_turso_url()
    if url.startswith("libsql://"):
        url = url.replace("libsql://", "https://")
    elif not url.startswith("http"):
        url = f"https://{url}"
    return url.rstrip("/")


# ── Turso HTTP helpers ────────────────────────────────────────────────────────

def _headers():
    return {
        "Authorization": f"Bearer {_get_turso_token()}",
        "Content-Type": "application/json",
    }


def execute_batch(statements: list[dict]) -> list:
    """Execute a batch of SQL statements via Turso HTTP pipeline API."""
    base = _get_http_url()
    url = f"{base}/v2/pipeline"

    # Build the pipeline request body
    requests_body = []
    for stmt in statements:
        if isinstance(stmt, str):
            requests_body.append({"type": "execute", "stmt": {"sql": stmt}})
        else:
            requests_body.append({"type": "execute", "stmt": stmt})
    requests_body.append({"type": "close"})

    resp = requests.post(url, json={"requests": requests_body}, headers=_headers(), timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP error {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    results = data.get("results", [])
    # Check for errors in batch
    for r in results:
        if r.get("type") == "error":
            raise RuntimeError(f"SQL error: {r['error']}")
    return results


def execute_one(sql: str, args: list | None = None) -> dict:
    """Execute a single statement and return the result."""
    stmt = {"sql": sql}
    if args:
        stmt["args"] = [_to_value(a) for a in args]

    base = _get_http_url()
    url = f"{base}/v2/pipeline"
    body = {
        "requests": [
            {"type": "execute", "stmt": stmt},
            {"type": "close"},
        ]
    }
    resp = requests.post(url, json=body, headers=_headers(), timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP error {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    results = data.get("results", [])
    if results and results[0].get("type") == "error":
        raise RuntimeError(f"SQL error: {results[0]['error']}")
    return results[0].get("response", {}).get("result", {}) if results else {}


def _to_value(v):
    """Convert Python value to Turso HTTP API value format."""
    if v is None:
        return {"type": "null", "value": None}
    elif isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    elif isinstance(v, float):
        return {"type": "float", "value": v}
    else:
        return {"type": "text", "value": str(v)}


# ── Product normalization (mirrors seed.js) ───────────────────────────────────

def normalize_roast_type(raw: str) -> str:
    if not raw:
        return ""
    r = raw.strip()
    if re.match(r"^dark", r, re.IGNORECASE):
        return "Dark Roast"
    if re.match(r"^medium[\s-]dark", r, re.IGNORECASE):
        return "Medium-Dark Roast"
    if re.match(r"^medium", r, re.IGNORECASE):
        return "Medium Roast"
    if re.match(r"^light", r, re.IGNORECASE):
        return "Light Roast"
    return r


def parse_price(raw) -> float | None:
    if raw is None or raw == "":
        return None
    cleaned = re.sub(r"[^0-9.]", "", str(raw))
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def normalize_product(raw: dict, index: int) -> dict:
    return {
        "productId": str(raw.get("productId") or raw.get("id") or index + 1),
        "name": raw.get("name") or raw.get("Name") or "Unknown Coffee",
        "roaster": raw.get("roaster") or raw.get("Roaster") or "Unknown Roaster",
        "roastType": normalize_roast_type(raw.get("roastType") or raw.get("Roast_Level") or ""),
        "origin": raw.get("origin") or raw.get("Origin") or raw.get("Farm") or "",
        "process": raw.get("process") or raw.get("Process") or "",
        "tastingNotes": raw.get("tastingNotes") or raw.get("Tasting_Notes") or "",
        "score": None,
        "price": parse_price(raw.get("price") or raw.get("Price")),
        "imageUrl": raw.get("imageUrl") or raw.get("Image_URL") or "",
        "cuppingDate": None,
        "description": raw.get("description") or raw.get("Desc") or raw.get("Description") or "",
        "url": raw.get("url") or raw.get("URL") or "",
        "quantity": raw.get("quantity") or raw.get("Quantity") or "",
        "category": _categorize(raw),
    }


def _categorize(raw: dict) -> str:
    """Categorize products — aligned with pipeline/cleaner.py classify_product."""
    name = (raw.get("name") or raw.get("Name") or "").lower()

    if "subscription" in name or "subscribe" in name:
        return "Subscriptions"

    event_keywords = [
        "tasting session", "cupping session", "latte art", "throwdown",
        "workshop", "masterclass", "master class", "coffee walk", "brew class",
        "competition", "championship", "meetup", "meet up",
        "gully tour", "coffee tour", "coffee chronicles",
        "sca course", "sca brewing", "sca barista",
    ]
    if any(k in name for k in event_keywords):
        return "Events"

    tea_keywords = [
        "green tea", "black tea", "white tea", "oolong", "rooibos",
        "herbal tea", "tisane", "earl grey", "matcha", "cascara",
        "blossom tea", "masala tea", "masala chai", "kombucha",
    ]
    if any(k in name for k in tea_keywords):
        return "Tea"

    accessory_keywords = [
        "aeropress", "v60", "chemex", "french press", "moka pot",
        "grinder", "kettle", "gooseneck", "server", "carafe",
        "mug", "tumbler", "cup", "scale ", "filter paper",
        "t-shirt", "tshirt", "hoodie", "tote", "sticker",
        "gift box", "gift set", "gift card", "hamper",
        "dripper", "pour over", "kalita", "hario", "brewer",
        "machine", "espresso machine", "coffee maker",
    ]
    coffee_keywords = [
        "roast", "beans", "bean ", "blend", "estate", "coffee",
        "peaberry", "arabica", "robusta", "microlot", "decaf",
        "single origin", "washed", "honey process", "natural process",
        "anaerobic", "monsooned", "instant coffee", "filter coffee",
    ]

    has_accessory = any(k in name for k in accessory_keywords)
    has_coffee = any(k in name for k in coffee_keywords)

    if has_accessory and not has_coffee:
        return "Accessories"

    # Quick Brews — drip bags, brew bags, instant, liquid coffee, pour over bags
    import re
    quick_brew_patterns = [
        r"drip\s*bag", r"brew\s*bag", r"pour\s*over\s*bag",
        r"instant\s*brew", r"cold\s*brew\s*bag",
        r"liquid\s*coffee", r"\bdoppio\b", r"\bsachet",
        r"quick\s*brew", r"brewin['’]?-?a-?cup",
        r"single\s*pour\s*drip", r"no\s*equipment\s*needed",
    ]
    if any(re.search(p, name) for p in quick_brew_patterns):
        return "Quick Brews"

    # Respect upstream category from cleaner (Quick Brews, Tea, Accessories, etc.)
    upstream = (raw.get("category") or raw.get("Category") or "").strip()
    if upstream and upstream != "Coffee" and not has_coffee:
        return upstream
    # If upstream says Quick Brews, trust it even with coffee keywords
    if upstream == "Quick Brews":
        return "Quick Brews"

    return "Coffee"


# ── Schema ────────────────────────────────────────────────────────────────────
# Only recreate product-related tables. User data (reviews, brew_logs, bean_inventory,
# recipes, user_profile, brew_notes) is preserved across reseeds.

# These tables are created ONCE (if not exist) — never dropped by the scraper.
USER_TABLES_SQL = [
    """CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        userId INTEGER,
        reviewerName TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )""",
    """CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        displayName TEXT DEFAULT 'Brewer',
        defaultGrinder TEXT,
        defaultBrewer TEXT,
        createdAt TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS recipes (
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
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS bean_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER,
        customName TEXT,
        customRoaster TEXT,
        gramsRemaining REAL DEFAULT 0,
        purchaseDate TEXT,
        openedDate TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
    )""",
    """CREATE TABLE IF NOT EXISTS brew_logs (
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
        createdAt TEXT NOT NULL,
        FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE SET NULL,
        FOREIGN KEY (beanInventoryId) REFERENCES bean_inventory(id) ON DELETE SET NULL
    )""",
    """CREATE TABLE IF NOT EXISTS brew_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        authorName TEXT NOT NULL,
        body TEXT NOT NULL,
        brewLogId INTEGER,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (brewLogId) REFERENCES brew_logs(id) ON DELETE SET NULL
    )""",
]

# Product tables — dropped and recreated on every seed
PRODUCT_SCHEMA_SQL = [
    "DROP TABLE IF EXISTS product_variants",
    "DROP TABLE IF EXISTS products",
    """CREATE TABLE products (
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
    )""",
    """CREATE TABLE product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        quantity TEXT,
        price REAL,
        originalProductId TEXT,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )""",
    "CREATE INDEX IF NOT EXISTS idx_products_roaster ON products(roaster)",
    "CREATE INDEX IF NOT EXISTS idx_products_roastType ON products(roastType)",
    "CREATE INDEX IF NOT EXISTS idx_products_origin ON products(origin)",
    "CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)",
    "CREATE INDEX IF NOT EXISTS idx_products_cuppingDate ON products(cuppingDate)",
    "CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)",
    "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)",
    "CREATE INDEX IF NOT EXISTS idx_product_variants_productId ON product_variants(productId)",
]

# Indexes for user tables (created once)
USER_INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId)",
    "CREATE INDEX IF NOT EXISTS idx_brew_logs_beanInventoryId ON brew_logs(beanInventoryId)",
    "CREATE INDEX IF NOT EXISTS idx_brew_logs_recipeId ON brew_logs(recipeId)",
    "CREATE INDEX IF NOT EXISTS idx_brew_notes_productId ON brew_notes(productId)",
    "CREATE INDEX IF NOT EXISTS idx_bean_inventory_productId ON bean_inventory(productId)",
]


# Turso HTTP API has limits per pipeline request — batch in chunks
BATCH_SIZE = 80  # statements per pipeline call (conservative, Turso limit is ~100)


def _stable_product_id(name: str, roaster: str) -> str:
    """Generate a stable product ID from name+roaster so IDs survive reseeds.

    This ensures that user reviews, brew logs, and bean inventory referencing
    a product by its productId remain valid after a full reseed.
    """
    import hashlib
    key = f"{name.strip().lower()}::{roaster.strip().lower()}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def seed(json_path: Path) -> None:
    """Seed products into Turso. Only replaces product data — user data is preserved."""
    if not _get_turso_url() or not _get_turso_token():
        print("ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.")
        sys.exit(1)

    print(f"Loading data from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print("ERROR: expected top-level JSON array")
        sys.exit(1)

    print(f"Loaded {len(data)} raw products. Normalizing...")

    # Normalize
    normalized = [normalize_product(item, idx) for idx, item in enumerate(data)]

    # Dedup: group by (name_lower, roaster_lower) → canonical + variants
    canonical_map: dict[str, dict] = {}
    for p in normalized:
        key = f"{p['name'].lower()}::{p['roaster'].lower()}"
        if key not in canonical_map:
            # Use stable product ID so user data (reviews, brew logs) survives reseed
            p["productId"] = _stable_product_id(p["name"], p["roaster"])
            canonical_map[key] = {"canonical": p, "variants": []}
        entry = canonical_map[key]
        entry["variants"].append({"quantity": p["quantity"], "price": p["price"], "originalProductId": p["productId"]})
        # Use lowest price as canonical
        if p["price"] is not None and (entry["canonical"]["price"] is None or p["price"] < entry["canonical"]["price"]):
            entry["canonical"]["price"] = p["price"]
            entry["canonical"]["quantity"] = p["quantity"]

    print(f"Deduped to {len(canonical_map)} canonical products.")

    # Step 1: Ensure user tables exist (never dropped)
    print("Ensuring user tables exist...")
    execute_batch(USER_TABLES_SQL + USER_INDEXES_SQL)

    # Step 2: Drop and recreate product tables only
    print("Replacing product data...")
    execute_batch(PRODUCT_SCHEMA_SQL)
    print("Product schema ready.")

    # Step 3: Insert products in batches
    product_count = 0
    batch_stmts = []

    for entry in canonical_map.values():
        p = entry["canonical"]

        # Insert product
        batch_stmts.append({
            "sql": """INSERT INTO products (productId, name, roaster, roastType, origin, process,
                      tastingNotes, score, price, imageUrl, cuppingDate, description, url, quantity, category)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            "args": [
                _to_value(p["productId"]), _to_value(p["name"]), _to_value(p["roaster"]),
                _to_value(p["roastType"]), _to_value(p["origin"]), _to_value(p["process"]),
                _to_value(p["tastingNotes"]), _to_value(p["score"]), _to_value(p["price"]),
                _to_value(p["imageUrl"]), _to_value(p["cuppingDate"]), _to_value(p["description"]),
                _to_value(p["url"]), _to_value(p["quantity"]), _to_value(p["category"]),
            ],
        })
        product_count += 1

        # Flush if batch is full
        if len(batch_stmts) >= BATCH_SIZE:
            execute_batch(batch_stmts)
            batch_stmts = []
            print(f"  Inserted {product_count} products...")

    # Flush remaining
    if batch_stmts:
        execute_batch(batch_stmts)
        print(f"  Inserted {product_count} products...")

    # Step 4: Insert variants (need product IDs from DB)
    print("Inserting variants...")
    result = execute_one("SELECT id, productId FROM products")
    rows = result.get("rows", [])
    id_map = {}  # productId -> db id
    for row in rows:
        # Turso HTTP API returns rows as arrays of {type, value}
        db_id = row[0].get("value") if isinstance(row[0], dict) else row[0]
        prod_id = row[1].get("value") if isinstance(row[1], dict) else row[1]
        id_map[str(prod_id)] = int(db_id)

    batch_stmts = []
    for entry in canonical_map.values():
        p = entry["canonical"]
        variants = entry["variants"]
        db_id = id_map.get(p["productId"])
        if db_id is None:
            continue

        # Variants (only if >1)
        if len(variants) > 1:
            for v in variants:
                batch_stmts.append({
                    "sql": "INSERT INTO product_variants (productId, quantity, price, originalProductId) VALUES (?, ?, ?, ?)",
                    "args": [_to_value(db_id), _to_value(v["quantity"] or None), _to_value(v["price"]), _to_value(v["originalProductId"])],
                })

        if len(batch_stmts) >= BATCH_SIZE:
            execute_batch(batch_stmts)
            batch_stmts = []

    if batch_stmts:
        execute_batch(batch_stmts)

    print(f"\nDone! Seeded {product_count} products (from {len(normalized)} raw) into Turso.")
    print("User data (reviews, brew logs, recipes, inventory) preserved.")


def main():
    args = sys.argv[1:]
    json_path = Path(args[0]) if args else Path(__file__).resolve().parents[1] / "results" / "cleaned_coffee_products.json"

    if not json_path.exists():
        print(f"ERROR: JSON file not found: {json_path}")
        sys.exit(1)

    seed(json_path)


if __name__ == "__main__":
    main()
