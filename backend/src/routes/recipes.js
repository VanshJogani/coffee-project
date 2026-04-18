const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

function dbGet(db, sql, params = {}) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
  );
}
function dbAll(db, sql, params = {}) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
  );
}
function dbRun(db, sql, params = {}) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes }); })
  );
}

// GET /api/recipes — list all (built-in first, then user-created)
router.get("/", async (req, res, next) => {
  const db = getDb();
  try {
    const rows = await dbAll(db, "SELECT * FROM recipes ORDER BY isBuiltIn DESC, createdAt DESC");
    res.json(rows.map(r => ({ ...r, steps: r.steps ? JSON.parse(r.steps) : [] })));
  } catch (err) { next(err); }
});

// GET /api/recipes/:id
router.get("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await dbGet(db, "SELECT * FROM recipes WHERE id = @id", { id });
    if (!row) return res.status(404).json({ error: "Recipe not found" });
    res.json({ ...row, steps: row.steps ? JSON.parse(row.steps) : [] });
  } catch (err) { next(err); }
});

// POST /api/recipes
router.post("/", async (req, res, next) => {
  const db = getDb();
  const { name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
          bloomTimeSec, targetBrewTimeSec, steps, sourceRecipe, notes } = req.body;
  if (!name || !brewerType) return res.status(400).json({ error: "name and brewerType are required" });
  const now = new Date().toISOString();
  try {
    const info = await dbRun(db,
      `INSERT INTO recipes (name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
        bloomTimeSec, targetBrewTimeSec, steps, isBuiltIn, sourceRecipe, notes, createdAt, updatedAt)
       VALUES (@name, @brewerType, @grindSize, @coffeeGrams, @waterGrams, @waterTempC,
        @bloomTimeSec, @targetBrewTimeSec, @steps, 0, @sourceRecipe, @notes, @now, @now)`,
      { name, brewerType, grindSize: grindSize || null, coffeeGrams: coffeeGrams || null,
        waterGrams: waterGrams || null, waterTempC: waterTempC || null,
        bloomTimeSec: bloomTimeSec || null, targetBrewTimeSec: targetBrewTimeSec || null,
        steps: steps ? JSON.stringify(steps) : null, sourceRecipe: sourceRecipe || null,
        notes: notes || null, now }
    );
    const created = await dbGet(db, "SELECT * FROM recipes WHERE id = @id", { id: info.lastID });
    res.status(201).json({ ...created, steps: created.steps ? JSON.parse(created.steps) : [] });
  } catch (err) { next(err); }
});

// PUT /api/recipes/:id
router.put("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await dbGet(db, "SELECT * FROM recipes WHERE id = @id", { id });
    if (!existing) return res.status(404).json({ error: "Recipe not found" });
    if (existing.isBuiltIn) return res.status(403).json({ error: "Built-in recipes cannot be edited — fork it first" });
    const b = req.body;
    const now = new Date().toISOString();
    await dbRun(db,
      `UPDATE recipes SET name=@name, brewerType=@brewerType, grindSize=@grindSize,
        coffeeGrams=@coffeeGrams, waterGrams=@waterGrams, waterTempC=@waterTempC,
        bloomTimeSec=@bloomTimeSec, targetBrewTimeSec=@targetBrewTimeSec,
        steps=@steps, sourceRecipe=@sourceRecipe, notes=@notes, updatedAt=@now
       WHERE id=@id`,
      { id, name: b.name ?? existing.name, brewerType: b.brewerType ?? existing.brewerType,
        grindSize: b.grindSize ?? existing.grindSize, coffeeGrams: b.coffeeGrams ?? existing.coffeeGrams,
        waterGrams: b.waterGrams ?? existing.waterGrams, waterTempC: b.waterTempC ?? existing.waterTempC,
        bloomTimeSec: b.bloomTimeSec ?? existing.bloomTimeSec,
        targetBrewTimeSec: b.targetBrewTimeSec ?? existing.targetBrewTimeSec,
        steps: b.steps ? JSON.stringify(b.steps) : existing.steps,
        sourceRecipe: b.sourceRecipe ?? existing.sourceRecipe, notes: b.notes ?? existing.notes, now }
    );
    const updated = await dbGet(db, "SELECT * FROM recipes WHERE id = @id", { id });
    res.json({ ...updated, steps: updated.steps ? JSON.parse(updated.steps) : [] });
  } catch (err) { next(err); }
});

// DELETE /api/recipes/:id
router.delete("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await dbGet(db, "SELECT id, isBuiltIn FROM recipes WHERE id = @id", { id });
    if (!existing) return res.status(404).json({ error: "Recipe not found" });
    if (existing.isBuiltIn) return res.status(403).json({ error: "Built-in recipes cannot be deleted" });
    await dbRun(db, "DELETE FROM recipes WHERE id = @id", { id });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
