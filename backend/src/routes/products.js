const express = require("express");
const { getDb } = require("../db");
const { normalizeProcess, getStandardProcesses, COFFEE_PROCESSING_TAXONOMY } = require("../utils/processNormalizer");
const { normalizeOrigin, isValidOrigin } = require("../utils/originNormalizer");

const router = express.Router();

router.get("/filter-options", async (req, res, next) => {
  try {
    const db = getDb();
    const { category } = req.query;

    let catFilter = "";
    const params = [];
    if (category) {
      catFilter = "WHERE p.category = ?";
      params.push(category);
    }

    const roasterSql = `SELECT DISTINCT p.roaster FROM products p ${catFilter} ${catFilter ? "AND" : "WHERE"} p.roaster IS NOT NULL AND p.roaster != '' ORDER BY p.roaster`;
    const { rows: roasterRows } = await db.execute({ sql: roasterSql, args: params });
    const roasters = roasterRows.map(r => r.roaster);

    const roastTypeSql = `SELECT DISTINCT p.roastType FROM products p ${catFilter} ${catFilter ? "AND" : "WHERE"} p.roastType IS NOT NULL AND p.roastType != '' ORDER BY p.roastType`;
    const { rows: roastTypeRows } = await db.execute({ sql: roastTypeSql, args: params });
    const roastTypes = roastTypeRows.map(r => r.roastType);

    const originSql = `SELECT DISTINCT p.origin FROM products p ${catFilter} ${catFilter ? "AND" : "WHERE"} p.origin IS NOT NULL AND p.origin != '' ORDER BY p.origin`;
    const { rows: originRows } = await db.execute({ sql: originSql, args: params });
    const originsRaw = originRows.map(r => r.origin);
    // Normalize and filter to only valid geographic origins
    const seenOrigins = new Map();
    for (const o of originsRaw) {
      const normalized = normalizeOrigin(o);
      if (normalized && !seenOrigins.has(normalized.toLowerCase())) {
        seenOrigins.set(normalized.toLowerCase(), normalized);
      }
    }
    const origins = [...seenOrigins.values()].sort((a, b) => a.localeCompare(b));

    const processSql = `SELECT DISTINCT p.process FROM products p ${catFilter} ${catFilter ? "AND" : "WHERE"} p.process IS NOT NULL AND p.process != '' ORDER BY p.process`;
    const { rows: processRows } = await db.execute({ sql: processSql, args: params });
    const processes = processRows.map(r => r.process);

    const priceSql = `SELECT MIN(p.price) as minPrice, MAX(p.price) as maxPrice FROM products p ${catFilter} ${catFilter ? "AND" : "WHERE"} p.price IS NOT NULL AND p.price > 0`;
    const { rows: priceRows } = await db.execute({ sql: priceSql, args: params });
    const priceRow = priceRows[0];

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

/**
 * GET /api/products/grouped-processes
 */
router.get("/grouped-processes", async (req, res, next) => {
  try {
    const db = getDb();
    const { category } = req.query;

    let catFilter = "";
    const params = [];
    if (category) {
      catFilter = "AND p.category = ?";
      params.push(category);
    }

    const { rows: processRows } = await db.execute({
      sql: `SELECT DISTINCT p.process FROM products p
      WHERE p.process IS NOT NULL AND p.process != '' ${catFilter}
      ORDER BY p.process`,
      args: params
    });
    const productProcesses = processRows.map(r => r.process);

    // Group by taxonomy
    const grouped = {};

    for (const categoryName in COFFEE_PROCESSING_TAXONOMY) {
      const methods = COFFEE_PROCESSING_TAXONOMY[categoryName].methods;

      const categoryMethods = [];
      for (const methodName in methods) {
        if (productProcesses.includes(methodName)) {
          categoryMethods.push(methodName);
        }
      }

      if (categoryMethods.length > 0) {
        grouped[categoryName] = {
          description: COFFEE_PROCESSING_TAXONOMY[categoryName].description,
          methods: categoryMethods
        };
      }
    }

    res.json({ grouped });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/standard-processes
 */
router.get("/standard-processes", (req, res) => {
  try {
    const standardProcesses = getStandardProcesses();
    res.json({ processes: standardProcesses });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch standard processes" });
  }
});

router.get("/", async (req, res, next) => {
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
      const originList = origin.split(",").map(r => r.trim()).filter(Boolean);
      // Match all raw origin values that normalize to any of the selected canonical origins
      const { rows: allOriginRows } = await db.execute("SELECT DISTINCT origin FROM products WHERE origin IS NOT NULL AND origin != ''");
      const allOrigins = allOriginRows.map(r => r.origin);
      const matchingRaw = allOrigins.filter(o => {
        const n = normalizeOrigin(o);
        return n && originList.some(sel => sel.toLowerCase() === n.toLowerCase());
      });
      if (matchingRaw.length) {
        whereClauses.push(`p.origin IN (${matchingRaw.map(() => "?").join(",")})`);
        params.push(...matchingRaw);
      } else {
        whereClauses.push(`p.origin IN (${originList.map(() => "?").join(",")})`);
        params.push(...originList);
      }
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

    const { rows: countRows } = await db.execute({
      sql: `SELECT COUNT(DISTINCT p.id) as total FROM products p ${whereSql}`,
      args: params
    });
    const total = countRows[0].total;

    const { rows } = await db.execute({
      sql: `SELECT
        p.*,
        IFNULL(AVG(r.rating), 0) as avgRating,
        COUNT(r.id) as reviewCount
      FROM products p
      LEFT JOIN reviews r ON r.productId = p.id
      ${whereSql}
      GROUP BY p.id
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
      args: [...params, pageSize, offset]
    });

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

router.get("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const { rows: productRows } = await db.execute({
      sql: `SELECT
        p.*,
        IFNULL(AVG(r.rating), 0) as avgRating,
        COUNT(r.id) as reviewCount
      FROM products p
      LEFT JOIN reviews r ON r.productId = p.id
      WHERE p.id = ?
      GROUP BY p.id`,
      args: [id]
    });

    if (!productRows[0]) {
      return res.status(404).json({ error: "Product not found" });
    }

    const { rows: reviews } = await db.execute({
      sql: `SELECT id, productId, reviewerName, rating, comment, createdAt, updatedAt
      FROM reviews WHERE productId = ? ORDER BY createdAt DESC`,
      args: [id]
    });

    const { rows: variants } = await db.execute({
      sql: `SELECT id, quantity, price
      FROM product_variants WHERE productId = ? ORDER BY price ASC`,
      args: [id]
    });

    return res.json({ ...productRows[0], reviews, variants });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
