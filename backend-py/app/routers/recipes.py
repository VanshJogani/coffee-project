"""Recipes router — CRUD, community, likes, random."""

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from ..database import get_db
from ..auth.dependencies import AuthUser, optional_auth, require_auth

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _parse_recipe(row, columns):
    """Convert row to dict, parsing JSON steps and authorSetup."""
    d = dict(zip(columns, row))
    if d.get("steps"):
        try:
            d["steps"] = json.loads(d["steps"])
        except (json.JSONDecodeError, TypeError):
            d["steps"] = []
    else:
        d["steps"] = []
    if d.get("authorSetup"):
        try:
            d["authorSetup"] = json.loads(d["authorSetup"])
        except (json.JSONDecodeError, TypeError):
            d["authorSetup"] = None
    return d


def _get_recipe_columns(db):
    cursor = db.execute("SELECT * FROM recipes LIMIT 0")
    return [desc[0] for desc in cursor.description]


@router.get("/")
async def list_recipes(
    community: Optional[str] = None,
    user: AuthUser | None = Depends(optional_auth),
):
    db = get_db()
    columns = _get_recipe_columns(db)

    if community in ("1", "true"):
        rows = db.execute("SELECT * FROM recipes WHERE isPublic = 1 ORDER BY createdAt DESC").fetchall()
    elif user:
        rows = db.execute(
            "SELECT * FROM recipes WHERE isBuiltIn = 1 OR userId = ? ORDER BY isBuiltIn DESC, createdAt DESC",
            [user.id],
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM recipes WHERE isPublic = 0 OR isBuiltIn = 1 ORDER BY isBuiltIn DESC, createdAt DESC"
        ).fetchall()

    return [_parse_recipe(r, columns) for r in rows]


@router.get("/random")
async def random_recipe(
    brewerType: Optional[str] = None,
    roastLevel: Optional[str] = None,
    coffeeBrand: Optional[str] = None,
):
    db = get_db()
    conditions = ["(isPublic = 0 OR isBuiltIn = 1)"]
    args = []

    if brewerType:
        conditions.append("brewerType = ?")
        args.append(brewerType)
    if roastLevel:
        conditions.append("roastLevel = ?")
        args.append(roastLevel)
    if coffeeBrand:
        conditions.append("coffeeBrand = ?")
        args.append(coffeeBrand)

    where = " AND ".join(conditions)
    columns = _get_recipe_columns(db)
    row = db.execute(f"SELECT * FROM recipes WHERE {where} ORDER BY RANDOM() LIMIT 1", args).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No recipes match the filters")

    return _parse_recipe(row, columns)


@router.get("/liked")
async def liked_recipes(user: AuthUser | None = Depends(optional_auth)):
    if not user:
        return []
    db = get_db()
    rows = db.execute("SELECT recipeId FROM recipe_likes WHERE userId = ?", [user.id]).fetchall()
    return [r[0] for r in rows]


@router.post("/{recipe_id}/like")
async def like_recipe(recipe_id: int, user: AuthUser = Depends(require_auth)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT OR IGNORE INTO recipe_likes (userId, recipeId, createdAt) VALUES (?, ?, ?)",
        [user.id, recipe_id, now],
    )
    db.commit()
    return {"liked": True}


@router.delete("/{recipe_id}/like")
async def unlike_recipe(recipe_id: int, user: AuthUser = Depends(require_auth)):
    db = get_db()
    db.execute("DELETE FROM recipe_likes WHERE userId = ? AND recipeId = ?", [user.id, recipe_id])
    db.commit()
    return {"liked": False}


@router.get("/{recipe_id}")
async def get_recipe(recipe_id: int):
    db = get_db()
    columns = _get_recipe_columns(db)
    row = db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return _parse_recipe(row, columns)


class RecipeCreate(BaseModel):
    name: str
    brewerType: str
    grindSize: Optional[str] = None
    coffeeGrams: Optional[float] = None
    waterGrams: Optional[float] = None
    waterTempC: Optional[int] = None
    bloomTimeSec: Optional[int] = None
    targetBrewTimeSec: Optional[int] = None
    steps: Optional[list] = None
    sourceRecipe: Optional[str] = None
    notes: Optional[str] = None
    isPublic: Optional[bool] = False
    authorName: Optional[str] = None
    authorSetup: Optional[dict] = None
    roastLevel: Optional[str] = None
    coffeeBrand: Optional[str] = None
    coffeeName: Optional[str] = None


