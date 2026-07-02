"""Inventory router — user's bean collection (private per user)."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from ..database import get_db
from ..auth.dependencies import AuthUser, optional_auth, require_auth

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

INVENTORY_JOIN_SQL = """
    SELECT bi.*,
        COALESCE(p.name, bi.customName, 'Unknown Bean') as displayName,
        COALESCE(p.roaster, bi.customRoaster, '') as displayRoaster,
        p.imageUrl, p.tastingNotes, p.roastType, p.origin
    FROM bean_inventory bi
    LEFT JOIN products p ON p.id = bi.productId
"""


def _row_to_dict(row, cursor):
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


@router.get("/")
async def list_inventory(user: AuthUser | None = Depends(optional_auth)):
    if not user:
        return []
    db = get_db()
    cursor = db.execute(f"{INVENTORY_JOIN_SQL} WHERE bi.userId = ? ORDER BY bi.createdAt DESC", [user.id])
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, r)) for r in rows]


@router.get("/{item_id}")
async def get_inventory_item(item_id: int):
    db = get_db()
    cursor = db.execute(f"{INVENTORY_JOIN_SQL} WHERE bi.id = ?", [item_id])
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Bean not found")
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


class InventoryCreate(BaseModel):
    productId: Optional[int] = None
    customName: Optional[str] = None
    customRoaster: Optional[str] = None
    gramsRemaining: Optional[float] = 0
    purchaseDate: Optional[str] = None
    openedDate: Optional[str] = None
    notes: Optional[str] = None


@router.post("/", status_code=201)
async def create_inventory(body: InventoryCreate, user: AuthUser | None = Depends(optional_auth)):
    if not body.productId and not body.customName:
        raise HTTPException(status_code=400, detail="productId or customName required")

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    user_id = user.id if user else None

    cursor = db.execute(
        """INSERT INTO bean_inventory (productId, customName, customRoaster, gramsRemaining, purchaseDate, openedDate, notes, userId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [body.productId, body.customName, body.customRoaster,
         body.gramsRemaining or 0, body.purchaseDate, body.openedDate, body.notes, user_id, now, now],
    )
    db.commit()
    new_id = cursor.lastrowid

    cursor2 = db.execute(f"{INVENTORY_JOIN_SQL} WHERE bi.id = ?", [new_id])
    row = cursor2.fetchone()
    columns = [desc[0] for desc in cursor2.description]
    return dict(zip(columns, row))


@router.put("/{item_id}")
async def update_inventory(item_id: int, body: dict, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    cur = db.execute("SELECT * FROM bean_inventory WHERE id = ?", [item_id])
    existing_row = cur.fetchone()
    if not existing_row:
        raise HTTPException(status_code=404, detail="Bean not found")

    cols = [desc[0] for desc in cur.description]
    existing = dict(zip(cols, existing_row))

    if existing.get("userId") and (not user or existing["userId"] != user.id):
        raise HTTPException(status_code=403, detail="Not authorized to edit this bean")

    if "gramsRemaining" in body:
        if not isinstance(body["gramsRemaining"], (int, float)) or body["gramsRemaining"] < 0:
            raise HTTPException(status_code=400, detail="gramsRemaining must be a non-negative number")

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        """UPDATE bean_inventory SET productId=?, customName=?, customRoaster=?,
            gramsRemaining=?, purchaseDate=?, openedDate=?, notes=?, updatedAt=? WHERE id=?""",
        [
            body.get("productId", existing["productId"]),
            body.get("customName", existing.get("customName")),
            body.get("customRoaster", existing.get("customRoaster")),
            body.get("gramsRemaining", existing["gramsRemaining"]),
            body.get("purchaseDate", existing.get("purchaseDate")),
            body.get("openedDate", existing.get("openedDate")),
            body.get("notes", existing.get("notes")),
            now, item_id,
        ],
    )
    db.commit()

    cursor = db.execute(f"{INVENTORY_JOIN_SQL} WHERE bi.id = ?", [item_id])
    row = cursor.fetchone()
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


@router.delete("/{item_id}", status_code=204)
async def delete_inventory(item_id: int, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    row = db.execute("SELECT userId FROM bean_inventory WHERE id = ?", [item_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Bean not found")
    if row[0] and (not user or row[0] != user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this bean")

    db.execute("DELETE FROM bean_inventory WHERE id = ?", [item_id])
    db.commit()
    return Response(status_code=204)
