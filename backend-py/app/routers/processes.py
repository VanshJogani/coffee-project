"""Processes router — coffee processing taxonomy."""

from fastapi import APIRouter

from ..database import get_db
from ..services.process_normalizer import COFFEE_PROCESSING_TAXONOMY, get_standard_processes

router = APIRouter(prefix="/api/processes", tags=["processes"])


@router.get("/taxonomy")
async def get_taxonomy():
    return COFFEE_PROCESSING_TAXONOMY


@router.get("/standard")
async def standard():
    return {"processes": get_standard_processes()}


@router.get("/hierarchical")
async def hierarchical():
    db = get_db()
    categories = db.execute("SELECT id, name, description FROM process_categories ORDER BY name").fetchall()

    result = {}
    for cat in categories:
        cat_id, cat_name, cat_desc = cat[0], cat[1], cat[2]
        methods_cursor = db.execute(
            "SELECT id, name, aliases, parentMethodId FROM process_methods WHERE categoryId = ? ORDER BY name",
            [cat_id],
        )
        methods = []
        for m in methods_cursor.fetchall():
            methods.append({
                "id": m[0], "name": m[1], "aliases": m[2], "parentMethodId": m[3],
            })
        result[cat_name] = {"description": cat_desc, "methods": methods}

    return result


@router.get("/categories")
async def list_categories():
    db = get_db()
    rows = db.execute("SELECT id, name, description, createdAt FROM process_categories ORDER BY name").fetchall()
    return [{"id": r[0], "name": r[1], "description": r[2], "createdAt": r[3]} for r in rows]


@router.get("/categories/{category_id}/methods")
async def category_methods(category_id: int):
    db = get_db()
    cat = db.execute("SELECT id, name FROM process_categories WHERE id = ?", [category_id]).fetchone()
    if not cat:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Category not found")

    rows = db.execute(
        "SELECT id, name, aliases, parentMethodId, createdAt FROM process_methods WHERE categoryId = ? ORDER BY name",
        [category_id],
    ).fetchall()
    return [{"id": r[0], "name": r[1], "aliases": r[2], "parentMethodId": r[3], "createdAt": r[4]} for r in rows]