@router.post("/", status_code=201)
async def create_recipe(body: RecipeCreate, user: AuthUser | None = Depends(optional_auth)):
    if not body.name or not body.brewerType:
        raise HTTPException(status_code=400, detail="name and brewerType are required")

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    user_id = user.id if user else None

    cursor = db.execute(
        """INSERT INTO recipes (name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
            bloomTimeSec, targetBrewTimeSec, steps, isBuiltIn, sourceRecipe, notes,
            isPublic, authorName, authorSetup, roastLevel, coffeeBrand, coffeeName,
            userId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            body.name, body.brewerType, body.grindSize, body.coffeeGrams, body.waterGrams,
            body.waterTempC, body.bloomTimeSec, body.targetBrewTimeSec,
            json.dumps(body.steps) if body.steps else None,
            body.sourceRecipe, body.notes,
            1 if body.isPublic else 0, body.authorName,
            json.dumps(body.authorSetup) if body.authorSetup else None,
            body.roastLevel, body.coffeeBrand, body.coffeeName,
            user_id, now, now,
        ],
    )
    db.commit()
    recipe_id = cursor.lastrowid

    columns = _get_recipe_columns(db)
    row = db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id]).fetchone()
    return _parse_recipe(row, columns)


@router.put("/{recipe_id}")
async def update_recipe(recipe_id: int, body: dict, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    columns = _get_recipe_columns(db)
    row = db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")

    existing = dict(zip(columns, row))
    if existing.get("isBuiltIn"):
        raise HTTPException(status_code=403, detail="Built-in recipes cannot be edited — fork it first")
    if user and existing.get("userId") and existing["userId"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this recipe")

    now = datetime.now(timezone.utc).isoformat()
    steps_val = json.dumps(body["steps"]) if "steps" in body and body["steps"] is not None else existing.get("steps")

    db.execute(
        """UPDATE recipes SET name=?, brewerType=?, grindSize=?, coffeeGrams=?, waterGrams=?, waterTempC=?,
            bloomTimeSec=?, targetBrewTimeSec=?, steps=?, sourceRecipe=?, notes=?,
            isPublic=?, authorName=?, roastLevel=?, coffeeBrand=?, coffeeName=?,
            updatedAt=? WHERE id=?""",
        [
            body.get("name", existing["name"]),
            body.get("brewerType", existing["brewerType"]),
            body.get("grindSize", existing.get("grindSize")),
            body.get("coffeeGrams", existing.get("coffeeGrams")),
            body.get("waterGrams", existing.get("waterGrams")),
            body.get("waterTempC", existing.get("waterTempC")),
            body.get("bloomTimeSec", existing.get("bloomTimeSec")),
            body.get("targetBrewTimeSec", existing.get("targetBrewTimeSec")),
            steps_val,
            body.get("sourceRecipe", existing.get("sourceRecipe")),
            body.get("notes", existing.get("notes")),
            (1 if body["isPublic"] else 0) if "isPublic" in body else existing.get("isPublic"),
            body.get("authorName", existing.get("authorName")),
            body.get("roastLevel", existing.get("roastLevel")),
            body.get("coffeeBrand", existing.get("coffeeBrand")),
            body.get("coffeeName", existing.get("coffeeName")),
            now, recipe_id,
        ],
    )
    db.commit()

    updated_row = db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id]).fetchone()
    return _parse_recipe(updated_row, columns)


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(recipe_id: int, user: AuthUser | None = Depends(optional_auth)):
    db = get_db()
    row = db.execute("SELECT id, isBuiltIn, userId FROM recipes WHERE id = ?", [recipe_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if row[1]:  # isBuiltIn
        raise HTTPException(status_code=403, detail="Built-in recipes cannot be deleted")
    if user and row[2] and row[2] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this recipe")

    db.execute("DELETE FROM recipes WHERE id = ?", [recipe_id])
    db.commit()
    return Response(status_code=204)
