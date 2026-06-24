const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

/**
 * GET /roasters
 * List all roasters with their ratings
 */
router.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const {
      sort = "name",
      page = 1,
      limit = 20,
      search = ""
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * pageSize;

    let orderBy = "r.name ASC";
    if (sort === "rating") {
      orderBy = "rr.overallRating DESC";
    } else if (sort === "established") {
      orderBy = "r.establishedYear DESC";
    }

    const searchFilter = search ? `AND (r.name LIKE ? OR r.description LIKE ?)` : "";
    const searchParams = search ? [`%${search}%`, `%${search}%`] : [];

    const { rows: roasters } = await db.execute({
      sql: `SELECT
        r.id,
        r.name,
        r.websiteUrl,
        r.establishedYear,
        r.description,
        rr.overallRating,
        rr.consistencyRating,
        rr.experimentationRating,
        rr.totalReviews,
        COUNT(DISTINCT rl.id) as locationCount,
        r.createdAt,
        r.updatedAt
      FROM roasters r
      LEFT JOIN roaster_ratings rr ON r.id = rr.roasterId
      LEFT JOIN roaster_locations rl ON r.id = rl.roasterId
      WHERE 1=1 ${searchFilter}
      GROUP BY r.id
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
      args: [...searchParams, pageSize, offset]
    });

    const { rows: countRows } = await db.execute({
      sql: `SELECT COUNT(*) as total FROM roasters r WHERE 1=1 ${searchFilter}`,
      args: [...searchParams]
    });

    res.json({
      roasters,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: countRows[0].total,
        pages: Math.ceil(countRows[0].total / pageSize)
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /roasters/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const { rows: roasterRows } = await db.execute({
      sql: `SELECT r.id, r.name, r.websiteUrl, r.establishedYear, r.description, r.createdAt, r.updatedAt
      FROM roasters r WHERE r.id = ?`,
      args: [id]
    });

    if (!roasterRows[0]) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const { rows: ratingsRows } = await db.execute({
      sql: `SELECT id, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt
      FROM roaster_ratings WHERE roasterId = ?`,
      args: [id]
    });

    const { rows: locations } = await db.execute({
      sql: `SELECT id, city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours, createdAt, updatedAt
      FROM roaster_locations WHERE roasterId = ? ORDER BY city ASC`,
      args: [id]
    });

    res.json({
      ...roasterRows[0],
      ratings: ratingsRows[0] || null,
      locations
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /roasters/:id/ratings
 */
router.get("/:id/ratings", async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const { rows: roasterRows } = await db.execute({ sql: "SELECT id FROM roasters WHERE id = ?", args: [id] });
    if (!roasterRows[0]) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const { rows: ratings } = await db.execute({
      sql: `SELECT id, roasterId, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt
      FROM roaster_ratings WHERE roasterId = ?`,
      args: [id]
    });

    res.json(ratings[0] || {
      roasterId: id,
      overallRating: 0,
      consistencyRating: 0,
      experimentationRating: 0,
      totalReviews: 0
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /roasters/:id/locations
 */
router.get("/:id/locations", async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const { rows: roasterRows } = await db.execute({ sql: "SELECT id FROM roasters WHERE id = ?", args: [id] });
    if (!roasterRows[0]) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const { rows: locations } = await db.execute({
      sql: `SELECT id, roasterId, city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours, createdAt, updatedAt
      FROM roaster_locations WHERE roasterId = ? ORDER BY country, state, city`,
      args: [id]
    });

    res.json({ locations });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roasters
 */
router.post("/", async (req, res, next) => {
  try {
    const db = getDb();
    const { name, websiteUrl, establishedYear, description } = req.body;

    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      return res.status(400).json({ error: "Name is required" });
    }

    const now = new Date().toISOString();

    const result = await db.execute({
      sql: `INSERT INTO roasters (name, websiteUrl, establishedYear, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)`,
      args: [trimmedName, websiteUrl || null, establishedYear ?? null, description || null, now, now]
    });

    // Initialize ratings for new roaster
    await db.execute({
      sql: `INSERT INTO roaster_ratings (roasterId, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt)
      VALUES (?, 0, 0, 0, 0, ?)`,
      args: [Number(result.lastInsertRowid), now]
    });

    res.status(201).json({
      id: Number(result.lastInsertRowid),
      name: trimmedName,
      websiteUrl: websiteUrl || null,
      establishedYear: establishedYear ?? null,
      description: description || null,
      createdAt: now,
      updatedAt: now
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /roasters/:id
 */
router.put("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, websiteUrl, establishedYear, description } = req.body;

    const { rows: roasterRows } = await db.execute({ sql: "SELECT * FROM roasters WHERE id = ?", args: [id] });
    if (!roasterRows[0]) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const existing = roasterRows[0];
    const now = new Date().toISOString();

    const updatedName = name !== undefined ? (name || "").trim() : existing.name;
    if (!updatedName) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }

    await db.execute({
      sql: `UPDATE roasters
      SET name = ?, websiteUrl = ?, establishedYear = ?, description = ?, updatedAt = ?
      WHERE id = ?`,
      args: [
        updatedName,
        websiteUrl !== undefined ? websiteUrl : existing.websiteUrl,
        establishedYear !== undefined ? establishedYear : existing.establishedYear,
        description !== undefined ? description : existing.description,
        now,
        id
      ]
    });

    const { rows: updated } = await db.execute({ sql: "SELECT * FROM roasters WHERE id = ?", args: [id] });
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roasters/:id/ratings
 */
router.post("/:id/ratings", async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { overallRating, consistencyRating, experimentationRating, totalReviews } = req.body;

    const { rows: roasterRows } = await db.execute({ sql: "SELECT id FROM roasters WHERE id = ?", args: [id] });
    if (!roasterRows[0]) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const now = new Date().toISOString();
    const { rows: existingRows } = await db.execute({ sql: "SELECT id FROM roaster_ratings WHERE roasterId = ?", args: [id] });

    if (existingRows[0]) {
      await db.execute({
        sql: `UPDATE roaster_ratings
        SET overallRating = ?, consistencyRating = ?, experimentationRating = ?, totalReviews = ?, updatedAt = ?
        WHERE roasterId = ?`,
        args: [overallRating || 0, consistencyRating || 0, experimentationRating || 0, totalReviews || 0, now, id]
      });
    } else {
      await db.execute({
        sql: `INSERT INTO roaster_ratings (roasterId, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, overallRating || 0, consistencyRating || 0, experimentationRating || 0, totalReviews || 0, now]
      });
    }

    const { rows: ratings } = await db.execute({ sql: "SELECT * FROM roaster_ratings WHERE roasterId = ?", args: [id] });
    res.status(existingRows[0] ? 200 : 201).json(ratings[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roasters/:id/locations
 */
router.post("/:id/locations", async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours } = req.body;

    if (!city || !country) {
      return res.status(400).json({ error: "City and country are required" });
    }

    const { rows: roasterRows } = await db.execute({ sql: "SELECT id FROM roasters WHERE id = ?", args: [id] });
    if (!roasterRows[0]) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const now = new Date().toISOString();

    const result = await db.execute({
      sql: `INSERT INTO roaster_locations (roasterId, city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, city, state || null, country, address || null, latitude ?? null, longitude ?? null,
            phoneNumber || null, menuUrl || null, operatingHours || null, now, now]
    });

    res.status(201).json({
      id: Number(result.lastInsertRowid),
      roasterId: id,
      city,
      state: state || null,
      country,
      address: address || null,
      latitude: latitude || null,
      longitude: longitude || null,
      phoneNumber: phoneNumber || null,
      menuUrl: menuUrl || null,
      operatingHours: operatingHours || null,
      createdAt: now,
      updatedAt: now
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /roasters/:id/locations/:locationId
 */
router.put("/:id/locations/:locationId", async (req, res, next) => {
  try {
    const db = getDb();
    const { id, locationId } = req.params;
    const { city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours } = req.body;

    const { rows: locationRows } = await db.execute({
      sql: "SELECT * FROM roaster_locations WHERE id = ? AND roasterId = ?",
      args: [locationId, id]
    });
    const location = locationRows[0];
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    const now = new Date().toISOString();

    await db.execute({
      sql: `UPDATE roaster_locations
      SET city = ?, state = ?, country = ?, address = ?, latitude = ?, longitude = ?, phoneNumber = ?, menuUrl = ?, operatingHours = ?, updatedAt = ?
      WHERE id = ?`,
      args: [
        city !== undefined ? city : location.city,
        state !== undefined ? state : location.state,
        country !== undefined ? country : location.country,
        address !== undefined ? address : location.address,
        latitude !== undefined ? latitude : location.latitude,
        longitude !== undefined ? longitude : location.longitude,
        phoneNumber !== undefined ? phoneNumber : location.phoneNumber,
        menuUrl !== undefined ? menuUrl : location.menuUrl,
        operatingHours !== undefined ? operatingHours : location.operatingHours,
        now,
        locationId
      ]
    });

    const { rows: updated } = await db.execute({ sql: "SELECT * FROM roaster_locations WHERE id = ?", args: [locationId] });
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /roasters/:id/locations/:locationId
 */
router.delete("/:id/locations/:locationId", async (req, res, next) => {
  try {
    const db = getDb();
    const { id, locationId } = req.params;

    const { rows: locationRows } = await db.execute({
      sql: "SELECT id FROM roaster_locations WHERE id = ? AND roasterId = ?",
      args: [locationId, id]
    });
    if (!locationRows[0]) {
      return res.status(404).json({ error: "Location not found" });
    }

    await db.execute({ sql: "DELETE FROM roaster_locations WHERE id = ?", args: [locationId] });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
