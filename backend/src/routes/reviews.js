const express = require("express");
const { getDb } = require("../db");
const { validateReviewPayload } = require("../validation");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { errors, value } = validateReviewPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const { rows: productRows } = await db.execute({ sql: "SELECT id FROM products WHERE id = ?", args: [value.productId] });
    if (!productRows[0]) {
      return res.status(404).json({ error: "Product not found" });
    }

    const now = new Date().toISOString();
    const userId = req.user ? req.user.id : null;
    const result = await db.execute({
      sql: `INSERT INTO reviews (productId, reviewerName, rating, comment, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [value.productId, value.name, value.rating, value.comment, userId, now, now]
    });

    const { rows: created } = await db.execute({
      sql: `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
       FROM reviews WHERE id = ?`,
      args: [Number(result.lastInsertRowid)]
    });

    return res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const reviewId = parseInt(req.params.id, 10);
    if (!Number.isInteger(reviewId)) {
      return res.status(400).json({ error: "Invalid review id" });
    }

    const { rows: existingRows } = await db.execute({
      sql: `SELECT id, productId, reviewerName, rating, comment, userId, createdAt, updatedAt
       FROM reviews WHERE id = ?`,
      args: [reviewId]
    });
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: "Review not found" });
    }
    if (req.user && existing.userId && existing.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to edit this review" });
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
    await db.execute({
      sql: `UPDATE reviews SET reviewerName = ?, rating = ?, comment = ?, updatedAt = ? WHERE id = ?`,
      args: [value.name, value.rating, value.comment, now, reviewId]
    });

    const { rows: updated } = await db.execute({
      sql: `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
       FROM reviews WHERE id = ?`,
      args: [reviewId]
    });

    return res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const reviewId = parseInt(req.params.id, 10);
    if (!Number.isInteger(reviewId)) {
      return res.status(400).json({ error: "Invalid review id" });
    }

    const { rows: existingRows } = await db.execute({ sql: "SELECT userId FROM reviews WHERE id = ?", args: [reviewId] });
    if (!existingRows[0]) {
      return res.status(404).json({ error: "Review not found" });
    }
    if (req.user && existingRows[0].userId && existingRows[0].userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this review" });
    }

    await db.execute({ sql: "DELETE FROM reviews WHERE id = ?", args: [reviewId] });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
