const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");

const { getDb, initSchema } = require("./db");
const productsRouter = require("./routes/products");
const reviewsRouter = require("./routes/reviews");
const recipesRouter = require("./routes/recipes");
const inventoryRouter = require("./routes/inventory");
const brewLogsRouter = require("./routes/brewLogs");
const brewNotesRouter = require("./routes/brewNotes");

dotenv.config();

// Initialize DB and schema at startup
const db = getDb();
initSchema(db);

const app = express();

app.use(helmet());
app.use(express.json());

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? undefined : corsOrigin,
    credentials: true
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/products", productsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/brew-logs", brewLogsRouter);
app.use("/api/brew-notes", brewNotesRouter);

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;

