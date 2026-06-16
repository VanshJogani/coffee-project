const express = require("express");
const { getDb } = require("../db");
const {
  getTaxonomy,
  getProcessDetails,
  getStandardProcesses,
  getProcessesByCategory,
  getChildProcesses,
  getProcessHierarchy
} = require("../utils/processNormalizer");

const router = express.Router();

/**
 * GET /api/processes/taxonomy
 */
router.get("/taxonomy", (req, res, next) => {
  try {
    const taxonomy = getTaxonomy();
    res.json({ taxonomy });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/processes/standard
 */
router.get("/standard", (req, res, next) => {
  try {
    const processes = getStandardProcesses();
    res.json({ processes });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/processes/hierarchical
 */
router.get("/hierarchical", async (req, res, next) => {
  try {
    const db = getDb();

    const { rows: processes } = await db.execute(`
      SELECT
        pm.id,
        pm.name,
        pm.categoryId,
        pc.name as categoryName,
        pm.parentMethodId,
        (SELECT name FROM process_methods WHERE id = pm.parentMethodId) as parentName
      FROM process_methods pm
      JOIN process_categories pc ON pm.categoryId = pc.id
      ORDER BY pc.name ASC, CASE WHEN pm.parentMethodId IS NULL THEN 0 ELSE 1 END ASC, pm.parentMethodId ASC, pm.name ASC
    `);

    // Group by category and parent
    const grouped = {};

    processes.forEach(process => {
      if (!grouped[process.categoryName]) {
        grouped[process.categoryName] = {};
      }

      const parentKey = process.parentName || "ROOT";

      if (!grouped[process.categoryName][parentKey]) {
        grouped[process.categoryName][parentKey] = [];
      }

      grouped[process.categoryName][parentKey].push({
        name: process.name,
        parentName: process.parentName,
        categoryName: process.categoryName
      });
    });

    res.json({ hierarchical: grouped });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/processes/categories
 */
router.get("/categories", async (req, res, next) => {
  try {
    const db = getDb();
    const { rows: categories } = await db.execute(`
      SELECT id, name, description, createdAt
      FROM process_categories
      ORDER BY name ASC
    `);

    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/processes/categories/:categoryId/methods
 */
router.get("/categories/:categoryId/methods", async (req, res, next) => {
  try {
    const db = getDb();
    const { categoryId } = req.params;

    const { rows: catRows } = await db.execute({
      sql: "SELECT id, name, description FROM process_categories WHERE id = ?",
      args: [categoryId]
    });

    if (!catRows[0]) {
      return res.status(404).json({ error: "Category not found" });
    }

    const { rows: methods } = await db.execute({
      sql: `SELECT
        id,
        name,
        aliases,
        parentMethodId,
        (SELECT name FROM process_methods WHERE id = pm.parentMethodId) as parentName,
        createdAt
      FROM process_methods pm
      WHERE categoryId = ?
      ORDER BY parentMethodId ASC NULLS FIRST, name ASC`,
      args: [categoryId]
    });

    res.json({
      category: catRows[0],
      methods: methods.map(m => ({
        ...m,
        aliases: m.aliases ? JSON.parse(m.aliases) : []
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/processes/:name/details
 */
router.get("/:name/details", (req, res, next) => {
  try {
    const { name } = req.params;
    const details = getProcessDetails(name);

    if (!details) {
      return res.status(404).json({ error: "Process not found" });
    }

    res.json(details);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/processes/:name/children
 */
router.get("/:name/children", (req, res, next) => {
  try {
    const { name } = req.params;
    const children = getChildProcesses(name);

    res.json({ parent: name, children });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/processes/:name/hierarchy
 */
router.get("/:name/hierarchy", (req, res, next) => {
  try {
    const { name } = req.params;
    const hierarchy = getProcessHierarchy(name);

    if (hierarchy.length === 0) {
      return res.status(404).json({ error: "Process not found" });
    }

    res.json({ process: name, hierarchy });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
