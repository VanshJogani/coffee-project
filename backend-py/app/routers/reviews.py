"""Reviews router — CRUD with ownership checks."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from ..database import get_db
from ..auth.dependencies import AuthUser, optional_auth

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    productId: int
    name: str
    rating: int
    comment: str | None = None


def _validate_review(product_id: int, name: str, rating: int, comment: str | None) -> list:
    errors = []
    if not product_id:
        errors.append("productId is required")
    if not name or not name.strip():
        errors.append("Reviewer name is required")
    elif len(name.strip()) > 100:
        errors.append("Reviewer name too long (max 100)")
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        errors.append("Rating must be an integer between 1 and 5")
    if comment and len(comment) > 2000:
        errors.append("Comment too long (max 2000)")
    return errors


@router.post("/", status_code=201)
async def create_review(body: ReviewCreate, user: AuthUser | None = Depends(optional_auth)):
    errors = _validate_review(body.productId, body.name, body.rating, body.comment)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    db = get_db()
    product = db.execute("SELECT id FROM products WHERE id = ?", [body.productId]).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.now(timezone.utc).isoformat()
    user_id = user.id if user else None

    cursor = db.execute(
        """INSERT INTO reviews (productId, reviewerName, rating, comment, userId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [body.productId, body.name.strip(), body.rating, body.comment, user_id, now, now],
    )
    db.commit()
    new_id = cursor.lastrowid

    row = db.execute(
        "SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt FROM reviews WHERE id = ?",
        [new_id],
    ).fetchone()
    return dict(zip(["id", "productId", "reviewerName", "rating", "comment", "createdAt", "updatedAt"], row))


@router.put("/{review_id}")
async def update_review(review_id: int, body: dict, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    existing = db.execute(
        "SELECT id, productId, reviewerName, rating, comment, userId, createdAt, updatedAt FROM reviews WHERE id = ?",
        [review_id],
    ).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Review not found")

    # Ownership check
    existing_user_id = existing[5]
    if user and existing_user_id and existing_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this review")

    name = body.get("name", existing[2])
    rating = body.get("rating", existing[3])
    comment = body.get("comment", existing[4])

    errors = _validate_review(existing[1], name, rating, comment)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE reviews SET reviewerName = ?, rating = ?, comment = ?, updatedAt = ? WHERE id = ?",
        [name.strip(), rating, comment, now, review_id],
    )
    db.commit()

    row = db.execute(
        "SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt FROM reviews WHERE id = ?",
        [review_id],
    ).fetchone()
    return dict(zip(["id", "productId", "reviewerName", "rating", "comment", "createdAt", "updatedAt"], row))


@router.delete("/{review_id}", status_code=204)
async def delete_review(review_id: int, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    row = db.execute("SELECT userId FROM reviews WHERE id = ?", [review_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")
    if user and row[0] and row[0] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this review")

    db.execute("DELETE FROM reviews WHERE id = ?", [review_id])
    db.commit()
    return Response(status_code=204)
