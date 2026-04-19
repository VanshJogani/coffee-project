const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

function parseSteps(row) {
  return { ...row, steps: row.steps ? JSON.parse(row.steps) : [] };
}

// GET /api/recipes?community=1  — public community recipes only
// GET /api/recipes               — all (built-in + user custom)
router.get("/", (req, res, next) => {
  try {
    const db = getDb();
    const { community } = req.query;
    let rows;
    if (community === "1" || community === "true") {
      rows = db.prepare(
        "SELECT * FROM recipes WHERE isPublic = 1 ORDER BY createdAt DESC"
      ).all();
    } else {
      rows = db.prepare(
        "SELECT * FROM recipes WHERE isPublic = 0 OR isBuiltIn = 1 ORDER BY isBuiltIn DESC, createdAt DESC"
      ).all();
    }
    res.json(rows.map(parseSteps));
  } catch (err) { next(err); }
});

// GET /api/recipes/:id
router.get("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const row = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Recipe not found" });
    res.json(parseSteps(row));
  } catch (err) { next(err); }
});

// POST /api/recipes
router.post("/", (req, res, next) => {
  try {
    const db = getDb();
    const { name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
            bloomTimeSec, targetBrewTimeSec, steps, sourceRecipe, notes,
            isPublic, authorName, authorSetup,
            roastLevel, coffeeBrand, coffeeName } = req.body;
    if (!name || !brewerType) return res.status(400).json({ error: "name and brewerType are required" });
    const now = new Date().toISOString();
    const info = db.prepare(
      `INSERT INTO recipes (name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
        bloomTimeSec, targetBrewTimeSec, steps, isBuiltIn, sourceRecipe, notes,
        isPublic, authorName, authorSetup, roastLevel, coffeeBrand, coffeeName,
        createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name, brewerType, grindSize || null, coffeeGrams || null, waterGrams || null,
          waterTempC || null, bloomTimeSec || null, targetBrewTimeSec || null,
          steps ? JSON.stringify(steps) : null, sourceRecipe || null, notes || null,
          isPublic ? 1 : 0, authorName || null,
          authorSetup ? JSON.stringify(authorSetup) : null,
          roastLevel || null, coffeeBrand || null, coffeeName || null,
          now, now);
    const created = db.prepare("SELECT * FROM recipes WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(parseSteps(created));
  } catch (err) { next(err); }
});

// PUT /api/recipes/:id
router.put("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Recipe not found" });
    if (existing.isBuiltIn) return res.status(403).json({ error: "Built-in recipes cannot be edited — fork it first" });
    const b = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE recipes SET name=?, brewerType=?, grindSize=?, coffeeGrams=?, waterGrams=?, waterTempC=?,
        bloomTimeSec=?, targetBrewTimeSec=?, steps=?, sourceRecipe=?, notes=?,
        isPublic=?, authorName=?, roastLevel=?, coffeeBrand=?, coffeeName=?,
        updatedAt=? WHERE id=?`
    ).run(b.name ?? existing.name, b.brewerType ?? existing.brewerType,
          b.grindSize ?? existing.grindSize, b.coffeeGrams ?? existing.coffeeGrams,
          b.waterGrams ?? existing.waterGrams, b.waterTempC ?? existing.waterTempC,
          b.bloomTimeSec ?? existing.bloomTimeSec, b.targetBrewTimeSec ?? existing.targetBrewTimeSec,
          b.steps ? JSON.stringify(b.steps) : existing.steps,
          b.sourceRecipe ?? existing.sourceRecipe, b.notes ?? existing.notes,
          b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : existing.isPublic,
          b.authorName ?? existing.authorName,
          b.roastLevel ?? existing.roastLevel, b.coffeeBrand ?? existing.coffeeBrand,
          b.coffeeName ?? existing.coffeeName,
          now, id);
    const updated = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
    res.json(parseSteps(updated));
  } catch (err) { next(err); }
});

// DELETE /api/recipes/:id
router.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = db.prepare("SELECT id, isBuiltIn FROM recipes WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Recipe not found" });
    if (existing.isBuiltIn) return res.status(403).json({ error: "Built-in recipes cannot be deleted" });
    db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
