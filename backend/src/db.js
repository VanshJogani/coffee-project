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
      process TEXT,
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      displayName TEXT DEFAULT 'Brewer',
      defaultGrinder TEXT,
      defaultBrewer TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brewerType TEXT NOT NULL,
      grindSize TEXT,
      coffeeGrams REAL,
      waterGrams REAL,
      waterTempC INTEGER,
      bloomTimeSec INTEGER,
      targetBrewTimeSec INTEGER,
      steps TEXT,
      isBuiltIn INTEGER DEFAULT 0,
      sourceRecipe TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bean_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER,
      customName TEXT,
      customRoaster TEXT,
      gramsRemaining REAL DEFAULT 0,
      purchaseDate TEXT,
      openedDate TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS brew_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipeId INTEGER,
      beanInventoryId INTEGER,
      brewerName TEXT,
      grinderName TEXT,
      grindSize TEXT,
      coffeeGrams REAL,
      waterGrams REAL,
      waterTempC INTEGER,
      brewTimeSec INTEGER,
      rating INTEGER,
      notes TEXT,
      isPublic INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE SET NULL,
      FOREIGN KEY (beanInventoryId) REFERENCES bean_inventory(id) ON DELETE SET NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS brew_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      authorName TEXT NOT NULL,
      body TEXT NOT NULL,
      brewLogId INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (brewLogId) REFERENCES brew_logs(id) ON DELETE SET NULL
    );
  `);
}

module.exports = {
  getDb,
  initSchema
};

