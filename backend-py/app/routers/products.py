"""Products router — filtering, pagination, detail."""

import json
import math
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from ..database import get_db
from ..services.origin_normalizer import normalize_origin
from ..services.process_normalizer import COFFEE_PROCESSING_TAXONOMY, get_standard_processes

router = APIRouter(prefix="/api/products", tags=["products"])


def _dict_from_row(row, columns):
    """Convert a sqlite3 row tuple to a dict using column names."""
    return dict(zip(columns, row))


@router.get("/filter-options")
async def filter_options(category: Optional[str] = None):
    db = get_db()
    cat_filter = ""
    params = []
    if category:
        cat_filter = "WHERE p.category = ?"
        params = [category]

    and_or_where = "AND" if cat_filter else "WHERE"

    roaster_rows = db.execute(
        f"SELECT DISTINCT p.roaster FROM products p {cat_filter} {and_or_where} p.roaster IS NOT NULL AND p.roaster != '' ORDER BY p.roaster",
        params,
    ).fetchall()
    roasters = [r[0] for r in roaster_rows]

    roast_type_rows = db.execute(
        f"SELECT DISTINCT p.roastType FROM products p {cat_filter} {and_or_where} p.roastType IS NOT NULL AND p.roastType != '' ORDER BY p.roastType",
        params,
    ).fetchall()
    roast_types = [r[0] for r in roast_type_rows]

    origin_rows = db.execute(
        f"SELECT DISTINCT p.origin FROM products p {cat_filter} {and_or_where} p.origin IS NOT NULL AND p.origin != '' ORDER BY p.origin",
        params,
    ).fetchall()
    origins_raw = [r[0] for r in origin_rows]

    # Normalize and deduplicate origins
    seen_origins = {}
    for o in origins_raw:
        normalized = normalize_origin(o)
        if normalized and normalized.lower() not in seen_origins:
            seen_origins[normalized.lower()] = normalized
    origins = sorted(seen_origins.values())

    process_rows = db.execute(
        f"SELECT DISTINCT p.process FROM products p {cat_filter} {and_or_where} p.process IS NOT NULL AND p.process != '' ORDER BY p.process",
        params,
    ).fetchall()
    processes = [r[0] for r in process_rows]

    price_row = db.execute(
        f"SELECT MIN(p.price) as minPrice, MAX(p.price) as maxPrice FROM products p {cat_filter} {and_or_where} p.price IS NOT NULL AND p.price > 0",
        params,
    ).fetchone()

    return {
        "roasters": roasters,
        "roastTypes": roast_types,
        "origins": origins,
        "processes": processes,
        "priceMin": math.floor(price_row[0] or 0) if price_row else 0,
        "priceMax": math.ceil(price_row[1] or 10000) if price_row else 10000,
    }


@router.get("/grouped-processes")
async def grouped_processes(category: Optional[str] = None):
    db = get_db()
    params = []
    cat_filter = ""
    if category:
        cat_filter = "AND p.category = ?"
        params = [category]

    rows = db.execute(
        f"SELECT DISTINCT p.process FROM products p WHERE p.process IS NOT NULL AND p.process != '' {cat_filter} ORDER BY p.process",
        params,
    ).fetchall()
    product_processes = [r[0] for r in rows]

    grouped = {}
    for cat_name, cat_data in COFFEE_PROCESSING_TAXONOMY.items():
        methods = cat_data["methods"]
        category_methods = [m for m in methods if m in product_processes]
        if category_methods:
            grouped[cat_name] = {
                "description": cat_data["description"],
                "methods": category_methods,
            }

    return {"grouped": grouped}


@router.get("/standard-processes")
async def standard_processes():
    return {"processes": get_standard_processes()}


