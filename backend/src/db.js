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
      fermentation TEXT,
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

    CREATE TABLE IF NOT EXISTS roasters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      websiteUrl TEXT,
      establishedYear INTEGER,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roaster_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roasterId INTEGER NOT NULL UNIQUE,
      overallRating REAL DEFAULT 0,
      consistencyRating REAL DEFAULT 0,
      experimentationRating REAL DEFAULT 0,
      totalReviews INTEGER DEFAULT 0,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (roasterId) REFERENCES roasters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS roaster_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roasterId INTEGER NOT NULL,
      city TEXT NOT NULL,
      state TEXT,
      country TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      phoneNumber TEXT,
      menuUrl TEXT,
      operatingHours TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (roasterId) REFERENCES roasters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS process_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS process_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoryId INTEGER NOT NULL,
      name TEXT NOT NULL UNIQUE,
      aliases TEXT,
      parentMethodId INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES process_categories(id) ON DELETE CASCADE,
      FOREIGN KEY (parentMethodId) REFERENCES process_methods(id) ON DELETE SET NULL
    );
  `);
}

function createIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_roaster ON products(roaster);
    CREATE INDEX IF NOT EXISTS idx_products_roastType ON products(roastType);
    CREATE INDEX IF NOT EXISTS idx_products_origin ON products(origin);
    CREATE INDEX IF NOT EXISTS idx_products_process ON products(process);
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
    CREATE INDEX IF NOT EXISTS idx_roasters_name ON roasters(name);
    CREATE INDEX IF NOT EXISTS idx_roaster_ratings_roasterId ON roaster_ratings(roasterId);
    CREATE INDEX IF NOT EXISTS idx_roaster_locations_roasterId ON roaster_locations(roasterId);
    CREATE INDEX IF NOT EXISTS idx_roaster_locations_city ON roaster_locations(city);
    CREATE INDEX IF NOT EXISTS idx_roaster_locations_country ON roaster_locations(country);
    CREATE INDEX IF NOT EXISTS idx_process_categories_name ON process_categories(name);
    CREATE INDEX IF NOT EXISTS idx_process_methods_name ON process_methods(name);
    CREATE INDEX IF NOT EXISTS idx_process_methods_categoryId ON process_methods(categoryId);
    CREATE INDEX IF NOT EXISTS idx_process_methods_parentMethodId ON process_methods(parentMethodId);
  `);
}

function runMigrations(db) {
  const { normalizeProcess } = require("./utils/processNormalizer");

  // Add columns introduced after initial schema (safe to run repeatedly)
  const productsCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
  if (!productsCols.includes("fermentation")) {
    db.exec("ALTER TABLE products ADD COLUMN fermentation TEXT");
    // Create index for newly added column
    db.exec("CREATE INDEX IF NOT EXISTS idx_products_fermentation ON products(fermentation)");
  }

  // Normalize existing processes (idempotent - safe to run repeatedly)
  try {
    const unormalizedProcesses = db.prepare(`
      SELECT DISTINCT process FROM products WHERE process IS NOT NULL
    `).all();

    for (const row of unormalizedProcesses) {
      if (row.process) {
        const normalized = normalizeProcess(row.process);
        if (normalized && normalized !== row.process) {
          db.prepare("UPDATE products SET process = ? WHERE process = ?").run(
            normalized,
            row.process
          );
        }
      }
    }
  } catch (err) {
    console.warn("Process normalization migration skipped:", err.message);
  }

  const recipesCols = db.prepare("PRAGMA table_info(recipes)").all().map(c => c.name);
  if (!recipesCols.includes("isPublic")) {
    db.exec("ALTER TABLE recipes ADD COLUMN isPublic INTEGER DEFAULT 0");
  }
  if (!recipesCols.includes("authorName")) {
    db.exec("ALTER TABLE recipes ADD COLUMN authorName TEXT");
  }
  if (!recipesCols.includes("authorSetup")) {
    db.exec("ALTER TABLE recipes ADD COLUMN authorSetup TEXT");
  }
  if (!recipesCols.includes("roastLevel")) {
    db.exec("ALTER TABLE recipes ADD COLUMN roastLevel TEXT");
  }
  if (!recipesCols.includes("coffeeBrand")) {
    db.exec("ALTER TABLE recipes ADD COLUMN coffeeBrand TEXT");
  }
  if (!recipesCols.includes("coffeeName")) {
    db.exec("ALTER TABLE recipes ADD COLUMN coffeeName TEXT");
  }

  // Populate process taxonomy (idempotent - safe to run repeatedly)
  try {
    const { COFFEE_PROCESSING_TAXONOMY } = require("./utils/processNormalizer");
    
    // Check if taxonomy is already populated
    const categoryCount = db.prepare("SELECT COUNT(*) as count FROM process_categories").get().count;
    
    if (categoryCount === 0) {
      const now = new Date().toISOString();
      
      // Create a map of category names to IDs for foreign key references
      const categoryIdMap = {};
      const methodIdMap = {}; // For parent-child relationships
      
      // First pass: Insert categories and root methods
      for (const categoryName in COFFEE_PROCESSING_TAXONOMY) {
        const category = COFFEE_PROCESSING_TAXONOMY[categoryName];
        
        // Insert category
        const catResult = db.prepare(
          "INSERT INTO process_categories (name, description, createdAt) VALUES (?, ?, ?)"
        ).run(categoryName, category.description, now);
        categoryIdMap[categoryName] = catResult.lastInsertRowid;
        
        // Insert methods for this category
        const methods = category.methods;
        for (const methodName in methods) {
          const method = methods[methodName];
          
          // Only insert if parent is null (will handle children in second pass)
          if (!method.parent) {
            const methodResult = db.prepare(
              "INSERT INTO process_methods (categoryId, name, aliases, parentMethodId, createdAt) VALUES (?, ?, ?, ?, ?)"
            ).run(
              categoryIdMap[categoryName],
              methodName,
              JSON.stringify(method.aliases),
              null,
              now
            );
            methodIdMap[methodName] = methodResult.lastInsertRowid;
          }
        }
      }
      
      // Second pass: Insert child methods with parent references
      for (const categoryName in COFFEE_PROCESSING_TAXONOMY) {
        const category = COFFEE_PROCESSING_TAXONOMY[categoryName];
        const methods = category.methods;
        
        for (const methodName in methods) {
          const method = methods[methodName];
          
          // Insert if parent is not null
          if (method.parent) {
            const parentId = methodIdMap[method.parent];
            if (parentId) {
              const methodResult = db.prepare(
                "INSERT INTO process_methods (categoryId, name, aliases, parentMethodId, createdAt) VALUES (?, ?, ?, ?, ?)"
              ).run(
                categoryIdMap[categoryName],
                methodName,
                JSON.stringify(method.aliases),
                parentId,
                now
              );
              methodIdMap[methodName] = methodResult.lastInsertRowid;
            }
          }
        }
      }
      
      console.log("✓ Process taxonomy populated successfully");
    }
  } catch (err) {
    console.warn("Process taxonomy population skipped:", err.message);
  }
}

module.exports = {
  getDb,
  initSchema,
  createIndexes,
  runMigrations
};
