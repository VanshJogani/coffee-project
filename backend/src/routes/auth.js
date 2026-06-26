const { Router } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getDb } = require("../db");
const requireAuth = require("../middleware/requireAuth");

const router = Router();

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const REFRESH_TOKEN_DAYS = 7;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, displayName: user.displayName },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}

function setTokenCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearTokenCookies(res) {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token", { path: "/api/auth" });
}

// ── POST /api/auth/register ──────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Validation — fail loudly
    const errors = [];
    if (!email || typeof email !== "string" || !email.trim()) {
      errors.push("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.push("Invalid email format");
    }
    if (!password || typeof password !== "string") {
      errors.push("Password is required");
    }
    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
      errors.push("Display name is required");
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = getDb();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    // Check if email already exists
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [trimmedEmail],
    });

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date().toISOString();

    const result = await db.execute({
      sql: "INSERT INTO users (email, passwordHash, displayName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      args: [trimmedEmail, passwordHash, trimmedName, now, now],
    });

    const userId = Number(result.lastInsertRowid);
    const user = { id: userId, email: trimmedEmail, displayName: trimmedName };

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: "INSERT INTO refresh_tokens (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
      args: [userId, refreshToken, expiresAt, now],
    });

    setTokenCookies(res, accessToken, refreshToken);
    res.status(201).json({ user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    const errors = [];
    if (!email || typeof email !== "string" || !email.trim()) {
      errors.push("Email is required");
    }
    if (!password || typeof password !== "string") {
      errors.push("Password is required");
    }
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = getDb();
    const trimmedEmail = email.trim().toLowerCase();

    const result = await db.execute({
      sql: "SELECT id, email, passwordHash, displayName FROM users WHERE email = ?",
      args: [trimmedEmail],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const row = result.rows[0];
    const valid = await bcrypt.compare(password, row.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = { id: row.id, email: row.email, displayName: row.displayName };

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: "INSERT INTO refresh_tokens (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
      args: [user.id, refreshToken, expiresAt, now],
    });

    setTokenCookies(res, accessToken, refreshToken);
    res.json({ user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────

router.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const db = getDb();
      await db.execute({
        sql: "DELETE FROM refresh_tokens WHERE token = ?",
        args: [refreshToken],
      });
    }
    clearTokenCookies(res);
    res.status(204).end();
  } catch (err) {
    console.error("Logout error:", err);
    clearTokenCookies(res);
    res.status(204).end();
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get("/me", (req, res) => {
  // Never returns 401 — returns null user for anonymous visitors
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `SELECT rt.id, rt.userId, rt.expiresAt, u.email, u.displayName
            FROM refresh_tokens rt
            JOIN users u ON u.id = rt.userId
            WHERE rt.token = ?`,
      args: [refreshToken],
    });

    if (result.rows.length === 0) {
      clearTokenCookies(res);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const row = result.rows[0];

    // Check expiry
    if (new Date(row.expiresAt) < new Date()) {
      await db.execute({ sql: "DELETE FROM refresh_tokens WHERE id = ?", args: [row.id] });
      clearTokenCookies(res);
      return res.status(401).json({ error: "Refresh token expired" });
    }

    const user = { id: row.userId, email: row.email, displayName: row.displayName };
    const newAccessToken = generateAccessToken(user);

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({ sql: "DELETE FROM refresh_tokens WHERE id = ?", args: [row.id] });
    await db.execute({
      sql: "INSERT INTO refresh_tokens (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)",
      args: [user.id, newRefreshToken, expiresAt, now],
    });

    setTokenCookies(res, newAccessToken, newRefreshToken);
    res.json({ user });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// ── POST /api/auth/claim/preview ─────────────────────────────────────────────

router.post("/claim/preview", requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
      return res.status(400).json({ error: "Display name is required" });
    }

    const db = getDb();
    const name = displayName.trim();

    const [recipes, brewNotes, posts, reviews] = await Promise.all([
      db.execute({ sql: "SELECT COUNT(*) as count FROM recipes WHERE authorName = ? AND userId IS NULL", args: [name] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM brew_notes WHERE authorName = ? AND userId IS NULL", args: [name] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM community_posts WHERE authorName = ? AND userId IS NULL", args: [name] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM reviews WHERE reviewerName = ? AND userId IS NULL", args: [name] }),
    ]);

    res.json({
      claimable: {
        recipes: recipes.rows[0].count,
        brewNotes: brewNotes.rows[0].count,
        posts: posts.rows[0].count,
        reviews: reviews.rows[0].count,
      },
    });
  } catch (err) {
    console.error("Claim preview error:", err);
    res.status(500).json({ error: "Failed to preview claimable records" });
  }
});

// ── POST /api/auth/claim ─────────────────────────────────────────────────────

router.post("/claim", requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
      return res.status(400).json({ error: "Display name is required" });
    }

    const db = getDb();
    const name = displayName.trim();
    const userId = req.user.id;

    const [recipes, brewNotes, posts, reviews] = await Promise.all([
      db.execute({ sql: "UPDATE recipes SET userId = ? WHERE authorName = ? AND userId IS NULL", args: [userId, name] }),
      db.execute({ sql: "UPDATE brew_notes SET userId = ? WHERE authorName = ? AND userId IS NULL", args: [userId, name] }),
      db.execute({ sql: "UPDATE community_posts SET userId = ? WHERE authorName = ? AND userId IS NULL", args: [userId, name] }),
      db.execute({ sql: "UPDATE reviews SET userId = ? WHERE reviewerName = ? AND userId IS NULL", args: [userId, name] }),
    ]);

    res.json({
      claimed: {
        recipes: recipes.rowsAffected,
        brewNotes: brewNotes.rowsAffected,
        posts: posts.rowsAffected,
        reviews: reviews.rowsAffected,
      },
    });
  } catch (err) {
    console.error("Claim error:", err);
    res.status(500).json({ error: "Failed to claim records" });
  }
});

module.exports = router;
