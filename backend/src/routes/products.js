const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.get("/filter-options", (req, res, next) => {
  try {
    const db = getDb();
    const { category } = req.query;

    let catFilter = "";
    const params = [];
    if (category) {
      catFilter = "WHERE p.category = ?";
      params.push(category);
    }

    const roasters = db.prepare(`SELECT DISTINCT p.roaster FROM products p ${catFilter} WHERE p.roaster IS NOT NULL AND p.roaster != '' ORDER BY p.roaster`
      .replace("WHERE p.roaster", catFilter ? "AND p.roaster" : "WHERE p.roaster")).all(...params).map(r => r.roaster);

    const roastTypes = db.prepare(`SELECT DISTINCT p.roastType FROM products p ${catFilter} WHERE p.roastType IS NOT NULL AND p.roastType != '' ORDER BY p.roastType`
      .replace("WHERE p.roastType", catFilter ? "AND p.roastType" : "WHERE p.roastType")).all(...params).map(r => r.roastType);

    const origins = db.prepare(`SELECT DISTINCT p.origin FROM products p ${catFilter} WHERE p.origin IS NOT NULL AND p.origin != '' ORDER BY p.origin`
      .replace("WHERE p.origin", catFilter ? "AND p.origin" : "WHERE p.origin")).all(...params).map(r => r.origin);

    const processes = db.prepare(`SELECT DISTINCT p.process FROM products p ${catFilter} WHERE p.process IS NOT NULL AND p.process != '' ORDER BY p.process`
      .replace("WHERE p.process", catFilter ? "AND p.process" : "WHERE p.process")).all(...params).map(r => r.process);

    const priceRow = db.prepare(`SELECT MIN(p.price) as minPrice, MAX(p.price) as maxPrice FROM products p ${catFilter} WHERE p.price IS NOT NULL AND p.price > 0`
      .replace("WHERE p.price", catFilter ? "AND p.price" : "WHERE p.price")).get(...params);

    res.json({
      roasters,
      roastTypes,
      origins,
      processes,
      priceMin: priceRow ? Math.floor(priceRow.minPrice || 0) : 0,
      priceMax: priceRow ? Math.ceil(priceRow.maxPrice || 10000) : 10000
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", (req, res, next) => {
  try {
    const db = getDb();
    const {
      roaster,
      roastType,
      origin,
      process: processFilter,
      category,
      search,
      flavour,
      priceMin,
      priceMax,
      sort = "newest",
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * pageSize;

    const whereClauses = [];
    const params = [];

    if (category) {
      whereClauses.push("p.category = ?");
      params.push(category);
    }

    if (roaster) {
      const list = roaster.split(",").map(r => r.trim()).filter(Boolean);
      if (list.length) {
        whereClauses.push(`p.roaster IN (${list.map(() => "?").join(",")})`);
        params.push(...list);
      }
    }

    if (roastType) {
      const list = roastType.split(",").map(r => r.trim()).filter(Boolean);
      if (list.length) {
        whereClauses.push(`p.roastType IN (${list.map(() => "?").join(",")})`);
        params.push(...list);
      }
    }

    if (origin) {
      whereClauses.push("p.origin = ?");
      params.push(origin);
    }

    if (processFilter) {
      const list = processFilter.split(",").map(r => r.trim()).filter(Boolean);
      if (list.length) {
        whereClauses.push(`p.process IN (${list.map(() => "?").join(",")})`);
        params.push(...list);
      }
    }

    if (flavour) {
      const list = flavour.split(",").map(f => f.trim()).filter(Boolean);
      for (const f of list) {
        whereClauses.push("(LOWER(p.tastingNotes) LIKE ? OR LOWER(p.description) LIKE ?)");
        params.push(`%${f.toLowerCase()}%`, `%${f.toLowerCase()}%`);
      }
    }

    if (priceMin != null && priceMin !== "") {
      whereClauses.push("(p.price IS NULL OR p.price >= ?)");
      params.push(Number(priceMin));
    }

    if (priceMax != null && priceMax !== "") {
      whereClauses.push("(p.price IS NULL OR p.price <= ?)");
      params.push(Number(priceMax));
    }

    if (search) {
      const like = `%${search}%`;
      whereClauses.push(
        "(p.name LIKE ? OR p.roaster LIKE ? OR p.tastingNotes LIKE ? OR p.description LIKE ?)"
      );
      params.push(like, like, like, like);
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
      case "discover":
        orderBy = "RANDOM()";
        break;
      case "newest":
      default:
        orderBy = "p.cuppingDate DESC, p.id DESC";
        break;
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM products p ${whereSql}`;
    const total = db.prepare(countSql).get(...params).total;

    const dataSql = `
      SELECT
        p.*,
        IFNULL(AVG(r.rating), 0) as avgRating,
        COUNT(r.id) as reviewCount
      FROM products p
      LEFT JOIN reviews r ON r.productId = p.id
      ${whereSql}
      GROUP BY p.id
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(dataSql).all(...params, pageSize, offset);

    res.json({
      data: rows,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const product = db.prepare(`
      SELECT
        p.*,
        IFNULL(AVG(r.rating), 0) as avgRating,
        COUNT(r.id) as reviewCount
      FROM products p
      LEFT JOIN reviews r ON r.productId = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const reviews = db.prepare(`
      SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
      FROM reviews
      WHERE productId = ?
      ORDER BY createdAt DESC
    `).all(id);

    const variants = db.prepare(`
      SELECT id, quantity, price
      FROM product_variants
      WHERE productId = ?
      ORDER BY price ASC NULLS LAST
    `).all(id);

    return res.json({ ...product, reviews, variants });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
