const path = require("path");
const Database = require("better-sqlite3");
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

  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
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

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      quantity TEXT,
      price REAL,
      originalProductId TEXT,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    );

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

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      displayName TEXT DEFAULT 'Brewer',
      defaultGrinder TEXT,
      defaultBrewer TEXT,
      createdAt TEXT NOT NULL
    );

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
      isPublic INTEGER DEFAULT 0,
      authorName TEXT,
      authorSetup TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      authorName TEXT,
      recipeId INTEGER,
      likes INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE SET NULL
    );
  `);
}

function createIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_roaster ON products(roaster);
    CREATE INDEX IF NOT EXISTS idx_products_roastType ON products(roastType);
    CREATE INDEX IF NOT EXISTS idx_products_origin ON products(origin);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_cuppingDate ON products(cuppingDate);
    CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_product_variants_productId ON product_variants(productId);
    CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId);
    CREATE INDEX IF NOT EXISTS idx_brew_logs_beanInventoryId ON brew_logs(beanInventoryId);
    CREATE INDEX IF NOT EXISTS idx_brew_logs_recipeId ON brew_logs(recipeId);
    CREATE INDEX IF NOT EXISTS idx_brew_notes_productId ON brew_notes(productId);
    CREATE INDEX IF NOT EXISTS idx_bean_inventory_productId ON bean_inventory(productId);
  `);
}

function runMigrations(db) {
  // Add columns introduced after initial schema (safe to run repeatedly)
  const existingCols = db.prepare("PRAGMA table_info(recipes)").all().map(c => c.name);
  if (!existingCols.includes("isPublic")) {
    db.exec("ALTER TABLE recipes ADD COLUMN isPublic INTEGER DEFAULT 0");
  }
  if (!existingCols.includes("authorName")) {
    db.exec("ALTER TABLE recipes ADD COLUMN authorName TEXT");
  }
  if (!existingCols.includes("authorSetup")) {
    db.exec("ALTER TABLE recipes ADD COLUMN authorSetup TEXT");
  }
}

module.exports = {
  getDb,
  initSchema,
  createIndexes,
  runMigrations
};
