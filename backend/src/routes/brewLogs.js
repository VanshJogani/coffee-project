const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { productId, isPublic, limit = 200 } = req.query;

    const whereClauses = [];
    const params = [];

    // If logged in, scope to user's brew logs
    if (req.user) {
      whereClauses.push("bl.userId = ?");
      params.push(req.user.id);
    }

    if (productId) {
      const parsedProductId = parseInt(productId, 10);
      if (isNaN(parsedProductId)) return res.status(400).json({ error: "Invalid productId" });
      whereClauses.push("bi.productId = ?");
      params.push(parsedProductId);
    }
    if (isPublic !== undefined) {
      whereClauses.push("bl.isPublic = ?");
      params.push(isPublic === "1" || isPublic === "true" ? 1 : 0);
    }

    const whereSql = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";
    const safeLimit = Math.min(parseInt(limit, 10) || 200, 500);

    const { rows } = await db.execute({
      sql: `SELECT bl.*,
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
      LIMIT ?`,
      args: [...params, safeLimit]
    });

    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows } = await db.execute({ sql: "SELECT * FROM brew_logs WHERE id = ?", args: [id] });
    if (!rows[0]) return res.status(404).json({ error: "Brew log not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { recipeId, beanInventoryId, brewerName, grinderName, grindSize,
            coffeeGrams, waterGrams, waterTempC, brewTimeSec, rating, notes, isPublic } = req.body;
    const now = new Date().toISOString();
    const userId = req.user ? req.user.id : null;

    const statements = [{
      sql: `INSERT INTO brew_logs (recipeId, beanInventoryId, brewerName, grinderName, grindSize,
        coffeeGrams, waterGrams, waterTempC, brewTimeSec, rating, notes, isPublic, userId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [recipeId ?? null, beanInventoryId ?? null, brewerName || null, grinderName || null,
            grindSize || null, coffeeGrams ?? null, waterGrams ?? null, waterTempC ?? null,
            brewTimeSec ?? null, rating ?? null, notes || null, isPublic !== false ? 1 : 0, userId, now]
    }];

    if (beanInventoryId && coffeeGrams) {
      statements.push({
        sql: "UPDATE bean_inventory SET gramsRemaining = MAX(0, gramsRemaining - ?), updatedAt = ? WHERE id = ?",
        args: [coffeeGrams, now, beanInventoryId]
      });
    }

    const results = await db.batch(statements, "write");
    const insertResult = results[0];

    const { rows: created } = await db.execute({ sql: "SELECT * FROM brew_logs WHERE id = ?", args: [Number(insertResult.lastInsertRowid)] });
    res.status(201).json(created[0]);
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows: existingRows } = await db.execute({ sql: "SELECT * FROM brew_logs WHERE id = ?", args: [id] });
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Brew log not found" });
    if (req.user && existing.userId && existing.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to edit this brew log" });
    }
    const b = req.body;
    await db.execute({
      sql: `UPDATE brew_logs SET recipeId=?, beanInventoryId=?, brewerName=?, grinderName=?, grindSize=?, coffeeGrams=?,
        waterGrams=?, waterTempC=?, brewTimeSec=?, rating=?, notes=?, isPublic=? WHERE id=?`,
      args: [b.recipeId ?? existing.recipeId, b.beanInventoryId ?? existing.beanInventoryId,
            b.brewerName ?? existing.brewerName, b.grinderName ?? existing.grinderName,
            b.grindSize ?? existing.grindSize, b.coffeeGrams ?? existing.coffeeGrams,
            b.waterGrams ?? existing.waterGrams, b.waterTempC ?? existing.waterTempC,
            b.brewTimeSec ?? existing.brewTimeSec, b.rating ?? existing.rating,
            b.notes ?? existing.notes,
            b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : existing.isPublic, id]
    });
    const { rows: updated } = await db.execute({ sql: "SELECT * FROM brew_logs WHERE id = ?", args: [id] });
    res.json(updated[0]);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows: existingRows } = await db.execute({ sql: "SELECT userId FROM brew_logs WHERE id = ?", args: [id] });
    if (!existingRows[0]) return res.status(404).json({ error: "Brew log not found" });
    if (req.user && existingRows[0].userId && existingRows[0].userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this brew log" });
    }
    await db.execute({ sql: "DELETE FROM brew_logs WHERE id = ?", args: [id] });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
