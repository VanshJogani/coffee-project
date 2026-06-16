const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { productId } = req.query;
    if (!productId) return res.status(400).json({ error: "productId is required" });
    const { rows } = await db.execute({
      sql: `SELECT bn.*, bl.brewerName, bl.coffeeGrams, bl.waterGrams, bl.brewTimeSec, bl.rating as brewRating
      FROM brew_notes bn
      LEFT JOIN brew_logs bl ON bl.id = bn.brewLogId
      WHERE bn.productId = ?
      ORDER BY bn.createdAt DESC`,
      args: [parseInt(productId, 10)]
    });
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { productId, authorName, body, brewLogId } = req.body;
    if (!productId || !authorName || !body) {
      return res.status(400).json({ error: "productId, authorName, and body are required" });
    }
    if (body.trim().length < 3) return res.status(400).json({ error: "Note too short" });

    const { rows: productRows } = await db.execute({ sql: "SELECT id FROM products WHERE id = ?", args: [productId] });
    if (!productRows[0]) return res.status(404).json({ error: "Product not found" });

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: "INSERT INTO brew_notes (productId, authorName, body, brewLogId, createdAt) VALUES (?, ?, ?, ?, ?)",
      args: [productId, authorName.trim().slice(0, 80), body.trim().slice(0, 2000), brewLogId || null, now]
    });

    const { rows: created } = await db.execute({ sql: "SELECT * FROM brew_notes WHERE id = ?", args: [Number(result.lastInsertRowid)] });
    res.status(201).json(created[0]);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.execute({ sql: "DELETE FROM brew_notes WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: "Note not found" });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
