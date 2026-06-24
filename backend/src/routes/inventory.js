const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

// Use a JOIN query instead of N+1 enrichRow calls (network round-trips to Turso)
router.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { rows } = await db.execute(`
      SELECT bi.*,
        COALESCE(p.name, bi.customName, 'Unknown Bean') as displayName,
        COALESCE(p.roaster, bi.customRoaster, '') as displayRoaster,
        p.imageUrl, p.tastingNotes, p.roastType, p.origin
      FROM bean_inventory bi
      LEFT JOIN products p ON p.id = bi.productId
      ORDER BY bi.createdAt DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows } = await db.execute({
      sql: `SELECT bi.*,
        COALESCE(p.name, bi.customName, 'Unknown Bean') as displayName,
        COALESCE(p.roaster, bi.customRoaster, '') as displayRoaster,
        p.imageUrl, p.tastingNotes, p.roastType, p.origin
      FROM bean_inventory bi
      LEFT JOIN products p ON p.id = bi.productId
      WHERE bi.id = ?`,
      args: [id]
    });
    if (!rows[0]) return res.status(404).json({ error: "Bean not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { productId, customName, customRoaster, gramsRemaining, purchaseDate, openedDate, notes } = req.body;
    if (!productId && !customName) return res.status(400).json({ error: "productId or customName required" });
    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `INSERT INTO bean_inventory (productId, customName, customRoaster, gramsRemaining, purchaseDate, openedDate, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [productId || null, customName || null, customRoaster || null,
            gramsRemaining ?? 0, purchaseDate || null, openedDate || null, notes || null, now, now]
    });
    const { rows } = await db.execute({
      sql: `SELECT bi.*,
        COALESCE(p.name, bi.customName, 'Unknown Bean') as displayName,
        COALESCE(p.roaster, bi.customRoaster, '') as displayRoaster,
        p.imageUrl, p.tastingNotes, p.roastType, p.origin
      FROM bean_inventory bi
      LEFT JOIN products p ON p.id = bi.productId
      WHERE bi.id = ?`,
      args: [Number(result.lastInsertRowid)]
    });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows: existingRows } = await db.execute({ sql: "SELECT * FROM bean_inventory WHERE id = ?", args: [id] });
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Bean not found" });
    const b = req.body;
    if (b.gramsRemaining !== undefined && (typeof b.gramsRemaining !== "number" || b.gramsRemaining < 0)) {
      return res.status(400).json({ error: "gramsRemaining must be a non-negative number" });
    }
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE bean_inventory SET productId=?, customName=?, customRoaster=?,
        gramsRemaining=?, purchaseDate=?, openedDate=?, notes=?, updatedAt=? WHERE id=?`,
      args: [b.productId ?? existing.productId, b.customName ?? existing.customName,
            b.customRoaster ?? existing.customRoaster, b.gramsRemaining ?? existing.gramsRemaining,
            b.purchaseDate ?? existing.purchaseDate, b.openedDate ?? existing.openedDate,
            b.notes ?? existing.notes, now, id]
    });
    const { rows: updated } = await db.execute({
      sql: `SELECT bi.*,
        COALESCE(p.name, bi.customName, 'Unknown Bean') as displayName,
        COALESCE(p.roaster, bi.customRoaster, '') as displayRoaster,
        p.imageUrl, p.tastingNotes, p.roastType, p.origin
      FROM bean_inventory bi
      LEFT JOIN products p ON p.id = bi.productId
      WHERE bi.id = ?`,
      args: [id]
    });
    res.json(updated[0]);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.execute({ sql: "DELETE FROM bean_inventory WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: "Bean not found" });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
