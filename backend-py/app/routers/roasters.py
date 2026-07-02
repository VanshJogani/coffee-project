"""Roasters router — profiles, ratings, locations."""

import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from ..database import get_db

router = APIRouter(prefix="/api/roasters", tags=["roasters"])


@router.get("/")
async def list_roasters(
    sort: str = "name",
    page: int = 1,
    limit: int = 20,
    search: str = "",
):
    db = get_db()
    page_num = max(1, page)
    page_size = min(100, max(1, limit))
    offset = (page_num - 1) * page_size

    order_by = "r.name ASC"
    if sort == "rating":
        order_by = "rr.overallRating DESC"
    elif sort == "established":
        order_by = "r.establishedYear DESC"

    search_filter = ""
    search_params = []
    if search:
        search_filter = "AND (r.name LIKE ? OR r.description LIKE ?)"
        search_params = [f"%{search}%", f"%{search}%"]

    cursor = db.execute(
        f"""SELECT r.id, r.name, r.websiteUrl, r.establishedYear, r.description,
            rr.overallRating, rr.consistencyRating, rr.experimentationRating, rr.totalReviews,
            COUNT(DISTINCT rl.id) as locationCount, r.createdAt, r.updatedAt
        FROM roasters r
        LEFT JOIN roaster_ratings rr ON r.id = rr.roasterId
        LEFT JOIN roaster_locations rl ON r.id = rl.roasterId
        WHERE 1=1 {search_filter}
        GROUP BY r.id
        ORDER BY {order_by}
        LIMIT ? OFFSET ?""",
        [*search_params, page_size, offset],
    )
    columns = [desc[0] for desc in cursor.description]
    roasters = [dict(zip(columns, r)) for r in cursor.fetchall()]

    count_row = db.execute(
        f"SELECT COUNT(*) FROM roasters r WHERE 1=1 {search_filter}",
        search_params,
    ).fetchone()
    total = count_row[0]

    return {
        "roasters": roasters,
        "pagination": {
            "page": page_num,
            "limit": page_size,
            "total": total,
            "pages": math.ceil(total / page_size) if page_size > 0 else 0,
        },
    }


