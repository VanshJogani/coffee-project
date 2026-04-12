const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const isTest = process.env.NODE_ENV === "test";
  const dbPath =
    isTest && process.env.TEST_DATABASE_PATH
      ? process.env.TEST_DATABASE_PATH
      : process.env.DATABASE_PATH || path.join(__dirname, "..", "coffee.db");

  if (!isTest) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new sqlite3.Database(dbPath);
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId TEXT UNIQUE,
      name TEXT NOT NULL,
      roaster TEXT,
      roastType TEXT,
      origin TEXT,
      tastingNotes TEXT,
      score REAL,
      price REAL,
      imageUrl TEXT,
      cuppingDate TEXT,
      description TEXT,
      url TEXT,
      quantity TEXT,
      category TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      reviewerName TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    );
  `);
}

module.exports = {
  getDb,
  initSchema
};

