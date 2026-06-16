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
      steps: recipe_steps ? JSON.parse(recipe_steps) : [],
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
    const { rows } = await db.execute(QUERY);
    res.json(rows.map(parsePost));
  } catch (err) { next(err); }
});

// POST /api/posts
router.post("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { title, body, authorName, recipeId } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "title is required" });

    // If recipeId provided, mark that recipe as public
    if (recipeId) {
      const { rows: recipeRows } = await db.execute({ sql: "SELECT id FROM recipes WHERE id = ?", args: [Number(recipeId)] });
      if (!recipeRows[0]) return res.status(400).json({ error: "Recipe not found" });
      await db.execute({
        sql: "UPDATE recipes SET isPublic = 1, authorName = ? WHERE id = ?",
        args: [authorName || null, Number(recipeId)]
      });
    }

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: "INSERT INTO community_posts (title, body, authorName, recipeId, likes, createdAt) VALUES (?, ?, ?, ?, 0, ?)",
      args: [title.trim(), body?.trim() || null, authorName?.trim() || null,
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
