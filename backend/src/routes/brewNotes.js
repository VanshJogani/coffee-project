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

// GET /api/brew-notes?productId=X
router.get("/", async (req, res, next) => {
  const db = getDb();
  const { productId } = req.query;
  if (!productId) return res.status(400).json({ error: "productId is required" });
  try {
    const rows = await dbAll(db,
      `SELECT bn.*, bl.brewerName, bl.coffeeGrams, bl.waterGrams, bl.brewTimeSec, bl.rating as brewRating
       FROM brew_notes bn
       LEFT JOIN brew_logs bl ON bl.id = bn.brewLogId
       WHERE bn.productId = @productId
       ORDER BY bn.createdAt DESC`,
      { productId: parseInt(productId, 10) }
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/brew-notes
router.post("/", async (req, res, next) => {
  const db = getDb();
  const { productId, authorName, body, brewLogId } = req.body;
  if (!productId || !authorName || !body) {
    return res.status(400).json({ error: "productId, authorName, and body are required" });
  }
  if (body.trim().length < 3) return res.status(400).json({ error: "Note too short" });
  const now = new Date().toISOString();
  try {
    const product = await dbGet(db, "SELECT id FROM products WHERE id = @id", { id: productId });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const info = await dbRun(db,
      "INSERT INTO brew_notes (productId, authorName, body, brewLogId, createdAt) VALUES (@productId, @authorName, @body, @brewLogId, @now)",
      { productId, authorName: authorName.trim().slice(0, 80),
        body: body.trim().slice(0, 2000), brewLogId: brewLogId || null, now }
    );
    const created = await dbGet(db, "SELECT * FROM brew_notes WHERE id = @id", { id: info.lastID });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// DELETE /api/brew-notes/:id
router.delete("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const info = await dbRun(db, "DELETE FROM brew_notes WHERE id = @id", { id });
    if (info.changes === 0) return res.status(404).json({ error: "Note not found" });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
