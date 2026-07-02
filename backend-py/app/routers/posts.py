"""Community posts router — feed with attached recipes."""

import json
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from ..database import get_db
from ..auth.dependencies import AuthUser, optional_auth

router = APIRouter(prefix="/api/posts", tags=["posts"])

POST_QUERY = """
    SELECT p.*,
        r.name AS recipe_name,
        r.brewerType AS recipe_brewerType,
        r.grindSize AS recipe_grindSize,
        r.coffeeGrams AS recipe_coffeeGrams,
        r.waterGrams AS recipe_waterGrams,
        r.waterTempC AS recipe_waterTempC,
        r.targetBrewTimeSec AS recipe_targetBrewTimeSec,
        r.bloomTimeSec AS recipe_bloomTimeSec,
        r.steps AS recipe_steps,
        r.notes AS recipe_notes,
        r.sourceRecipe AS recipe_sourceRecipe
    FROM community_posts p
    LEFT JOIN recipes r ON r.id = p.recipeId
"""


def _parse_post(row, columns):
    d = dict(zip(columns, row))
    # Extract recipe fields into attachedRecipe
    recipe_fields = {k: d.pop(k, None) for k in list(d.keys()) if k.startswith("recipe_")}
    if d.get("recipeId") and recipe_fields.get("recipe_name"):
        steps = []
        if recipe_fields.get("recipe_steps"):
            try:
                steps = json.loads(recipe_fields["recipe_steps"])
            except (json.JSONDecodeError, TypeError):
                pass
        d["attachedRecipe"] = {
            "id": d["recipeId"],
            "name": recipe_fields["recipe_name"],
            "brewerType": recipe_fields.get("recipe_brewerType"),
            "grindSize": recipe_fields.get("recipe_grindSize"),
            "coffeeGrams": recipe_fields.get("recipe_coffeeGrams"),
            "waterGrams": recipe_fields.get("recipe_waterGrams"),
            "waterTempC": recipe_fields.get("recipe_waterTempC"),
            "targetBrewTimeSec": recipe_fields.get("recipe_targetBrewTimeSec"),
            "bloomTimeSec": recipe_fields.get("recipe_bloomTimeSec"),
            "steps": steps,
            "notes": recipe_fields.get("recipe_notes"),
            "sourceRecipe": recipe_fields.get("recipe_sourceRecipe"),
            "authorName": d.get("authorName"),
            "isPublic": 1,
        }
    return d


@router.get("/")
async def list_posts(page: int = 1, limit: int = 30):
    db = get_db()
    page_num = max(1, page)
    page_size = min(100, max(1, limit))
    offset = (page_num - 1) * page_size

    count_row = db.execute("SELECT COUNT(*) FROM community_posts").fetchone()
    total = count_row[0]

    cursor = db.execute(f"{POST_QUERY} ORDER BY p.createdAt DESC LIMIT ? OFFSET ?", [page_size, offset])
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()

    return {
        "data": [_parse_post(r, columns) for r in rows],
        "pagination": {
            "page": page_num,
            "limit": page_size,
            "total": total,
            "totalPages": math.ceil(total / page_size) if page_size > 0 else 0,
        },
    }


class PostCreate(BaseModel):
    title: str
    body: Optional[str] = None
    authorName: Optional[str] = None
    recipeId: Optional[int] = None


@router.post("/", status_code=201)
async def create_post(post: PostCreate, user: AuthUser | None = Depends(optional_auth)):
    if not post.title or not post.title.strip():
        raise HTTPException(status_code=400, detail="title is required")

    db = get_db()
    safe_title = post.title.strip()[:200]
    safe_body = post.body.strip()[:10000] if post.body else None
    safe_author = post.authorName.strip()[:100] if post.authorName else None

    # Mark attached recipe as public
    if post.recipeId:
        recipe = db.execute("SELECT id FROM recipes WHERE id = ?", [post.recipeId]).fetchone()
        if not recipe:
            raise HTTPException(status_code=400, detail="Recipe not found")
        db.execute("UPDATE recipes SET isPublic = 1, authorName = ? WHERE id = ?", [safe_author, post.recipeId])

    now = datetime.now(timezone.utc).isoformat()
    user_id = user.id if user else None

    cursor = db.execute(
        "INSERT INTO community_posts (title, body, authorName, recipeId, likes, userId, createdAt) VALUES (?, ?, ?, ?, 0, ?, ?)",
        [safe_title, safe_body, safe_author, post.recipeId, user_id, now],
    )
    db.commit()
    new_id = cursor.lastrowid

    cursor2 = db.execute(f"{POST_QUERY} WHERE p.id = ?", [new_id])
    columns = [desc[0] for desc in cursor2.description]
    row = cursor2.fetchone()
    return _parse_post(row, columns)


@router.put("/{post_id}/like")
async def like_post(post_id: int):
    db = get_db()
    result = db.execute("UPDATE community_posts SET likes = likes + 1 WHERE id = ?", [post_id])
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    db.commit()
    row = db.execute("SELECT likes FROM community_posts WHERE id = ?", [post_id]).fetchone()
    return {"likes": row[0]}


@router.delete("/{post_id}", status_code=204)
async def delete_post(post_id: int, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    row = db.execute("SELECT userId FROM community_posts WHERE id = ?", [post_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    if row[0] and (not user or row[0] != user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")

    db.execute("DELETE FROM community_posts WHERE id = ?", [post_id])
    db.commit()
    return Response(status_code=204)
