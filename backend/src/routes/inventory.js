const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

function enrichRow(db, row) {
  if (!row) return null;
  if (row.productId) {
    const product = db.prepare(
      "SELECT name, roaster, imageUrl, tastingNotes, roastType, origin FROM products WHERE id = ?"
    ).get(row.productId);
    if (product) {
      return { ...row, displayName: product.name, displayRoaster: product.roaster,
               imageUrl: product.imageUrl, tastingNotes: product.tastingNotes,
               roastType: product.roastType, origin: product.origin };
    }
  }
  return { ...row, displayName: row.customName || "Unknown Bean", displayRoaster: row.customRoaster || "" };
}

router.get("/", (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM bean_inventory ORDER BY createdAt DESC").all();
    res.json(rows.map(r => enrichRow(db, r)));
  } catch (err) { next(err); }
});

router.get("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const row = db.prepare("SELECT * FROM bean_inventory WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Bean not found" });
    res.json(enrichRow(db, row));
  } catch (err) { next(err); }
});

router.post("/", (req, res, next) => {
  try {
    const db = getDb();
    const { productId, customName, customRoaster, gramsRemaining, purchaseDate, openedDate, notes } = req.body;
    if (!productId && !customName) return res.status(400).json({ error: "productId or customName required" });
    const now = new Date().toISOString();
    const info = db.prepare(
      `INSERT INTO bean_inventory (productId, customName, customRoaster, gramsRemaining, purchaseDate, openedDate, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(productId || null, customName || null, customRoaster || null,
          gramsRemaining ?? 0, purchaseDate || null, openedDate || null, notes || null, now, now);
    const row = db.prepare("SELECT * FROM bean_inventory WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(enrichRow(db, row));
  } catch (err) { next(err); }
});

router.put("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = db.prepare("SELECT * FROM bean_inventory WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Bean not found" });
    const b = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE bean_inventory SET productId=?, customName=?, customRoaster=?,
        gramsRemaining=?, purchaseDate=?, openedDate=?, notes=?, updatedAt=? WHERE id=?`
    ).run(b.productId ?? existing.productId, b.customName ?? existing.customName,
          b.customRoaster ?? existing.customRoaster, b.gramsRemaining ?? existing.gramsRemaining,
          b.purchaseDate ?? existing.purchaseDate, b.openedDate ?? existing.openedDate,
          b.notes ?? existing.notes, now, id);
    const updated = db.prepare("SELECT * FROM bean_inventory WHERE id = ?").get(id);
    res.json(enrichRow(db, updated));
  } catch (err) { next(err); }
});

router.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const info = db.prepare("DELETE FROM bean_inventory WHERE id = ?").run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Bean not found" });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