@router.get("/")
async def list_products(
    roaster: Optional[str] = None,
    roastType: Optional[str] = None,
    origin: Optional[str] = None,
    process: Optional[str] = Query(None, alias="process"),
    category: Optional[str] = None,
    search: Optional[str] = None,
    flavour: Optional[str] = None,
    priceMin: Optional[str] = None,
    priceMax: Optional[str] = None,
    sort: str = "newest",
    page: int = 1,
    limit: int = 20,
):
    db = get_db()
    page_num = max(1, page)
    page_size = min(200, max(1, limit))
    offset = (page_num - 1) * page_size

    where_clauses = []
    params = []

    if category:
        where_clauses.append("p.category = ?")
        params.append(category)

    if roaster:
        items = [r.strip() for r in roaster.split(",") if r.strip()]
        if items:
            where_clauses.append(f"p.roaster IN ({','.join('?' * len(items))})")
            params.extend(items)

    if roastType:
        items = [r.strip() for r in roastType.split(",") if r.strip()]
        if items:
            where_clauses.append(f"p.roastType IN ({','.join('?' * len(items))})")
            params.extend(items)

    if origin:
        origin_list = [r.strip() for r in origin.split(",") if r.strip()]
        # Match raw origin values that normalize to the selected canonical origins
        all_origin_rows = db.execute(
            "SELECT DISTINCT origin FROM products WHERE origin IS NOT NULL AND origin != ''"
        ).fetchall()
        all_origins = [r[0] for r in all_origin_rows]
        matching_raw = [
            o for o in all_origins
            if normalize_origin(o) and any(
                sel.lower() == normalize_origin(o).lower() for sel in origin_list
            )
        ]
        if matching_raw:
            where_clauses.append(f"p.origin IN ({','.join('?' * len(matching_raw))})")
            params.extend(matching_raw)
        else:
            where_clauses.append(f"p.origin IN ({','.join('?' * len(origin_list))})")
            params.extend(origin_list)

    if process:
        items = [r.strip() for r in process.split(",") if r.strip()]
        if items:
            where_clauses.append(f"p.process IN ({','.join('?' * len(items))})")
            params.extend(items)

    if flavour:
        items = [f.strip() for f in flavour.split(",") if f.strip()]
        for f in items:
            escaped = f.lower().replace("%", "\\%").replace("_", "\\_")
            where_clauses.append(
                "(LOWER(p.tastingNotes) LIKE ? ESCAPE '\\' OR LOWER(p.description) LIKE ? ESCAPE '\\')"
            )
            params.extend([f"%{escaped}%", f"%{escaped}%"])

    if priceMin is not None and priceMin != "":
        where_clauses.append("p.price IS NOT NULL AND p.price >= ?")
        params.append(float(priceMin))

    if priceMax is not None and priceMax != "":
        where_clauses.append("p.price IS NOT NULL AND p.price <= ?")
        params.append(float(priceMax))

    if search:
        escaped = search.replace("%", "\\%").replace("_", "\\_")
        like = f"%{escaped}%"
        where_clauses.append(
            "(p.name LIKE ? ESCAPE '\\' OR p.roaster LIKE ? ESCAPE '\\' OR p.tastingNotes LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')"
        )
        params.extend([like, like, like, like])

    # Sort
    order_by = "p.id DESC"
    if sort == "rating":
        order_by = "avgRating DESC"
    elif sort == "roastType":
        order_by = "p.roastType ASC, p.name ASC"
    elif sort == "priceAsc":
        order_by = "(p.price IS NULL OR p.price = 0) ASC, p.price ASC"
    elif sort == "priceDesc":
        order_by = "(p.price IS NULL OR p.price = 0) ASC, p.price DESC"
    elif sort == "discover":
        order_by = "RANDOM()"
    elif sort == "newest":
        order_by = "p.cuppingDate DESC, p.id DESC"

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Count
    count_row = db.execute(
        f"SELECT COUNT(DISTINCT p.id) as total FROM products p {where_sql}",
        params,
    ).fetchone()
    total = count_row[0]

    # Fetch
    rows = db.execute(
        f"""SELECT p.*,
            IFNULL(AVG(r.rating), 0) as avgRating,
            COUNT(r.id) as reviewCount
        FROM products p
        LEFT JOIN reviews r ON r.productId = p.id
        {where_sql}
        GROUP BY p.id
        ORDER BY {order_by}
        LIMIT ? OFFSET ?""",
        [*params, page_size, offset],
    ).fetchall()

    # Get column names
    cursor = db.execute(f"SELECT p.*, IFNULL(AVG(r.rating), 0) as avgRating, COUNT(r.id) as reviewCount FROM products p LEFT JOIN reviews r ON r.productId = p.id LIMIT 0")
    columns = [desc[0] for desc in cursor.description]

    data = [_dict_from_row(row, columns) for row in rows]

    return {
        "data": data,
        "pagination": {
            "page": page_num,
            "limit": page_size,
            "total": total,
            "totalPages": math.ceil(total / page_size) if page_size > 0 else 0,
        },
    }


@router.get("/{product_id}")
async def get_product(product_id: int):
    db = get_db()

    row = db.execute(
        """SELECT p.*,
            IFNULL(AVG(r.rating), 0) as avgRating,
            COUNT(r.id) as reviewCount
        FROM products p
        LEFT JOIN reviews r ON r.productId = p.id
        WHERE p.id = ?
        GROUP BY p.id""",
        [product_id],
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get column names
    cursor = db.execute("SELECT p.*, IFNULL(AVG(r.rating), 0) as avgRating, COUNT(r.id) as reviewCount FROM products p LEFT JOIN reviews r ON r.productId = p.id LIMIT 0")
    columns = [desc[0] for desc in cursor.description]
    product = _dict_from_row(row, columns)

    # Reviews
    review_rows = db.execute(
        "SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt FROM reviews WHERE productId = ? ORDER BY createdAt DESC",
        [product_id],
    ).fetchall()
    reviews = [dict(zip(["id", "productId", "reviewerName", "rating", "comment", "createdAt", "updatedAt"], r)) for r in review_rows]

    # Variants
    variant_rows = db.execute(
        "SELECT id, quantity, price FROM product_variants WHERE productId = ? ORDER BY price ASC",
        [product_id],
    ).fetchall()
    variants = [dict(zip(["id", "quantity", "price"], v)) for v in variant_rows]

    return {**product, "reviews": reviews, "variants": variants}
