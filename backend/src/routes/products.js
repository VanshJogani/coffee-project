const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

function esc(str) {
  return String(str).replace(/'/g, "''");
}

router.get("/", async (req, res, next) => {
  const db = getDb();

  try {
    const {
      roaster,
      roastType,
      origin,
      process,
      category,
      search,
      sort = "newest",
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(5000, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * pageSize;

    const whereClauses = [];

    if (roaster) {
      const list = roaster.split(",").map((r) => r.trim()).filter(Boolean);
      if (list.length) {
        const vals = list.map((v) => `'${esc(v)}'`).join(",");
        whereClauses.push(`p.roaster IN (${vals})`);
      }
    }

    if (roastType) {
      const list = roastType.split(",").map((r) => r.trim()).filter(Boolean);
      if (list.length) {
        const vals = list.map((v) => `'${esc(v)}'`).join(",");
        whereClauses.push(`p.roastType IN (${vals})`);
      }
    }

    if (origin) {
      whereClauses.push(`p.origin = '${esc(origin)}'`);
    }

    if (process) {
      const list = process.split(",").map((r) => r.trim()).filter(Boolean);
      if (list.length) {
        const vals = list.map((v) => `'${esc(v)}'`).join(",");
        whereClauses.push(`p.process IN (${vals})`);
      }
    }

    if (category) {
      const list = category.split(",").map((c) => c.trim()).filter(Boolean);
      if (list.length) {
        const vals = list.map((v) => `'${esc(v)}'`).join(",");
        whereClauses.push(`p.category IN (${vals})`);
      }
    }

    if (search) {
      const like = `%${search}%`;
      const s = esc(like);
      whereClauses.push(
        `(p.name LIKE '${s}' OR p.roaster LIKE '${s}' OR p.tastingNotes LIKE '${s}')`
      );
    }

    let orderBy = "p.id DESC";
    switch (sort) {
      case "rating":
        orderBy = "avgRating DESC";
        break;
      case "roastType":
        orderBy = "p.roastType ASC, p.name ASC";
        break;
      case "priceAsc":
        orderBy = "(p.price IS NULL OR p.price = 0) ASC, p.price ASC";
        break;
      case "priceDesc":
        orderBy = "(p.price IS NULL OR p.price = 0) ASC, p.price DESC";
        break;
      case "newest":
      default:
        orderBy = "p.cuppingDate DESC, p.id DESC";
        break;
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const baseSelect = `
      FROM products p
      LEFT JOIN reviews r ON r.productId = p.id
      ${whereSql}
      GROUP BY p.id
    `;

    const countSql = `SELECT COUNT(*) as total FROM (SELECT p.id ${baseSelect}) as sub`;

    const total = await new Promise((resolve, reject) => {
      db.get(countSql, (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.total : 0);
      });
    });

    const dataSql = `
      SELECT
        p.*,
        IFNULL(AVG(r.rating), 0) as avgRating,
        COUNT(r.id) as reviewCount
      ${baseSelect}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const rows = await new Promise((resolve, reject) => {
      db.all(dataSql, (err, r) => {
        if (err) return reject(err);
        resolve(r);
      });
    });

    res.json({
      data: rows,
      pagination: {
        page: pageNum,
        limit: pageSize, // This should be pageSize, which already respects the cap
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  try {
    const productSql = `
      SELECT
        p.*,
        IFNULL(AVG(r.rating), 0) as avgRating,
        COUNT(r.id) as reviewCount
      FROM products p
      LEFT JOIN reviews r ON r.productId = p.id
      WHERE p.id = ${id}
      GROUP BY p.id
    `;

    const product = await new Promise((resolve, reject) => {
      db.get(productSql, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const reviewsSql = `
      SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
      FROM reviews
      WHERE productId = ${id}
      ORDER BY createdAt DESC
    `;

    const reviews = await new Promise((resolve, reject) => {
      db.all(reviewsSql, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    return res.json({ ...product, reviews });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
