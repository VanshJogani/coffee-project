"""Brew notes router — per-product tasting notes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from ..database import get_db
from ..auth.dependencies import AuthUser, optional_auth

router = APIRouter(prefix="/api/brew-notes", tags=["brew-notes"])


@router.get("/")
async def list_brew_notes(productId: int = Query(...)):
    db = get_db()
    cursor = db.execute(
        """SELECT bn.*, bl.brewerName, bl.coffeeGrams, bl.waterGrams, bl.brewTimeSec, bl.rating as brewRating
        FROM brew_notes bn
        LEFT JOIN brew_logs bl ON bl.id = bn.brewLogId
        WHERE bn.productId = ?
        ORDER BY bn.createdAt DESC""",
        [productId],
    )
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, r)) for r in cursor.fetchall()]


class BrewNoteCreate(BaseModel):
    productId: int
    authorName: str
    body: str
    brewLogId: int | None = None


@router.post("/", status_code=201)
async def create_brew_note(body: BrewNoteCreate, user: AuthUser | None = Depends(optional_auth)):
    if not body.productId or not body.authorName or not body.body:
        raise HTTPException(status_code=400, detail="productId, authorName, and body are required")
    if len(body.body.strip()) < 3:
        raise HTTPException(status_code=400, detail="Note too short")

    db = get_db()
    product = db.execute("SELECT id FROM products WHERE id = ?", [body.productId]).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.now(timezone.utc).isoformat()
    user_id = user.id if user else None

    cursor = db.execute(
        "INSERT INTO brew_notes (productId, authorName, body, brewLogId, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
        [body.productId, body.authorName.strip()[:80], body.body.strip()[:2000], body.brewLogId, user_id, now],
    )
    db.commit()
    new_id = cursor.lastrowid

    cursor2 = db.execute("SELECT * FROM brew_notes WHERE id = ?", [new_id])
    row = cursor2.fetchone()
    columns = [desc[0] for desc in cursor2.description]
    return dict(zip(columns, row))


@router.delete("/{note_id}", status_code=204)
async def delete_brew_note(note_id: int, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    row = db.execute("SELECT userId FROM brew_notes WHERE id = ?", [note_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")
    if row[0] and (not user or row[0] != user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this note")

    db.execute("DELETE FROM brew_notes WHERE id = ?", [note_id])
    db.commit()
    return Response(status_code=204)
