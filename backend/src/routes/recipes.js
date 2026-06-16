const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

function parseSteps(row) {
  return { ...row, steps: row.steps ? JSON.parse(row.steps) : [] };
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
    } else {
      const result = await db.execute(
        "SELECT * FROM recipes WHERE isPublic = 0 OR isBuiltIn = 1 ORDER BY isBuiltIn DESC, createdAt DESC"
      );
      rows = result.rows;
    }
    res.json(rows.map(parseSteps));
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
    const result = await db.execute({
      sql: `INSERT INTO recipes (name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
        bloomTimeSec, targetBrewTimeSec, steps, isBuiltIn, sourceRecipe, notes,
        isPublic, authorName, authorSetup, roastLevel, coffeeBrand, coffeeName,
        createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, brewerType, grindSize || null, coffeeGrams || null, waterGrams || null,
            waterTempC || null, bloomTimeSec || null, targetBrewTimeSec || null,
            steps ? JSON.stringify(steps) : null, sourceRecipe || null, notes || null,
            isPublic ? 1 : 0, authorName || null,
            authorSetup ? JSON.stringify(authorSetup) : null,
            roastLevel || null, coffeeBrand || null, coffeeName || null,
            now, now]
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
    const { rows: existingRows } = await db.execute({ sql: "SELECT id, isBuiltIn FROM recipes WHERE id = ?", args: [id] });
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Recipe not found" });
    if (existing.isBuiltIn) return res.status(403).json({ error: "Built-in recipes cannot be deleted" });
    await db.execute({ sql: "DELETE FROM recipes WHERE id = ?", args: [id] });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
