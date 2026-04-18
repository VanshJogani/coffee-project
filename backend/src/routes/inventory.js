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

// Enrich inventory row with product data from catalog if linked
async function enrichRow(db, row) {
  if (!row) return null;
  if (row.productId) {
    const product = await dbGet(db,
      "SELECT name, roaster, imageUrl, tastingNotes, roastType, origin FROM products WHERE id = @id",
      { id: row.productId }
    );
    if (product) {
      return { ...row, displayName: product.name, displayRoaster: product.roaster,
               imageUrl: product.imageUrl, tastingNotes: product.tastingNotes,
               roastType: product.roastType, origin: product.origin };
    }
  }
  return { ...row, displayName: row.customName || "Unknown Bean", displayRoaster: row.customRoaster || "" };
}

// GET /api/inventory
router.get("/", async (req, res, next) => {
  const db = getDb();
  try {
    const rows = await dbAll(db, "SELECT * FROM bean_inventory ORDER BY createdAt DESC");
    const enriched = await Promise.all(rows.map(r => enrichRow(db, r)));
    res.json(enriched);
  } catch (err) { next(err); }
});

// GET /api/inventory/:id
router.get("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await dbGet(db, "SELECT * FROM bean_inventory WHERE id = @id", { id });
    if (!row) return res.status(404).json({ error: "Bean not found" });
    res.json(await enrichRow(db, row));
  } catch (err) { next(err); }
});

// POST /api/inventory
router.post("/", async (req, res, next) => {
  const db = getDb();
  const { productId, customName, customRoaster, gramsRemaining, purchaseDate, openedDate, notes } = req.body;
  if (!productId && !customName) return res.status(400).json({ error: "productId or customName required" });
  const now = new Date().toISOString();
  try {
    const info = await dbRun(db,
      `INSERT INTO bean_inventory (productId, customName, customRoaster, gramsRemaining, purchaseDate, openedDate, notes, createdAt, updatedAt)
       VALUES (@productId, @customName, @customRoaster, @gramsRemaining, @purchaseDate, @openedDate, @notes, @now, @now)`,
      { productId: productId || null, customName: customName || null, customRoaster: customRoaster || null,
        gramsRemaining: gramsRemaining ?? 0, purchaseDate: purchaseDate || null,
        openedDate: openedDate || null, notes: notes || null, now }
    );
    const row = await dbGet(db, "SELECT * FROM bean_inventory WHERE id = @id", { id: info.lastID });
    res.status(201).json(await enrichRow(db, row));
  } catch (err) { next(err); }
});

// PUT /api/inventory/:id
router.put("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await dbGet(db, "SELECT * FROM bean_inventory WHERE id = @id", { id });
    if (!existing) return res.status(404).json({ error: "Bean not found" });
    const b = req.body;
    const now = new Date().toISOString();
    await dbRun(db,
      `UPDATE bean_inventory SET productId=@productId, customName=@customName, customRoaster=@customRoaster,
        gramsRemaining=@gramsRemaining, purchaseDate=@purchaseDate, openedDate=@openedDate,
        notes=@notes, updatedAt=@now WHERE id=@id`,
      { id, productId: b.productId ?? existing.productId,
        customName: b.customName ?? existing.customName,
        customRoaster: b.customRoaster ?? existing.customRoaster,
        gramsRemaining: b.gramsRemaining ?? existing.gramsRemaining,
        purchaseDate: b.purchaseDate ?? existing.purchaseDate,
        openedDate: b.openedDate ?? existing.openedDate,
        notes: b.notes ?? existing.notes, now }
    );
    const updated = await dbGet(db, "SELECT * FROM bean_inventory WHERE id = @id", { id });
    res.json(await enrichRow(db, updated));
  } catch (err) { next(err); }
});

// DELETE /api/inventory/:id
router.delete("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const info = await dbRun(db, "DELETE FROM bean_inventory WHERE id = @id", { id });
    if (info.changes === 0) return res.status(404).json({ error: "Bean not found" });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