@router.get("/{roaster_id}")
async def get_roaster(roaster_id: int):
    db = get_db()
    cursor = db.execute(
        "SELECT id, name, websiteUrl, establishedYear, description, createdAt, updatedAt FROM roasters WHERE id = ?",
        [roaster_id],
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Roaster not found")

    columns = [desc[0] for desc in cursor.description]
    roaster = dict(zip(columns, row))

    ratings_row = db.execute(
        "SELECT id, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt FROM roaster_ratings WHERE roasterId = ?",
        [roaster_id],
    ).fetchone()
    roaster["ratings"] = dict(zip(
        ["id", "overallRating", "consistencyRating", "experimentationRating", "totalReviews", "updatedAt"],
        ratings_row,
    )) if ratings_row else None

    loc_cursor = db.execute(
        "SELECT id, city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours, createdAt, updatedAt FROM roaster_locations WHERE roasterId = ? ORDER BY city ASC",
        [roaster_id],
    )
    loc_columns = [desc[0] for desc in loc_cursor.description]
    roaster["locations"] = [dict(zip(loc_columns, r)) for r in loc_cursor.fetchall()]

    return roaster


@router.get("/{roaster_id}/ratings")
async def get_roaster_ratings(roaster_id: int):
    db = get_db()
    roaster = db.execute("SELECT id FROM roasters WHERE id = ?", [roaster_id]).fetchone()
    if not roaster:
        raise HTTPException(status_code=404, detail="Roaster not found")

    row = db.execute(
        "SELECT id, roasterId, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt FROM roaster_ratings WHERE roasterId = ?",
        [roaster_id],
    ).fetchone()

    if row:
        return dict(zip(["id", "roasterId", "overallRating", "consistencyRating", "experimentationRating", "totalReviews", "updatedAt"], row))
    return {"roasterId": roaster_id, "overallRating": 0, "consistencyRating": 0, "experimentationRating": 0, "totalReviews": 0}


@router.get("/{roaster_id}/locations")
async def get_roaster_locations(roaster_id: int):
    db = get_db()
    roaster = db.execute("SELECT id FROM roasters WHERE id = ?", [roaster_id]).fetchone()
    if not roaster:
        raise HTTPException(status_code=404, detail="Roaster not found")

    cursor = db.execute(
        "SELECT id, roasterId, city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours, createdAt, updatedAt FROM roaster_locations WHERE roasterId = ? ORDER BY country, state, city",
        [roaster_id],
    )
    columns = [desc[0] for desc in cursor.description]
    return {"locations": [dict(zip(columns, r)) for r in cursor.fetchall()]}


class RoasterCreate(BaseModel):
    name: str
    websiteUrl: Optional[str] = None
    establishedYear: Optional[int] = None
    description: Optional[str] = None


@router.post("/", status_code=201)
async def create_roaster(body: RoasterCreate):
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    cursor = db.execute(
        "INSERT INTO roasters (name, websiteUrl, establishedYear, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [body.name.strip(), body.websiteUrl, body.establishedYear, body.description, now, now],
    )
    roaster_id = cursor.lastrowid

    db.execute(
        "INSERT INTO roaster_ratings (roasterId, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt) VALUES (?, 0, 0, 0, 0, ?)",
        [roaster_id, now],
    )
    db.commit()

    return {
        "id": roaster_id, "name": body.name.strip(), "websiteUrl": body.websiteUrl,
        "establishedYear": body.establishedYear, "description": body.description,
        "createdAt": now, "updatedAt": now,
    }


@router.put("/{roaster_id}")
async def update_roaster(roaster_id: int, body: dict):
    db = get_db()
    existing_row = db.execute("SELECT * FROM roasters WHERE id = ?", [roaster_id]).fetchone()
    if not existing_row:
        raise HTTPException(status_code=404, detail="Roaster not found")

    cols = [desc[0] for desc in db.execute("SELECT * FROM roasters LIMIT 0").description]
    existing = dict(zip(cols, existing_row))
    now = datetime.now(timezone.utc).isoformat()

    name = body.get("name", existing["name"])
    if isinstance(name, str):
        name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    db.execute(
        "UPDATE roasters SET name = ?, websiteUrl = ?, establishedYear = ?, description = ?, updatedAt = ? WHERE id = ?",
        [
            name,
            body.get("websiteUrl", existing.get("websiteUrl")),
            body.get("establishedYear", existing.get("establishedYear")),
            body.get("description", existing.get("description")),
            now, roaster_id,
        ],
    )
    db.commit()

    cursor = db.execute("SELECT * FROM roasters WHERE id = ?", [roaster_id])
    row = cursor.fetchone()
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


@router.post("/{roaster_id}/ratings")
async def upsert_roaster_ratings(roaster_id: int, body: dict):
    db = get_db()
    roaster = db.execute("SELECT id FROM roasters WHERE id = ?", [roaster_id]).fetchone()
    if not roaster:
        raise HTTPException(status_code=404, detail="Roaster not found")

    now = datetime.now(timezone.utc).isoformat()
    existing = db.execute("SELECT id FROM roaster_ratings WHERE roasterId = ?", [roaster_id]).fetchone()

    if existing:
        db.execute(
            "UPDATE roaster_ratings SET overallRating = ?, consistencyRating = ?, experimentationRating = ?, totalReviews = ?, updatedAt = ? WHERE roasterId = ?",
            [body.get("overallRating", 0), body.get("consistencyRating", 0), body.get("experimentationRating", 0), body.get("totalReviews", 0), now, roaster_id],
        )
    else:
        db.execute(
            "INSERT INTO roaster_ratings (roasterId, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
            [roaster_id, body.get("overallRating", 0), body.get("consistencyRating", 0), body.get("experimentationRating", 0), body.get("totalReviews", 0), now],
        )
    db.commit()

    row = db.execute("SELECT * FROM roaster_ratings WHERE roasterId = ?", [roaster_id]).fetchone()
    cols = [desc[0] for desc in db.execute("SELECT * FROM roaster_ratings LIMIT 0").description]
    return dict(zip(cols, row))


class LocationCreate(BaseModel):
    city: str
    state: Optional[str] = None
    country: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phoneNumber: Optional[str] = None
    menuUrl: Optional[str] = None
    operatingHours: Optional[str] = None


@router.post("/{roaster_id}/locations", status_code=201)
async def create_location(roaster_id: int, body: LocationCreate):
    if not body.city or not body.country:
        raise HTTPException(status_code=400, detail="City and country are required")

    db = get_db()
    roaster = db.execute("SELECT id FROM roasters WHERE id = ?", [roaster_id]).fetchone()
    if not roaster:
        raise HTTPException(status_code=404, detail="Roaster not found")

    now = datetime.now(timezone.utc).isoformat()
    cursor = db.execute(
        "INSERT INTO roaster_locations (roasterId, city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [roaster_id, body.city, body.state, body.country, body.address, body.latitude, body.longitude, body.phoneNumber, body.menuUrl, body.operatingHours, now, now],
    )
    db.commit()

    return {
        "id": cursor.lastrowid, "roasterId": roaster_id, "city": body.city,
        "state": body.state, "country": body.country, "address": body.address,
        "latitude": body.latitude, "longitude": body.longitude,
        "phoneNumber": body.phoneNumber, "menuUrl": body.menuUrl,
        "operatingHours": body.operatingHours, "createdAt": now, "updatedAt": now,
    }


@router.put("/{roaster_id}/locations/{location_id}")
async def update_location(roaster_id: int, location_id: int, body: dict):
    db = get_db()
    existing_row = db.execute(
        "SELECT * FROM roaster_locations WHERE id = ? AND roasterId = ?", [location_id, roaster_id]
    ).fetchone()
    if not existing_row:
        raise HTTPException(status_code=404, detail="Location not found")

    cols = [desc[0] for desc in db.execute("SELECT * FROM roaster_locations LIMIT 0").description]
    existing = dict(zip(cols, existing_row))
    now = datetime.now(timezone.utc).isoformat()

    db.execute(
        "UPDATE roaster_locations SET city=?, state=?, country=?, address=?, latitude=?, longitude=?, phoneNumber=?, menuUrl=?, operatingHours=?, updatedAt=? WHERE id=?",
        [
            body.get("city", existing["city"]), body.get("state", existing.get("state")),
            body.get("country", existing["country"]), body.get("address", existing.get("address")),
            body.get("latitude", existing.get("latitude")), body.get("longitude", existing.get("longitude")),
            body.get("phoneNumber", existing.get("phoneNumber")), body.get("menuUrl", existing.get("menuUrl")),
            body.get("operatingHours", existing.get("operatingHours")), now, location_id,
        ],
    )
    db.commit()

    cursor = db.execute("SELECT * FROM roaster_locations WHERE id = ?", [location_id])
    row = cursor.fetchone()
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


@router.delete("/{roaster_id}/locations/{location_id}", status_code=204)
async def delete_location(roaster_id: int, location_id: int):
    db = get_db()
    row = db.execute("SELECT id FROM roaster_locations WHERE id = ? AND roasterId = ?", [location_id, roaster_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Location not found")

    db.execute("DELETE FROM roaster_locations WHERE id = ?", [location_id])
    db.commit()
    return Response(status_code=204)
