"""Brew logs router — session history with inventory decrement."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from ..database import get_db
from ..auth.dependencies import AuthUser, optional_auth

router = APIRouter(prefix="/api/brew-logs", tags=["brew-logs"])


def _rows_to_dicts(cursor):
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, r)) for r in cursor.fetchall()]


def _row_to_dict(cursor, row):
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


@router.get("/")
async def list_brew_logs(
    productId: Optional[int] = None,
    isPublic: Optional[str] = None,
    limit: int = 200,
    user: AuthUser | None = Depends(optional_auth),
):
    db = get_db()
    where_clauses = []
    params = []

    if user:
        where_clauses.append("bl.userId = ?")
        params.append(user.id)
    else:
        # Unauthenticated callers may only see public logs
        where_clauses.append("bl.isPublic = 1")

    if productId:
        where_clauses.append("bi.productId = ?")
        params.append(productId)

    if isPublic is not None:
        where_clauses.append("bl.isPublic = ?")
        params.append(1 if isPublic in ("1", "true") else 0)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    safe_limit = min(int(limit), 500)

    cursor = db.execute(
        f"""SELECT bl.*,
            CASE WHEN bi.productId IS NOT NULL THEN p.name ELSE bi.customName END as beanName,
            CASE WHEN bi.productId IS NOT NULL THEN p.roaster ELSE bi.customRoaster END as beanRoaster,
            bi.productId as catalogProductId,
            r.name as recipeName
        FROM brew_logs bl
        LEFT JOIN bean_inventory bi ON bi.id = bl.beanInventoryId
        LEFT JOIN products p ON p.id = bi.productId
        LEFT JOIN recipes r ON r.id = bl.recipeId
        {where_sql}
        ORDER BY bl.createdAt DESC
        LIMIT ?""",
        [*params, safe_limit],
    )
    return _rows_to_dicts(cursor)


@router.get("/{log_id}")
async def get_brew_log(log_id: int):
    db = get_db()
    cursor = db.execute("SELECT * FROM brew_logs WHERE id = ?", [log_id])
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Brew log not found")
    return _row_to_dict(cursor, row)


class BrewLogCreate(BaseModel):
    recipeId: Optional[int] = None
    beanInventoryId: Optional[int] = None
    brewerName: Optional[str] = None
    grinderName: Optional[str] = None
    grindSize: Optional[str] = None
    coffeeGrams: Optional[float] = None
    waterGrams: Optional[float] = None
    waterTempC: Optional[int] = None
    brewTimeSec: Optional[int] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    isPublic: Optional[bool] = True


@router.post("/", status_code=201)
async def create_brew_log(body: BrewLogCreate, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    user_id = user.id if user else None

    cursor = db.execute(
        """INSERT INTO brew_logs (recipeId, beanInventoryId, brewerName, grinderName, grindSize,
            coffeeGrams, waterGrams, waterTempC, brewTimeSec, rating, notes, isPublic, userId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            body.recipeId, body.beanInventoryId, body.brewerName, body.grinderName,
            body.grindSize, body.coffeeGrams, body.waterGrams, body.waterTempC,
            body.brewTimeSec, body.rating, body.notes,
            1 if body.isPublic is not False else 0, user_id, now,
        ],
    )

    # Decrement inventory if bean + grams provided — only for the owning user
    if body.beanInventoryId and body.coffeeGrams:
        ownership_clause = "AND userId = ?" if user else "AND userId IS NULL"
        ownership_params = [user.id] if user else []
        db.execute(
            f"UPDATE bean_inventory SET gramsRemaining = MAX(0, gramsRemaining - ?), updatedAt = ? WHERE id = ? {ownership_clause}",
            [body.coffeeGrams, now, body.beanInventoryId, *ownership_params],
        )

    db.commit()
    new_id = cursor.lastrowid

    cursor2 = db.execute("SELECT * FROM brew_logs WHERE id = ?", [new_id])
    row = cursor2.fetchone()
    return _row_to_dict(cursor2, row)


@router.put("/{log_id}")
async def update_brew_log(log_id: int, body: dict, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    existing_cursor = db.execute("SELECT * FROM brew_logs WHERE id = ?", [log_id])
    existing_row = existing_cursor.fetchone()
    if not existing_row:
        raise HTTPException(status_code=404, detail="Brew log not found")

    existing = _row_to_dict(existing_cursor, existing_row)

    if existing.get("userId") and (not user or existing["userId"] != user.id):
        raise HTTPException(status_code=403, detail="Not authorized to edit this brew log")

    ALLOWED = {"recipeId", "beanInventoryId", "brewerName", "grinderName", "grindSize",
               "coffeeGrams", "waterGrams", "waterTempC", "brewTimeSec", "rating", "notes"}
    updates = {k: v for k, v in body.items() if k in ALLOWED}
    if "isPublic" in body:
        updates["isPublic"] = 1 if body["isPublic"] else 0
    if not updates:
        return existing

    set_clause = ", ".join(f"{k}=?" for k in updates)
    db.execute(
        f"UPDATE brew_logs SET {set_clause} WHERE id=?",
        [*updates.values(), log_id],
    )
    db.commit()

    cursor = db.execute("SELECT * FROM brew_logs WHERE id = ?", [log_id])
    row = cursor.fetchone()
    return _row_to_dict(cursor, row)


@router.delete("/{log_id}", status_code=204)
async def delete_brew_log(log_id: int, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    row = db.execute("SELECT userId FROM brew_logs WHERE id = ?", [log_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Brew log not found")
    if row[0] and (not user or row[0] != user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this brew log")

    db.execute("DELETE FROM brew_logs WHERE id = ?", [log_id])
    db.commit()
    return Response(status_code=204)
