const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

function parseSteps(row) {
  let steps = [];
  if (row.steps) {
    try { steps = JSON.parse(row.steps); } catch { steps = []; }
  }
  return { ...row, steps };
}

// GET /api/recipes?community=1  — public community recipes only
// GET /api/recipes               — all (built-in + user custom)
router.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { community } = req.query;
    let rows;
    if (community === "1" || community === "true") {
      const result = await db.execute(
        "SELECT * FROM recipes WHERE isPublic = 1 ORDER BY createdAt DESC"
      );
      rows = result.rows;
    } else if (req.user) {
      // Logged in: show built-in + user's own recipes
      const result = await db.execute({
        sql: "SELECT * FROM recipes WHERE isBuiltIn = 1 OR userId = ? ORDER BY isBuiltIn DESC, createdAt DESC",
        args: [req.user.id]
      });
      rows = result.rows;
    } else {
      // Anonymous: show built-in + all non-public recipes (backward compat)
      const result = await db.execute(
        "SELECT * FROM recipes WHERE isPublic = 0 OR isBuiltIn = 1 ORDER BY isBuiltIn DESC, createdAt DESC"
      );
      rows = result.rows;
    }
    res.json(rows.map(parseSteps));
  } catch (err) { next(err); }
});

// GET /api/recipes/random — return one random recipe (optionally filtered)
router.get("/random", async (req, res, next) => {
  try {
    const db = getDb();
    const { brewerType, roastLevel, coffeeBrand } = req.query;

    const conditions = ["(isPublic = 0 OR isBuiltIn = 1)"];
    const args = [];

    if (brewerType) {
      conditions.push("brewerType = ?");
      args.push(brewerType);
    }
    if (roastLevel) {
      conditions.push("roastLevel = ?");
      args.push(roastLevel);
    }
    if (coffeeBrand) {
      conditions.push("coffeeBrand = ?");
      args.push(coffeeBrand);
    }

    const where = conditions.join(" AND ");
    const { rows } = await db.execute({
      sql: `SELECT * FROM recipes WHERE ${where} ORDER BY RANDOM() LIMIT 1`,
      args,
    });

    if (!rows[0]) return res.status(404).json({ error: "No recipes match the filters" });
    res.json(parseSteps(rows[0]));
  } catch (err) { next(err); }
});

// GET /api/recipes/liked — return array of recipe IDs the user has liked
router.get("/liked", async (req, res, next) => {
  try {
    if (!req.user) return res.json([]);
    const db = getDb();
    const { rows } = await db.execute({
      sql: "SELECT recipeId FROM recipe_likes WHERE userId = ?",
      args: [req.user.id]
    });
    res.json(rows.map(r => r.recipeId));
  } catch (err) { next(err); }
});

// POST /api/recipes/:id/like — like a recipe
router.post("/:id/like", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Login required" });
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const now = new Date().toISOString();
    await db.execute({
      sql: "INSERT OR IGNORE INTO recipe_likes (userId, recipeId, createdAt) VALUES (?, ?, ?)",
      args: [req.user.id, id, now]
    });
    res.json({ liked: true });
  } catch (err) { next(err); }
});

// DELETE /api/recipes/:id/like — unlike a recipe
router.delete("/:id/like", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Login required" });
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    await db.execute({
      sql: "DELETE FROM recipe_likes WHERE userId = ? AND recipeId = ?",
      args: [req.user.id, id]
    });
    res.json({ liked: false });
  } catch (err) { next(err); }
});

// GET /api/recipes/:id
router.get("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows } = await db.execute({ sql: "SELECT * FROM recipes WHERE id = ?", args: [id] });
    if (!rows[0]) return res.status(404).json({ error: "Recipe not found" });
    res.json(parseSteps(rows[0]));
  } catch (err) { next(err); }
});

// POST /api/recipes
router.post("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
            bloomTimeSec, targetBrewTimeSec, steps, sourceRecipe, notes,
            isPublic, authorName, authorSetup,
            roastLevel, coffeeBrand, coffeeName } = req.body;
    if (!name || !brewerType) return res.status(400).json({ error: "name and brewerType are required" });
    const now = new Date().toISOString();
    const userId = req.user ? req.user.id : null;
    const result = await db.execute({
      sql: `INSERT INTO recipes (name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
        bloomTimeSec, targetBrewTimeSec, steps, isBuiltIn, sourceRecipe, notes,
        isPublic, authorName, authorSetup, roastLevel, coffeeBrand, coffeeName,
        userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, brewerType, grindSize || null, coffeeGrams ?? null, waterGrams ?? null,
            waterTempC ?? null, bloomTimeSec ?? null, targetBrewTimeSec ?? null,
            steps ? JSON.stringify(steps) : null, sourceRecipe || null, notes || null,
            isPublic ? 1 : 0, authorName || null,
            authorSetup ? JSON.stringify(authorSetup) : null,
            roastLevel || null, coffeeBrand || null, coffeeName || null,
            userId, now, now]
    });
    const { rows: created } = await db.execute({ sql: "SELECT * FROM recipes WHERE id = ?", args: [Number(result.lastInsertRowid)] });
    res.status(201).json(parseSteps(created[0]));
  } catch (err) { next(err); }
});

// PUT /api/recipes/:id
router.put("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows: existingRows } = await db.execute({ sql: "SELECT * FROM recipes WHERE id = ?", args: [id] });
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Recipe not found" });
    if (existing.isBuiltIn) return res.status(403).json({ error: "Built-in recipes cannot be edited — fork it first" });
    if (req.user && existing.userId && existing.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to edit this recipe" });
    }
    const b = req.body;
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE recipes SET name=?, brewerType=?, grindSize=?, coffeeGrams=?, waterGrams=?, waterTempC=?,
        bloomTimeSec=?, targetBrewTimeSec=?, steps=?, sourceRecipe=?, notes=?,
        isPublic=?, authorName=?, roastLevel=?, coffeeBrand=?, coffeeName=?,
        updatedAt=? WHERE id=?`,
      args: [b.name ?? existing.name, b.brewerType ?? existing.brewerType,
            b.grindSize ?? existing.grindSize, b.coffeeGrams ?? existing.coffeeGrams,
            b.waterGrams ?? existing.waterGrams, b.waterTempC ?? existing.waterTempC,
            b.bloomTimeSec ?? existing.bloomTimeSec, b.targetBrewTimeSec ?? existing.targetBrewTimeSec,
            b.steps ? JSON.stringify(b.steps) : existing.steps,
            b.sourceRecipe ?? existing.sourceRecipe, b.notes ?? existing.notes,
            b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : existing.isPublic,
            b.authorName ?? existing.authorName,
            b.roastLevel ?? existing.roastLevel, b.coffeeBrand ?? existing.coffeeBrand,
            b.coffeeName ?? existing.coffeeName,
            now, id]
    });
    const { rows: updated } = await db.execute({ sql: "SELECT * FROM recipes WHERE id = ?", args: [id] });
    res.json(parseSteps(updated[0]));
  } catch (err) { next(err); }
});

// DELETE /api/recipes/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows: existingRows } = await db.execute({ sql: "SELECT id, isBuiltIn, userId FROM recipes WHERE id = ?", args: [id] });
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Recipe not found" });
    if (existing.isBuiltIn) return res.status(403).json({ error: "Built-in recipes cannot be deleted" });
    if (req.user && existing.userId && existing.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this recipe" });
    }
    await db.execute({ sql: "DELETE FROM recipes WHERE id = ?", args: [id] });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
