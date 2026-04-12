const express = require("express");
const { getDb } = require("../db");
const { validateReviewPayload } = require("../validation");

const router = express.Router();

function dbGet(db, sql, params = {}) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(db, sql, params = {}) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

router.post("/", async (req, res, next) => {
  const db = getDb();
  const { errors, value } = validateReviewPayload(req.body);
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  try {
    const product = await dbGet(db, "SELECT id FROM products WHERE id = @id", {
      id: value.productId
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const now = new Date().toISOString();
    const info = await dbRun(
      db,
      `INSERT INTO reviews (productId, reviewerName, rating, comment, createdAt, updatedAt)
       VALUES (@productId, @reviewerName, @rating, @comment, @createdAt, @updatedAt)`,
      {
        productId: value.productId,
        reviewerName: value.name,
        rating: value.rating,
        comment: value.comment,
        createdAt: now,
        updatedAt: now
      }
    );

    const created = await dbGet(
      db,
      `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
       FROM reviews WHERE id = @id`,
      { id: info.lastID }
    );

    return res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  const db = getDb();
  const reviewId = parseInt(req.params.id, 10);
  if (!Number.isInteger(reviewId)) {
    return res.status(400).json({ error: "Invalid review id" });
  }

  try {
    const existing = await dbGet(
      db,
      `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
       FROM reviews WHERE id = @id`,
      { id: reviewId }
    );
    if (!existing) {
      return res.status(404).json({ error: "Review not found" });
    }

    const { errors, value } = validateReviewPayload({
      productId: existing.productId,
      name: req.body.name ?? existing.reviewerName,
      rating: req.body.rating ?? existing.rating,
      comment: req.body.comment ?? existing.comment
    });
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const now = new Date().toISOString();
    await dbRun(
      db,
      `UPDATE reviews
       SET reviewerName = @reviewerName,
           rating = @rating,
           comment = @comment,
           updatedAt = @updatedAt
       WHERE id = @id`,
      {
        id: reviewId,
        reviewerName: value.name,
        rating: value.rating,
        comment: value.comment,
        updatedAt: now
      }
    );

    const updated = await dbGet(
      db,
      `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
       FROM reviews WHERE id = @id`,
      { id: reviewId }
    );

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  const db = getDb();
  const reviewId = parseInt(req.params.id, 10);
  if (!Number.isInteger(reviewId)) {
    return res.status(400).json({ error: "Invalid review id" });
  }

  try {
    const info = await dbRun(db, "DELETE FROM reviews WHERE id = @id", { id: reviewId });
    if (info.changes === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
