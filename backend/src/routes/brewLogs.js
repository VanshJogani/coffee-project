const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", (req, res, next) => {
  try {
    const db = getDb();
    const { productId, isPublic, limit = 200 } = req.query;

    const whereClauses = [];
    const params = [];

    if (productId) {
      whereClauses.push("bi.productId = ?");
      params.push(parseInt(productId, 10));
    }
    if (isPublic !== undefined) {
      whereClauses.push("bl.isPublic = ?");
      params.push(isPublic === "1" || isPublic === "true" ? 1 : 0);
    }

    const whereSql = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";
    const safeLimit = Math.min(parseInt(limit, 10) || 200, 500);

    const rows = db.prepare(`
      SELECT bl.*,
        CASE WHEN bi.productId IS NOT NULL THEN p.name ELSE bi.customName END as beanName,
        CASE WHEN bi.productId IS NOT NULL THEN p.roaster ELSE bi.customRoaster END as beanRoaster,
        bi.productId as catalogProductId,
        r.name as recipeName
      FROM brew_logs bl
      LEFT JOIN bean_inventory bi ON bi.id = bl.beanInventoryId
      LEFT JOIN products p ON p.id = bi.productId
      LEFT JOIN recipes r ON r.id = bl.recipeId
      ${whereSql}
      ORDER BY bl.createdAt DESC
      LIMIT ?
    `).all(...params, safeLimit);

    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const row = db.prepare("SELECT * FROM brew_logs WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Brew log not found" });
    res.json(row);
  } catch (err) { next(err); }
});

router.post("/", (req, res, next) => {
  try {
    const db = getDb();
    const { recipeId, beanInventoryId, brewerName, grinderName, grindSize,
            coffeeGrams, waterGrams, waterTempC, brewTimeSec, rating, notes, isPublic } = req.body;
    const now = new Date().toISOString();

    const info = db.prepare(
      `INSERT INTO brew_logs (recipeId, beanInventoryId, brewerName, grinderName, grindSize,
        coffeeGrams, waterGrams, waterTempC, brewTimeSec, rating, notes, isPublic, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(recipeId || null, beanInventoryId || null, brewerName || null, grinderName || null,
          grindSize || null, coffeeGrams || null, waterGrams || null, waterTempC || null,
          brewTimeSec || null, rating || null, notes || null, isPublic !== false ? 1 : 0, now);

    if (beanInventoryId && coffeeGrams) {
      db.prepare(
        "UPDATE bean_inventory SET gramsRemaining = MAX(0, gramsRemaining - ?), updatedAt = ? WHERE id = ?"
      ).run(coffeeGrams, now, beanInventoryId);
    }

    const created = db.prepare("SELECT * FROM brew_logs WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) { next(err); }
});

router.put("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = db.prepare("SELECT * FROM brew_logs WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Brew log not found" });
    const b = req.body;
    db.prepare(
      `UPDATE brew_logs SET brewerName=?, grinderName=?, grindSize=?, coffeeGrams=?,
        waterGrams=?, waterTempC=?, brewTimeSec=?, rating=?, notes=?, isPublic=? WHERE id=?`
    ).run(b.brewerName ?? existing.brewerName, b.grinderName ?? existing.grinderName,
          b.grindSize ?? existing.grindSize, b.coffeeGrams ?? existing.coffeeGrams,
          b.waterGrams ?? existing.waterGrams, b.waterTempC ?? existing.waterTempC,
          b.brewTimeSec ?? existing.brewTimeSec, b.rating ?? existing.rating,
          b.notes ?? existing.notes,
          b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : existing.isPublic, id);
    const updated = db.prepare("SELECT * FROM brew_logs WHERE id = ?").get(id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const info = db.prepare("DELETE FROM brew_logs WHERE id = ?").run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Brew log not found" });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
