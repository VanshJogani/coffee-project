const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { app, dbReady } = require("./app");
const { closeDb } = require("./db");

const port = process.env.BACKEND_PORT || process.env.PORT || 4000;

let server;

dbReady.then(() => {
  server = app.listen(port, () => {
    console.log(`Backend API listening on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

// Graceful shutdown — drain connections, then close DB
function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  if (server) {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    // Force exit after 10s if connections don't drain
    setTimeout(() => {
      console.warn("Forcing shutdown after timeout");
      closeDb();
      process.exit(1);
    }, 10000);
  } else {
    closeDb();
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
