const path = require("path");
const { createClient } = require("@libsql/client");

let clientInstance = null;

function getDb() {
  if (clientInstance) return clientInstance;

  if (process.env.TURSO_DATABASE_URL) {
    // Production: remote Turso
    clientInstance = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else if (process.env.NODE_ENV === "test") {
    // Tests: in-memory
    clientInstance = createClient({ url: "file::memory:" });
  } else {
    // Local development: file-based
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "coffee.db");
    clientInstance = createClient({ url: `file:${dbPath}` });
  }

  return clientInstance;
}

async function initSchema(db) {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS products (
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
    )`,
    `CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      quantity TEXT,
      price REAL,
      originalProductId TEXT,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      reviewerName TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      displayName TEXT DEFAULT 'Brewer',
      defaultGrinder TEXT,
      defaultBrewer TEXT,
      createdAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS recipes (
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
      roastLevel TEXT,
      coffeeBrand TEXT,
      coffeeName TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bean_inventory (
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
    )`,
    `CREATE TABLE IF NOT EXISTS brew_logs (
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
    )`,
    `CREATE TABLE IF NOT EXISTS brew_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      authorName TEXT NOT NULL,
      body TEXT NOT NULL,
      brewLogId INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (brewLogId) REFERENCES brew_logs(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      authorName TEXT,
      recipeId INTEGER,
      likes INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS roasters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      websiteUrl TEXT,
      establishedYear INTEGER,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS roaster_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roasterId INTEGER NOT NULL UNIQUE,
      overallRating REAL DEFAULT 0,
      consistencyRating REAL DEFAULT 0,
      experimentationRating REAL DEFAULT 0,
      totalReviews INTEGER DEFAULT 0,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (roasterId) REFERENCES roasters(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS roaster_locations (
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
    )`,
    `CREATE TABLE IF NOT EXISTS process_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      createdAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS process_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoryId INTEGER NOT NULL,
      name TEXT NOT NULL UNIQUE,
      aliases TEXT,
      parentMethodId INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES process_categories(id) ON DELETE CASCADE,
      FOREIGN KEY (parentMethodId) REFERENCES process_methods(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      passwordHash TEXT NOT NULL,
      displayName TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS recipe_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      recipeId INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(userId, recipeId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE
    )`
  ], "write");
}

async function createIndexes(db) {
  await db.batch([
    `CREATE INDEX IF NOT EXISTS idx_products_roaster ON products(roaster)`,
    `CREATE INDEX IF NOT EXISTS idx_products_roastType ON products(roastType)`,
    `CREATE INDEX IF NOT EXISTS idx_products_origin ON products(origin)`,
    `CREATE INDEX IF NOT EXISTS idx_products_process ON products(process)`,
    `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
    `CREATE INDEX IF NOT EXISTS idx_products_cuppingDate ON products(cuppingDate)`,
    `CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)`,
    `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`,
    `CREATE INDEX IF NOT EXISTS idx_product_variants_productId ON product_variants(productId)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId)`,
    `CREATE INDEX IF NOT EXISTS idx_brew_logs_beanInventoryId ON brew_logs(beanInventoryId)`,
    `CREATE INDEX IF NOT EXISTS idx_brew_logs_recipeId ON brew_logs(recipeId)`,
    `CREATE INDEX IF NOT EXISTS idx_brew_notes_productId ON brew_notes(productId)`,
    `CREATE INDEX IF NOT EXISTS idx_bean_inventory_productId ON bean_inventory(productId)`,
    `CREATE INDEX IF NOT EXISTS idx_roasters_name ON roasters(name)`,
    `CREATE INDEX IF NOT EXISTS idx_roaster_ratings_roasterId ON roaster_ratings(roasterId)`,
    `CREATE INDEX IF NOT EXISTS idx_roaster_locations_roasterId ON roaster_locations(roasterId)`,
    `CREATE INDEX IF NOT EXISTS idx_roaster_locations_city ON roaster_locations(city)`,
    `CREATE INDEX IF NOT EXISTS idx_roaster_locations_country ON roaster_locations(country)`,
    `CREATE INDEX IF NOT EXISTS idx_process_categories_name ON process_categories(name)`,
    `CREATE INDEX IF NOT EXISTS idx_process_methods_name ON process_methods(name)`,
    `CREATE INDEX IF NOT EXISTS idx_process_methods_categoryId ON process_methods(categoryId)`,
    `CREATE INDEX IF NOT EXISTS idx_process_methods_parentMethodId ON process_methods(parentMethodId)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId ON refresh_tokens(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_bean_inventory_userId ON bean_inventory(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_brew_logs_userId ON brew_logs(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_recipes_userId ON recipes(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_brew_notes_userId ON brew_notes(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_community_posts_userId ON community_posts(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_userId ON reviews(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_recipe_likes_userId ON recipe_likes(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_recipe_likes_recipeId ON recipe_likes(recipeId)`,
  ], "write");
}

async function runMigrations(db) {
  const { normalizeProcess } = require("./utils/processNormalizer");

  // Normalize existing processes
  try {
    const { rows: unnormalized } = await db.execute(
      "SELECT DISTINCT process FROM products WHERE process IS NOT NULL"
    );

    for (const row of unnormalized) {
      if (row.process) {
        const normalized = normalizeProcess(row.process);
        if (normalized && normalized !== row.process) {
          await db.execute({
            sql: "UPDATE products SET process = ? WHERE process = ?",
            args: [normalized, row.process]
          });
        }
      }
    }
  } catch (err) {
    console.warn("Process normalization migration skipped:", err.message);
  }

  // Check columns on recipes table
  const recipesInfo = await db.execute("PRAGMA table_info(recipes)");
  const recipesCols = recipesInfo.rows.map(c => c.name);

  const recipeMigrations = [
    ["isPublic", "ALTER TABLE recipes ADD COLUMN isPublic INTEGER DEFAULT 0"],
    ["authorName", "ALTER TABLE recipes ADD COLUMN authorName TEXT"],
    ["authorSetup", "ALTER TABLE recipes ADD COLUMN authorSetup TEXT"],
    ["roastLevel", "ALTER TABLE recipes ADD COLUMN roastLevel TEXT"],
    ["coffeeBrand", "ALTER TABLE recipes ADD COLUMN coffeeBrand TEXT"],
    ["coffeeName", "ALTER TABLE recipes ADD COLUMN coffeeName TEXT"],
  ];

  for (const [col, sql] of recipeMigrations) {
    if (!recipesCols.includes(col)) {
      await db.execute(sql);
    }
  }

  // Add userId column to content tables for auth system
  const userIdTables = ['bean_inventory', 'brew_logs', 'recipes', 'brew_notes', 'community_posts', 'reviews'];
  for (const table of userIdTables) {
    const tableInfo = await db.execute(`PRAGMA table_info(${table})`);
    const cols = tableInfo.rows.map(c => c.name);
    if (!cols.includes('userId')) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN userId INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    }
  }

  // Populate process taxonomy
  try {
    const { COFFEE_PROCESSING_TAXONOMY } = require("./utils/processNormalizer");

    const countResult = await db.execute("SELECT COUNT(*) as count FROM process_categories");
    const categoryCount = countResult.rows[0].count;

    if (categoryCount === 0) {
      const now = new Date().toISOString();
      const categoryIdMap = {};
      const methodIdMap = {};

      // First pass: Insert categories and root methods
      for (const categoryName in COFFEE_PROCESSING_TAXONOMY) {
        const category = COFFEE_PROCESSING_TAXONOMY[categoryName];

        const catResult = await db.execute({
          sql: "INSERT INTO process_categories (name, description, createdAt) VALUES (?, ?, ?)",
          args: [categoryName, category.description, now]
        });
        categoryIdMap[categoryName] = Number(catResult.lastInsertRowid);

        const methods = category.methods;
        for (const methodName in methods) {
          const method = methods[methodName];
          if (!method.parent) {
            const methodResult = await db.execute({
              sql: "INSERT INTO process_methods (categoryId, name, aliases, parentMethodId, createdAt) VALUES (?, ?, ?, ?, ?)",
              args: [categoryIdMap[categoryName], methodName, JSON.stringify(method.aliases), null, now]
            });
            methodIdMap[methodName] = Number(methodResult.lastInsertRowid);
          }
        }
      }

      // Second pass: Insert child methods with parent references
      for (const categoryName in COFFEE_PROCESSING_TAXONOMY) {
        const category = COFFEE_PROCESSING_TAXONOMY[categoryName];
        const methods = category.methods;

        for (const methodName in methods) {
          const method = methods[methodName];
          if (method.parent) {
            const parentId = methodIdMap[method.parent];
            if (parentId) {
              const methodResult = await db.execute({
                sql: "INSERT INTO process_methods (categoryId, name, aliases, parentMethodId, createdAt) VALUES (?, ?, ?, ?, ?)",
                args: [categoryIdMap[categoryName], methodName, JSON.stringify(method.aliases), parentId, now]
              });
              methodIdMap[methodName] = Number(methodResult.lastInsertRowid);
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

function closeDb() {
  if (clientInstance) {
    clientInstance.close();
    clientInstance = null;
  }
}

module.exports = {
  getDb,
  initSchema,
  createIndexes,
  runMigrations,
  closeDb
};
