const dotenv = require("dotenv");
dotenv.config();

const { app, dbReady } = require("./app");
const { closeDb } = require("./db");

const port = process.env.BACKEND_PORT || process.env.PORT || 4000;

dbReady.then(() => {
  app.listen(port, () => {
    console.log(`Backend API listening on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  closeDb();
  process.exit(0);
});
