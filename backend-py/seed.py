"""Seed the FastAPI backend database from cleaned_coffee_products_v2.json."""

import json
import os
import re
import sqlite3
import sys

# Add parent so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import get_db, init_schema, run_migrations, close_db
from app.config import settings
from app.services.process_normalizer import normalize_process


def normalize_roast_type(raw):
    if not raw:
        return ""
    r = str(raw).strip()
    if re.match(r"^dark", r, re.IGNORECASE):
        return "Dark Roast"
    if re.match(r"^medium[\s-]dark", r, re.IGNORECASE):
        return "Medium-Dark Roast"
    if re.match(r"^medium", r, re.IGNORECASE):
        return "Medium Roast"
    if re.match(r"^light", r, re.IGNORECASE):
        return "Light Roast"
    return r


def categorize_product(name, description, roast_type, upstream_category=""):
    """Categorize product as Coffee, Tea, Accessories, Events, or Subscriptions."""
    lower_name = name.lower()
    lower_desc = (description or "").lower()

    if "subscription" in lower_name or "subscribe" in lower_name:
        return "Subscriptions"

    event_keywords = [
        "tasting session", "cupping session", "latte art", "throwdown",
        "workshop", "masterclass", "master class", "coffee walk", "brew class",
        "competition", "championship", "meetup", "meet up",
        "gully tour", "coffee tour", "coffee chronicles",
        "sca course", "sca brewing", "sca barista",
    ]
    if any(k in lower_name for k in event_keywords):
        return "Events"

    strong_tea = [
        "green tea", "black tea", "white tea", "oolong tea", "oolong",
        "rooibos", "herbal tea", "tisane", "earl grey", "matcha",
        "cascara", "blossom tea", "masala tea", "masala chai",
    ]
    tea_keywords = ["tea ", " tea", "chai ", " chai"]

    accessory_keywords = [
        "aeropress", "v60", "hario", "chemex", "french press", "moka pot",
        "dripper", "pour over", "grinder", "kettle", "gooseneck", "server",
        "mug", "tumbler", "cup", "scale ", "thermometer", "tamper",
        "filter paper", "t-shirt", "tshirt", "hoodie", "tote bag", "tote",
        "gift box", "gift set", "gift card", "hamper",
    ]
    coffee_keywords = [
        "roast", "beans", "bean ", "blend", "estate", "coffee", "peaberry",
        "arabica", "robusta", "microlot", "decaf", "espresso",
        "single origin", "washed", "honey process", "natural process",
        "anaerobic", "monsooned", "instant coffee", "filter coffee",
    ]

    has_strong_tea = any(k in lower_name for k in strong_tea)
    has_tea = has_strong_tea or any(k in lower_name for k in tea_keywords)
    has_coffee = any(k in lower_name for k in coffee_keywords)
    has_accessory = any(k in lower_name for k in accessory_keywords)
    has_roast_attr = bool(roast_type)

    if has_strong_tea and not has_coffee:
        return "Tea"
    if has_tea and not has_coffee:
        return "Tea"
    if has_accessory and not has_coffee:
        return "Accessories"
    if not has_coffee and not has_roast_attr:
        desc_coffee_hits = sum(1 for k in coffee_keywords if k in lower_desc)
        if desc_coffee_hits < 2:
            return "Accessories"

    return "Coffee"


def normalize_product(raw, index):
    raw_roast = raw.get("roastType") or raw.get("Roast_Level") or ""
    raw_process = raw.get("process") or raw.get("Process") or ""
    normalized_process = normalize_process(raw_process) or raw_process

    price_raw = raw.get("price") or raw.get("Price")
    price = None
    if price_raw is not None:
        cleaned = re.sub(r"[^0-9.]", "", str(price_raw))
        try:
            price = float(cleaned) if cleaned else None
        except ValueError:
            price = None

    name = raw.get("name") or raw.get("Name") or "Unknown Coffee"
    roast_type = normalize_roast_type(raw_roast)
    description = raw.get("description") or raw.get("Description") or raw.get("Desc") or ""
    upstream_cat = raw.get("category") or raw.get("Category") or ""

    return {
        "productId": str(raw.get("productId") or raw.get("id") or index + 1),
        "name": name,
        "roaster": raw.get("roaster") or raw.get("Roaster") or "Unknown Roaster",
        "roastType": roast_type,
        "origin": raw.get("origin") or raw.get("Origin") or raw.get("Farm") or "",
        "process": normalized_process,
        "tastingNotes": raw.get("tastingNotes") or raw.get("Tasting_Notes") or "",
        "score": float(raw["score"]) if raw.get("score") is not None else None,
        "price": price,
        "imageUrl": raw.get("imageUrl") or raw.get("Image_URL") or "",
        "cuppingDate": raw.get("cuppingDate") or None,
        "description": description,
        "url": raw.get("url") or raw.get("URL") or "",
        "quantity": raw.get("quantity") or raw.get("Quantity") or "",
        "category": categorize_product(name, description, roast_type, upstream_cat),
    }


