const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

function parsePost(row) {
  const {
    recipe_name, recipe_brewerType, recipe_grindSize, recipe_coffeeGrams,
    recipe_waterGrams, recipe_waterTempC, recipe_targetBrewTimeSec,
    recipe_bloomTimeSec, recipe_steps, recipe_notes, recipe_sourceRecipe,
    ...post
  } = row;

  if (post.recipeId && recipe_name) {
    post.attachedRecipe = {
      id: post.recipeId,
      name: recipe_name,
      brewerType: recipe_brewerType,
      grindSize: recipe_grindSize,
      coffeeGrams: recipe_coffeeGrams,
      waterGrams: recipe_waterGrams,
      waterTempC: recipe_waterTempC,
      targetBrewTimeSec: recipe_targetBrewTimeSec,
      bloomTimeSec: recipe_bloomTimeSec,
      steps: recipe_steps ? (() => { try { return JSON.parse(recipe_steps); } catch { return []; } })() : [],
      notes: recipe_notes,
      sourceRecipe: recipe_sourceRecipe,
      authorName: post.authorName,
      isPublic: 1,
    };
  }
  return post;
}

const QUERY = `
  SELECT p.*,
         r.name           AS recipe_name,
         r.brewerType     AS recipe_brewerType,
         r.grindSize      AS recipe_grindSize,
         r.coffeeGrams    AS recipe_coffeeGrams,
         r.waterGrams     AS recipe_waterGrams,
         r.waterTempC     AS recipe_waterTempC,
         r.targetBrewTimeSec AS recipe_targetBrewTimeSec,
         r.bloomTimeSec   AS recipe_bloomTimeSec,
         r.steps          AS recipe_steps,
         r.notes          AS recipe_notes,
         r.sourceRecipe   AS recipe_sourceRecipe
  FROM community_posts p
  LEFT JOIN recipes r ON r.id = p.recipeId
  ORDER BY p.createdAt DESC
`;

// GET /api/posts
router.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { page = 1, limit = 30 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const offset = (pageNum - 1) * pageSize;

    const { rows: countRows } = await db.execute("SELECT COUNT(*) as total FROM community_posts");
    const total = countRows[0].total;

    const { rows } = await db.execute({
      sql: QUERY + " LIMIT ? OFFSET ?",
      args: [pageSize, offset]
    });
    res.json({
      data: rows.map(parsePost),
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (err) { next(err); }
});

// POST /api/posts
router.post("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { title, body, authorName, recipeId } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "title is required" });

    const safeTitle = title.trim().slice(0, 200);
    const safeBody = body?.trim().slice(0, 10000) || null;
    const safeAuthor = authorName?.trim().slice(0, 100) || null;

    // If recipeId provided, mark that recipe as public
    if (recipeId) {
      const { rows: recipeRows } = await db.execute({ sql: "SELECT id FROM recipes WHERE id = ?", args: [Number(recipeId)] });
      if (!recipeRows[0]) return res.status(400).json({ error: "Recipe not found" });
      await db.execute({
        sql: "UPDATE recipes SET isPublic = 1, authorName = ? WHERE id = ?",
        args: [safeAuthor, Number(recipeId)]
      });
    }

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: "INSERT INTO community_posts (title, body, authorName, recipeId, likes, createdAt) VALUES (?, ?, ?, ?, 0, ?)",
      args: [safeTitle, safeBody, safeAuthor,
            recipeId ? Number(recipeId) : null, now]
    });

    const { rows: created } = await db.execute({
      sql: `SELECT p.*, r.name AS recipe_name, r.brewerType AS recipe_brewerType,
       r.grindSize AS recipe_grindSize, r.coffeeGrams AS recipe_coffeeGrams,
       r.waterGrams AS recipe_waterGrams, r.waterTempC AS recipe_waterTempC,
       r.targetBrewTimeSec AS recipe_targetBrewTimeSec, r.bloomTimeSec AS recipe_bloomTimeSec,
       r.steps AS recipe_steps, r.notes AS recipe_notes, r.sourceRecipe AS recipe_sourceRecipe
       FROM community_posts p LEFT JOIN recipes r ON r.id = p.recipeId WHERE p.id = ?`,
      args: [Number(result.lastInsertRowid)]
    });

    res.status(201).json(parsePost(created[0]));
  } catch (err) { next(err); }
});

// PUT /api/posts/:id/like
router.put("/:id/like", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.execute({ sql: "UPDATE community_posts SET likes = likes + 1 WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: "Post not found" });
    const { rows } = await db.execute({ sql: "SELECT likes FROM community_posts WHERE id = ?", args: [id] });
    res.json({ likes: rows[0].likes });
  } catch (err) { next(err); }
});

// DELETE /api/posts/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.execute({ sql: "DELETE FROM community_posts WHERE id = ?", args: [id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: "Post not found" });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
