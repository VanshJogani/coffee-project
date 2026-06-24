const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const dotenv = require("dotenv");

const { getDb, initSchema, createIndexes, runMigrations } = require("./db");
const productsRouter = require("./routes/products");
const reviewsRouter = require("./routes/reviews");
const recipesRouter = require("./routes/recipes");
const inventoryRouter = require("./routes/inventory");
const brewLogsRouter = require("./routes/brewLogs");
const brewNotesRouter = require("./routes/brewNotes");
const postsRouter = require("./routes/posts");
const roastersRouter = require("./routes/roasters");
const processesRouter = require("./routes/processes");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Initialize DB and schema at startup (async)
const dbReady = (async () => {
  const db = getDb();
  await db.execute("PRAGMA foreign_keys = ON");
  await initSchema(db);
  await runMigrations(db);
  await createIndexes(db);
})();

const app = express();

app.use(helmet());
app.use(express.json({ limit: "50kb" }));

if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGIN) {
  throw new Error("CORS_ORIGIN must be set in production");
}

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(","),
    credentials: true
  })
);

// Guard: ensure DB schema is ready before any route handles a request
app.use(async (_req, _res, next) => {
  await dbReady;
  next();
});

app.get("/api/health", async (_req, res) => {
  const db = getDb();
  let productCount = 0;
  try {
    const result = await db.execute("SELECT COUNT(*) as count FROM products");
    productCount = result.rows[0].count;
  } catch (e) {
    productCount = "error: " + e.message;
  }
  res.json({
    status: "ok",
    dbMode: process.env.TURSO_DATABASE_URL ? "turso" : "local-file",
    tursoUrlSet: !!process.env.TURSO_DATABASE_URL,
    tursoTokenSet: !!process.env.TURSO_AUTH_TOKEN,
    productCount
  });
});

app.use("/api/products", productsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/brew-logs", brewLogsRouter);
app.use("/api/brew-notes", brewNotesRouter);
app.use("/api/posts", postsRouter);
app.use("/api/roasters", roastersRouter);
app.use("/api/processes", processesRouter);

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = { app, dbReady };
