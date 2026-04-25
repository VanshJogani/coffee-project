const express = require("express");
const { getDb } = require("../db");
const { validateReviewPayload } = require("../validation");

const router = express.Router();

router.post("/", (req, res, next) => {
  try {
    const db = getDb();
    const { errors, value } = validateReviewPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const product = db.prepare("SELECT id FROM products WHERE id = ?").get(value.productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const now = new Date().toISOString();
    const info = db.prepare(
      `INSERT INTO reviews (productId, reviewerName, rating, comment, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(value.productId, value.name, value.rating, value.comment, now, now);

    const created = db.prepare(
      `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
       FROM reviews WHERE id = ?`
    ).get(info.lastInsertRowid);

    return res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const reviewId = parseInt(req.params.id, 10);
    if (!Number.isInteger(reviewId)) {
      return res.status(400).json({ error: "Invalid review id" });
    }

    const existing = db.prepare(
      `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
       FROM reviews WHERE id = ?`
    ).get(reviewId);
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
    db.prepare(
      `UPDATE reviews SET reviewerName = ?, rating = ?, comment = ?, updatedAt = ? WHERE id = ?`
    ).run(value.name, value.rating, value.comment, now, reviewId);

    const updated = db.prepare(
      `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
       FROM reviews WHERE id = ?`
    ).get(reviewId);

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const reviewId = parseInt(req.params.id, 10);
    if (!Number.isInteger(reviewId)) {
      return res.status(400).json({ error: "Invalid review id" });
    }

    const info = db.prepare("DELETE FROM reviews WHERE id = ?").run(reviewId);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