def main():
    # Find the JSON file
    json_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not json_path:
        # Look in common locations
        candidates = [
            os.path.join("..", "cleaned_coffee_products_v2.json"),
            os.path.join("..", "results", "cleaned_coffee_products.json"),
            os.path.join("..", "cleaned_coffee_products.json"),
        ]
        for c in candidates:
            full = os.path.join(os.path.dirname(__file__), c)
            if os.path.exists(full):
                json_path = full
                break

    if not json_path or not os.path.exists(json_path):
        print("ERROR: Could not find product JSON file.")
        print("Usage: python seed.py [path/to/cleaned_coffee_products_v2.json]")
        sys.exit(1)

    print(f"Loading products from: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print("ERROR: Expected top-level JSON array of products.")
        sys.exit(1)

    print(f"Found {len(data)} raw product entries")

    # Initialize database
    db = get_db()
    init_schema(db)
    run_migrations(db)

    # Normalize all products
    normalized = [normalize_product(item, idx) for idx, item in enumerate(data)]

    # Deduplicate by name+roaster → canonical product + variants
    canonical_map = {}
    for p in normalized:
        key = f"{p['name'].lower()}::{p['roaster'].lower()}"
        if key not in canonical_map:
            canonical_map[key] = {"canonical": p, "variants": []}
        entry = canonical_map[key]
        entry["variants"].append({
            "quantity": p["quantity"],
            "price": p["price"],
            "originalProductId": p["productId"],
        })
        # Use lowest price as canonical
        if p["price"] is not None and (entry["canonical"]["price"] is None or p["price"] < entry["canonical"]["price"]):
            entry["canonical"]["price"] = p["price"]
            entry["canonical"]["quantity"] = p["quantity"]

    print(f"Deduplicated to {len(canonical_map)} canonical products")

    # Seed
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    product_count = 0

    sample_reviews = [
        {"reviewerName": "Coffee Lover", "rating": 5, "comment": "Fantastic cup, really enjoyed the balance and sweetness."},
        {"reviewerName": "Taster Bot", "rating": 4, "comment": "Great clarity and acidity, would buy again."},
    ]

    for entry in canonical_map.values():
        p = entry["canonical"]
        variants = entry["variants"]

        cursor = db.execute(
            """INSERT OR IGNORE INTO products (productId, name, roaster, roastType, origin, process, tastingNotes,
                score, price, imageUrl, cuppingDate, description, url, quantity, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [p["productId"], p["name"], p["roaster"], p["roastType"], p["origin"], p["process"],
             p["tastingNotes"], p["score"], p["price"], p["imageUrl"], p["cuppingDate"],
             p["description"], p["url"], p["quantity"], p["category"]],
        )
        db_id = cursor.lastrowid
        if db_id == 0:
            continue  # duplicate, skip

        product_count += 1
        if product_count % 100 == 0:
            print(f"  seeded {product_count} products...")

        # Insert variants if more than one
        if len(variants) > 1:
            for v in variants:
                db.execute(
                    "INSERT INTO product_variants (productId, quantity, price, originalProductId) VALUES (?, ?, ?, ?)",
                    [db_id, v["quantity"] or None, v["price"], v["originalProductId"]],
                )

        # Sample reviews
        for r in sample_reviews:
            db.execute(
                "INSERT INTO reviews (productId, reviewerName, rating, comment, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                [db_id, r["reviewerName"], r["rating"], r["comment"], now, now],
            )

    db.commit()
    print(f"\n✓ Seeded {product_count} products (from {len(normalized)} raw entries)")
    close_db()


if __name__ == "__main__":
    main()
