const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

/**
 * GET /roasters
 * List all roasters with their ratings
 * Query params: sort (name, rating, established), page, limit
 */
router.get("/", (req, res, next) => {
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
      orderBy = "rr.overallRating DESC NULLS LAST";
    } else if (sort === "established") {
      orderBy = "r.establishedYear DESC NULLS LAST";
    }

    const searchFilter = search ? `AND (r.name LIKE ? OR r.description LIKE ?)` : "";
    const searchParams = search ? [`%${search}%`, `%${search}%`] : [];

    const roasters = db.prepare(`
      SELECT 
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
      LIMIT ? OFFSET ?
    `).all(...searchParams, pageSize, offset);

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM roasters r
      WHERE 1=1 ${searchFilter}
    `).get(...searchParams);

    res.json({
      roasters,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: countResult.total,
        pages: Math.ceil(countResult.total / pageSize)
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /roasters/:id
 * Get single roaster with full details, ratings, and locations
 */
router.get("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const roaster = db.prepare(`
      SELECT 
        r.id,
        r.name,
        r.websiteUrl,
        r.establishedYear,
        r.description,
        r.createdAt,
        r.updatedAt
      FROM roasters r
      WHERE r.id = ?
    `).get(id);

    if (!roaster) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const ratings = db.prepare(`
      SELECT 
        id,
        overallRating,
        consistencyRating,
        experimentationRating,
        totalReviews,
        updatedAt
      FROM roaster_ratings
      WHERE roasterId = ?
    `).get(id);

    const locations = db.prepare(`
      SELECT 
        id,
        city,
        state,
        country,
        address,
        latitude,
        longitude,
        phoneNumber,
        menuUrl,
        operatingHours,
        createdAt,
        updatedAt
      FROM roaster_locations
      WHERE roasterId = ?
      ORDER BY city ASC
    `).all(id);

    res.json({
      ...roaster,
      ratings: ratings || null,
      locations
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /roasters/:id/ratings
 * Get roaster quality ratings
 */
router.get("/:id/ratings", (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const roaster = db.prepare("SELECT id FROM roasters WHERE id = ?").get(id);
    if (!roaster) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const ratings = db.prepare(`
      SELECT 
        id,
        roasterId,
        overallRating,
        consistencyRating,
        experimentationRating,
        totalReviews,
        updatedAt
      FROM roaster_ratings
      WHERE roasterId = ?
    `).get(id);

    res.json(ratings || {
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
 * Get all physical locations for a roaster
 */
router.get("/:id/locations", (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const roaster = db.prepare("SELECT id FROM roasters WHERE id = ?").get(id);
    if (!roaster) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const locations = db.prepare(`
      SELECT 
        id,
        roasterId,
        city,
        state,
        country,
        address,
        latitude,
        longitude,
        phoneNumber,
        menuUrl,
        operatingHours,
        createdAt,
        updatedAt
      FROM roaster_locations
      WHERE roasterId = ?
      ORDER BY country, state, city
    `).all(id);

    res.json({ locations });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roasters
 * Create a new roaster
 */
router.post("/", (req, res, next) => {
  try {
    const db = getDb();
    const { name, websiteUrl, establishedYear, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO roasters (name, websiteUrl, establishedYear, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      websiteUrl || null,
      establishedYear || null,
      description || null,
      now,
      now
    );

    // Initialize ratings for new roaster
    db.prepare(`
      INSERT INTO roaster_ratings (roasterId, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt)
      VALUES (?, 0, 0, 0, 0, ?)
    `).run(result.lastInsertRowid, now);

    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      websiteUrl: websiteUrl || null,
      establishedYear: establishedYear || null,
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
 * Update roaster information
 */
router.put("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, websiteUrl, establishedYear, description } = req.body;

    const roaster = db.prepare("SELECT id FROM roasters WHERE id = ?").get(id);
    if (!roaster) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE roasters 
      SET name = ?, websiteUrl = ?, establishedYear = ?, description = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : null,
      websiteUrl !== undefined ? websiteUrl : null,
      establishedYear !== undefined ? establishedYear : null,
      description !== undefined ? description : null,
      now,
      id
    );

    const updated = db.prepare("SELECT * FROM roasters WHERE id = ?").get(id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roasters/:id/ratings
 * Create or update roaster ratings
 */
router.post("/:id/ratings", (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { overallRating, consistencyRating, experimentationRating, totalReviews } = req.body;

    const roaster = db.prepare("SELECT id FROM roasters WHERE id = ?").get(id);
    if (!roaster) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const now = new Date().toISOString();
    const existing = db.prepare("SELECT id FROM roaster_ratings WHERE roasterId = ?").get(id);

    if (existing) {
      db.prepare(`
        UPDATE roaster_ratings
        SET overallRating = ?, consistencyRating = ?, experimentationRating = ?, totalReviews = ?, updatedAt = ?
        WHERE roasterId = ?
      `).run(
        overallRating || 0,
        consistencyRating || 0,
        experimentationRating || 0,
        totalReviews || 0,
        now,
        id
      );
    } else {
      db.prepare(`
        INSERT INTO roaster_ratings (roasterId, overallRating, consistencyRating, experimentationRating, totalReviews, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, overallRating || 0, consistencyRating || 0, experimentationRating || 0, totalReviews || 0, now);
    }

    const ratings = db.prepare("SELECT * FROM roaster_ratings WHERE roasterId = ?").get(id);
    res.status(existing ? 200 : 201).json(ratings);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roasters/:id/locations
 * Add a physical location for a roaster
 */
router.post("/:id/locations", (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours } = req.body;

    if (!city || !country) {
      return res.status(400).json({ error: "City and country are required" });
    }

    const roaster = db.prepare("SELECT id FROM roasters WHERE id = ?").get(id);
    if (!roaster) {
      return res.status(404).json({ error: "Roaster not found" });
    }

    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO roaster_locations (roasterId, city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      city,
      state || null,
      country,
      address || null,
      latitude || null,
      longitude || null,
      phoneNumber || null,
      menuUrl || null,
      operatingHours || null,
      now,
      now
    );

    res.status(201).json({
      id: result.lastInsertRowid,
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
 * Update a roaster location
 */
router.put("/:id/locations/:locationId", (req, res, next) => {
  try {
    const db = getDb();
    const { id, locationId } = req.params;
    const { city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours } = req.body;

    const location = db.prepare("SELECT * FROM roaster_locations WHERE id = ? AND roasterId = ?").get(locationId, id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE roaster_locations
      SET city = ?, state = ?, country = ?, address = ?, latitude = ?, longitude = ?, phoneNumber = ?, menuUrl = ?, operatingHours = ?, updatedAt = ?
      WHERE id = ?
    `).run(
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
    );

    const updated = db.prepare("SELECT * FROM roaster_locations WHERE id = ?").get(locationId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /roasters/:id/locations/:locationId
 * Delete a roaster location
 */
router.delete("/:id/locations/:locationId", (req, res, next) => {
  try {
    const db = getDb();
    const { id, locationId } = req.params;

    const location = db.prepare("SELECT id FROM roaster_locations WHERE id = ? AND roasterId = ?").get(locationId, id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    db.prepare("DELETE FROM roaster_locations WHERE id = ?").run(locationId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
