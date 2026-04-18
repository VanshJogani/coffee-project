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

// GET /api/brew-logs?productId=X&isPublic=1&limit=50
router.get("/", async (req, res, next) => {
  const db = getDb();
  try {
    const { productId, isPublic, limit = 200 } = req.query;
    let sql = `
      SELECT bl.*,
        CASE WHEN bi.productId IS NOT NULL THEN p.name
             ELSE bi.customName END as beanName,
        CASE WHEN bi.productId IS NOT NULL THEN p.roaster
             ELSE bi.customRoaster END as beanRoaster,
        bi.productId as catalogProductId,
        r.name as recipeName
      FROM brew_logs bl
      LEFT JOIN bean_inventory bi ON bi.id = bl.beanInventoryId
      LEFT JOIN products p ON p.id = bi.productId
      LEFT JOIN recipes r ON r.id = bl.recipeId
    `;
    const wheres = [];
    const params = {};

    if (productId) {
      wheres.push("bi.productId = @productId");
      params.productId = parseInt(productId, 10);
    }
    if (isPublic !== undefined) {
      wheres.push("bl.isPublic = @isPublic");
      params.isPublic = isPublic === "1" || isPublic === "true" ? 1 : 0;
    }
    if (wheres.length) sql += " WHERE " + wheres.join(" AND ");
    sql += " ORDER BY bl.createdAt DESC LIMIT @limit";
    params.limit = Math.min(parseInt(limit, 10) || 200, 500);

    const rows = await dbAll(db, sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/brew-logs/:id
router.get("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await dbGet(db, "SELECT * FROM brew_logs WHERE id = @id", { id });
    if (!row) return res.status(404).json({ error: "Brew log not found" });
    res.json(row);
  } catch (err) { next(err); }
});

// POST /api/brew-logs
router.post("/", async (req, res, next) => {
  const db = getDb();
  const { recipeId, beanInventoryId, brewerName, grinderName, grindSize,
          coffeeGrams, waterGrams, waterTempC, brewTimeSec, rating, notes, isPublic } = req.body;
  const now = new Date().toISOString();
  try {
    const info = await dbRun(db,
      `INSERT INTO brew_logs (recipeId, beanInventoryId, brewerName, grinderName, grindSize,
        coffeeGrams, waterGrams, waterTempC, brewTimeSec, rating, notes, isPublic, createdAt)
       VALUES (@recipeId, @beanInventoryId, @brewerName, @grinderName, @grindSize,
        @coffeeGrams, @waterGrams, @waterTempC, @brewTimeSec, @rating, @notes, @isPublic, @now)`,
      { recipeId: recipeId || null, beanInventoryId: beanInventoryId || null,
        brewerName: brewerName || null, grinderName: grinderName || null,
        grindSize: grindSize || null, coffeeGrams: coffeeGrams || null,
        waterGrams: waterGrams || null, waterTempC: waterTempC || null,
        brewTimeSec: brewTimeSec || null, rating: rating || null,
        notes: notes || null, isPublic: isPublic !== false ? 1 : 0, now }
    );

    // Deduct grams from inventory if a bean was used
    if (beanInventoryId && coffeeGrams) {
      await dbRun(db,
        "UPDATE bean_inventory SET gramsRemaining = MAX(0, gramsRemaining - @used), updatedAt = @now WHERE id = @id",
        { id: beanInventoryId, used: coffeeGrams, now }
      );
    }

    const created = await dbGet(db, "SELECT * FROM brew_logs WHERE id = @id", { id: info.lastID });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// PUT /api/brew-logs/:id
router.put("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await dbGet(db, "SELECT * FROM brew_logs WHERE id = @id", { id });
    if (!existing) return res.status(404).json({ error: "Brew log not found" });
    const b = req.body;
    await dbRun(db,
      `UPDATE brew_logs SET brewerName=@brewerName, grinderName=@grinderName, grindSize=@grindSize,
        coffeeGrams=@coffeeGrams, waterGrams=@waterGrams, waterTempC=@waterTempC,
        brewTimeSec=@brewTimeSec, rating=@rating, notes=@notes, isPublic=@isPublic WHERE id=@id`,
      { id, brewerName: b.brewerName ?? existing.brewerName,
        grinderName: b.grinderName ?? existing.grinderName,
        grindSize: b.grindSize ?? existing.grindSize,
        coffeeGrams: b.coffeeGrams ?? existing.coffeeGrams,
        waterGrams: b.waterGrams ?? existing.waterGrams,
        waterTempC: b.waterTempC ?? existing.waterTempC,
        brewTimeSec: b.brewTimeSec ?? existing.brewTimeSec,
        rating: b.rating ?? existing.rating, notes: b.notes ?? existing.notes,
        isPublic: b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : existing.isPublic }
    );
    const updated = await dbGet(db, "SELECT * FROM brew_logs WHERE id = @id", { id });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/brew-logs/:id
router.delete("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const info = await dbRun(db, "DELETE FROM brew_logs WHERE id = @id", { id });
    if (info.changes === 0) return res.status(404).json({ error: "Brew log not found" });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
