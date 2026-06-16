const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client");
const { normalizeProcess } = require("./src/utils/processNormalizer");

// ── Roast type normalization ──────────────────────────────────────────────────
function normalizeRoastType(raw) {
  if (!raw) return "";
  const r = String(raw).trim();
  if (/^dark/i.test(r)) return "Dark Roast";
  if (/^medium[\s-]dark/i.test(r)) return "Medium-Dark Roast";
  if (/^medium/i.test(r)) return "Medium Roast";
  if (/^light/i.test(r)) return "Light Roast";
  return r;
}

function normalizeProduct(raw, index) {
  const rawRoastType = raw.roastType || raw.Roast_Level || "";
  const rawProcess = raw.process || raw.Process || "";
  const normalizedProcess = normalizeProcess(rawProcess) || rawProcess;

  const product = {
    productId: String(raw.productId || raw.id || index + 1),
    name: raw.name || raw.Name || "Unknown Coffee",
    roaster: raw.roaster || raw.Roaster || "Unknown Roaster",
    roastType: normalizeRoastType(rawRoastType),
    origin: raw.origin || raw.Origin || raw.Farm || "",
    process: normalizedProcess,
    tastingNotes: raw.tastingNotes || raw.Tasting_Notes || "",
    score: raw.score != null ? Number(raw.score) : null,
    price: (() => {
      const v = raw.price ?? raw.Price;
      if (v == null) return null;
      const n = Number(String(v).replace(/[^0-9.]/g, ""));
      return isNaN(n) ? null : n;
    })(),
    imageUrl: raw.imageUrl || raw.Image_URL || "",
    cuppingDate: raw.cuppingDate || null,
    description: raw.description || raw.Description || raw.Desc || "",
    url: raw.url || raw.URL || "",
    quantity: raw.quantity || raw.Quantity || ""
  };

  const lowerName = product.name.toLowerCase();
  const lowerDesc = (product.description || "").toLowerCase();
  const upstreamCategory = raw.category || raw.Category || "";

  let category = "Coffee";

  if (lowerName.includes("subscription") || lowerName.includes("subscribe")) {
    category = "Subscriptions";
  } else if (["tasting session", "cupping session", "latte art", "throwdown",
    "workshop", "masterclass", "master class", "coffee walk", "brew class",
    "competition", "championship", "meetup", "meet up",
    "gully tour", "coffee tour", "coffee chronicles",
    "sca course", "sca brewing", "sca barista"].some(k => lowerName.includes(k))) {
    category = "Events";
  } else {
    const strongTeaKeywords = [
      "green tea", "black tea", "white tea", "oolong tea", "oolong",
      "rooibos", "herbal tea", "tisane", "earl grey", "matcha",
      "cascara", "blossom tea", "masala tea", "masala chai",
      "darjeeling tea", "assam tea", "nilgiri tea", "chamomile",
      "jasmine tea", "lemon tea", "mango tea", "vanilla tea",
      "apple tea", "flower tea", "blooming tea", "kombucha"
    ];
    const teaKeywords = ["tea ", " tea", "chai ", " chai"];
    const hasStrongTeaKeyword = strongTeaKeywords.some(k => lowerName.includes(k));
    const hasTeaKeyword = hasStrongTeaKeyword || teaKeywords.some(k => lowerName.includes(k));
    const strongCoffeeInName = ["coffee bean", "coffee roast", "roasted coffee", "whole bean coffee"]
      .some(k => lowerName.includes(k));

    const accessoryKeywords = [
      "aeropress", "v60", "hario", "chemex", "french press", "moka pot",
      "dripper", "pour over", "pourover", "siphon", "percolator", "bialetti",
      "clever dripper", "kalita", "origami dripper", "cold brew maker",
      "brewer", "press filter", "brass filter", "prass filter",
      "grinder", "burr grinder", "hand grinder", "coffee mill",
      "kettle", "gooseneck", "server", "carafe", "pitcher", "decanter",
      "mug", "tumbler", "cup", "cups", "waycup", "glass ", "glasses",
      "sipper", "flask", "bottle", "reusable",
      "scale ", "weighing", "thermometer", "timer", "tamper", "portafilter",
      "milk frother", "frother", "steam wand", "knock box", "distribution tool",
      "filter paper", "paper filter", "metal filter", "mesh filter", "wave filter",
      "t-shirt", "tshirt", "tee ", "hoodie", "cap ", "hat ", "tote bag", "tote",
      "totebag", "sticker", "poster", "pin ", "badge", "merch", "merchandise",
      "bag tag", "coaster",
      "gift box", "gift set", "gift card", "hamper", "combo pack",
      "book ", "candle", "diffuser", "decor", "artwork",
      "syrup", "chocolate bar", "brownie", "cookie", "biscuit", "cake",
      "trail mix", "granola",
      "gasket", "group head", "drip tray",
      "coffee maker", "coffee machine", "espresso machine", "saucer",
      "drip kit", "starter kit", "work-from-home kit", "flair neo",
      "semi automatic", "holder",
      "canister", "airscape", "nanofoamer", "foamer",
      "alarm clock", "cool control", "mixology",
      "paper filters", "ceramic mill", "mini-slim",
      "refractometer", "apron", "cleaning tablet",
      "saeco", "slingshot", "jura ", "barisieur",
      "decoding coffee", "everyday tools"
    ];
    const definitelyNotCoffee = [
      "bike", "rental", "bicycle", "cycle", "music", "live music", "concert", "gig",
      "pottery", "ceramic", "workshop", "class ", "tour ", "tours", "tasting session", "event",
      "yoga", "meditation", "wellness", "laundry", "cleaning", "ironing",
      "brace", "bracelet", "jewel", "necklace", "ring ", "tattoo", "piercing",
      "surfboard", "surf ", "kayak", "paddle", "accommodation", "stay ", "hostel", "room ",
      "spa ", "massage", "facial", "meal ", "breakfast", "lunch", "dinner", "brunch",
      "parking", "locker", "storage", "sim card", "wifi", "internet",
      "voucher", "coupon", "pen ", "notebook", "diary",
      "planter", "plant ", "succulent", "seed kit",
      "perfume", "fragrance", "soap", "shampoo",
      "puzzle", "game ", "board game",
      "cushion", "pillow", "blanket", "towel",
      "bag pack", "backpack", "luggage", "umbrella", "raincoat",
      "air freshener", "incense", "keychain", "magnet"
    ];
    const coffeeKeywords = [
      "roast", "beans", "bean ", "blend", "estate", "coffee", "peaberry",
      "arabica", "robusta", "naturals", "microlot", "decaf", "espresso",
      "single origin", "washed", "honey process", "natural process",
      "anaerobic", "monsooned", "instant coffee", "filter coffee",
      "drip bag", "drip box", "brew bag"
    ];

    const hasCoffeeKeyword = coffeeKeywords.some(k => lowerName.includes(k));
    const hasAccessoryKeyword = accessoryKeywords.some(k => lowerName.includes(k));
    const isDefinitelyNotCoffee = definitelyNotCoffee.some(k => lowerName.includes(k));
    const hasStrongCoffeeAttr = Boolean(product.roastType || rawRoastType);

    const strongAccessory = ["grinder", "kettle", "gooseneck", "scale ", "v60",
      "chemex", "aeropress", "french press", "moka pot", "percolator",
      "tumbler", "mug", "server", "pitcher", "frother", "tamper", "machine",
      "cup", "cups", "saucer", "glass", "bialetti", "brewer", "press filter",
      "brass filter", "prass filter", "pour over", "reusable",
      "flair", "dripper", "tote", "totebag", "hamper", "gift box", "gift set",
      "weighing", "starter kit", "work-from-home kit", "holder", "drip kit",
      "coffee mill", "canister", "airscape", "nanofoamer", "foamer",
      "paper filters", "hario", "decanter", "alarm clock", "cool control",
      "mixology", "mini-slim", "ceramic mill",
      "saeco", "slingshot", "jura ", "barisieur",
      "decoding coffee", "everyday tools"];

    if (isDefinitelyNotCoffee && !hasCoffeeKeyword) {
      category = "Accessories";
    } else if (hasStrongTeaKeyword && !strongCoffeeInName && hasAccessoryKeyword) {
      category = strongAccessory.some(k => lowerName.includes(k)) ? "Accessories" : "Tea";
    } else if (hasStrongTeaKeyword && !strongCoffeeInName) {
      category = "Tea";
    } else if (hasTeaKeyword && !hasCoffeeKeyword && !strongCoffeeInName) {
      category = "Tea";
    } else if (hasTeaKeyword && !strongCoffeeInName) {
      category = (hasAccessoryKeyword && strongAccessory.some(k => lowerName.includes(k)))
        ? "Accessories"
        : (upstreamCategory === "Tea" || !hasStrongCoffeeAttr) ? "Tea" : "Coffee";
    } else if (hasAccessoryKeyword && hasCoffeeKeyword) {
      if (strongAccessory.some(k => lowerName.includes(k))) category = "Accessories";
    } else if (hasAccessoryKeyword && !hasCoffeeKeyword) {
      category = "Accessories";
    } else if (!hasCoffeeKeyword && !hasStrongCoffeeAttr) {
      const descCoffeeHits = coffeeKeywords.filter(k => lowerDesc.includes(k)).length;
      if (descCoffeeHits < 2) {
        category = hasTeaKeyword ? "Tea" : "Accessories";
      }
    } else if (upstreamCategory && upstreamCategory !== "Coffee" && !hasCoffeeKeyword) {
      category = upstreamCategory;
    }
  }

  product.category = category;

  if (category === "Tea") {
    const nameUpper = product.name.toUpperCase();
    if (!product.origin) {
      if (nameUpper.includes("ASSAM")) product.origin = "Assam";
      else if (nameUpper.includes("DARJEELING")) product.origin = "Darjeeling";
      else if (nameUpper.includes("NILGIRI")) product.origin = "Nilgiri";
      else if (nameUpper.includes("KASHMIRI")) product.origin = "Kashmir";
      else if (nameUpper.includes("SOUTH AFRICAN")) product.origin = "South Africa";
      else if (nameUpper.includes("JAPANESE")) product.origin = "Japan";
    }
    if (!product.roastType) {
      if (nameUpper.includes("GREEN")) product.roastType = "Green Tea";
      else if (nameUpper.includes("BLACK")) product.roastType = "Black Tea";
      else if (nameUpper.includes("WHITE")) product.roastType = "White Tea";
      else if (nameUpper.includes("MATCHA")) product.roastType = "Matcha";
      else if (nameUpper.includes("CHAI") || nameUpper.includes("MASALA")) product.roastType = "Chai / Masala";
      else if (["HERBAL", "TISANE", "ROOIBOS", "MINT", "CHAMOMILE"].some(k => nameUpper.includes(k))) product.roastType = "Herbal / Tisane";
      else if (nameUpper.includes("CASCARA")) product.roastType = "Cascara";
      else if (nameUpper.includes("EARL GREY")) product.roastType = "Earl Grey";
      else if (nameUpper.includes("JASMINE")) product.roastType = "Jasmine";
      else if (nameUpper.includes("INFUSER") || nameUpper.includes("BALL")) product.roastType = "Tea Accessories";
      else product.roastType = "Other Tea";
    }
  }

  return product;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonPath = args[0] || "results/cleaned_coffee_products.json";
  const fullPath = path.resolve(process.cwd(), jsonPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Could not find JSON file at ${fullPath}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  } catch (e) {
    console.error("Failed to parse JSON:", e.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error("Expected top-level JSON array of products.");
    process.exit(1);
  }

  // Create client — supports both Turso (remote) and local file
  let db;
  if (process.env.TURSO_DATABASE_URL) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "coffee.db");
    db = createClient({ url: `file:${dbPath}` });
  }

  // Drop and recreate tables
  await db.batch([
    "DROP TABLE IF EXISTS brew_notes",
    "DROP TABLE IF EXISTS brew_logs",
    "DROP TABLE IF EXISTS bean_inventory",
    "DROP TABLE IF EXISTS recipes",
    "DROP TABLE IF EXISTS user_profile",
    "DROP TABLE IF EXISTS reviews",
    "DROP TABLE IF EXISTS product_variants",
    "DROP TABLE IF EXISTS products",
    `CREATE TABLE products (
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
    `CREATE TABLE product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      quantity TEXT,
      price REAL,
      originalProductId TEXT,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      reviewerName TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      displayName TEXT DEFAULT 'Brewer',
      defaultGrinder TEXT,
      defaultBrewer TEXT,
      createdAt TEXT NOT NULL
    )`,
    `CREATE TABLE recipes (
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
    )`,
    `CREATE TABLE bean_inventory (
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
    `CREATE TABLE brew_logs (
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
    `CREATE TABLE brew_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      authorName TEXT NOT NULL,
      body TEXT NOT NULL,
      brewLogId INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (brewLogId) REFERENCES brew_logs(id) ON DELETE SET NULL
    )`,
    "CREATE INDEX idx_products_roaster ON products(roaster)",
    "CREATE INDEX idx_products_roastType ON products(roastType)",
    "CREATE INDEX idx_products_origin ON products(origin)",
    "CREATE INDEX idx_products_category ON products(category)",
    "CREATE INDEX idx_products_cuppingDate ON products(cuppingDate)",
    "CREATE INDEX idx_products_price ON products(price)",
    "CREATE INDEX idx_products_name ON products(name)",
    "CREATE INDEX idx_product_variants_productId ON product_variants(productId)",
    "CREATE INDEX idx_reviews_productId ON reviews(productId)",
    "CREATE INDEX idx_brew_logs_beanInventoryId ON brew_logs(beanInventoryId)",
    "CREATE INDEX idx_brew_logs_recipeId ON brew_logs(recipeId)",
    "CREATE INDEX idx_brew_notes_productId ON brew_notes(productId)",
    "CREATE INDEX idx_bean_inventory_productId ON bean_inventory(productId)",
  ], "write");

  // Normalize all products first
  const normalized = data.map((item, idx) => normalizeProduct(item, idx));

  // Group into canonical products + variants (dedup by name+roaster)
  const canonicalMap = new Map();
  for (const p of normalized) {
    const key = `${p.name.toLowerCase()}::${p.roaster.toLowerCase()}`;
    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, { canonical: p, variants: [] });
    }
    const entry = canonicalMap.get(key);
    entry.variants.push({ quantity: p.quantity, price: p.price, originalProductId: p.productId });
    if (p.price != null && (entry.canonical.price == null || p.price < entry.canonical.price)) {
      entry.canonical.price = p.price;
      entry.canonical.quantity = p.quantity;
    }
  }

  const sampleReviews = [
    { reviewerName: "Coffee Lover", rating: 5, comment: "Fantastic cup, really enjoyed the balance and sweetness." },
    { reviewerName: "Taster Bot", rating: 4, comment: "Great clarity and acidity, would buy again." }
  ];

  // Use transaction for bulk inserts
  const tx = await db.transaction("write");
  let productCount = 0;

  try {
    const now = new Date().toISOString();

    for (const { canonical: p, variants } of canonicalMap.values()) {
      const result = await tx.execute({
        sql: `INSERT INTO products (productId, name, roaster, roastType, origin, process, tastingNotes,
          score, price, imageUrl, cuppingDate, description, url, quantity, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [p.productId, p.name, p.roaster, p.roastType, p.origin, p.process,
              p.tastingNotes, p.score, p.price, p.imageUrl, p.cuppingDate,
              p.description, p.url, p.quantity, p.category]
      });
      const dbId = Number(result.lastInsertRowid);
      productCount++;

      // Insert variants (skip if only one variant with no distinct quantity)
      if (variants.length > 1) {
        for (const v of variants) {
          await tx.execute({
            sql: `INSERT INTO product_variants (productId, quantity, price, originalProductId)
             VALUES (?, ?, ?, ?)`,
            args: [dbId, v.quantity || null, v.price ?? null, v.originalProductId]
          });
        }
      }

      // Sample reviews
      for (const r of sampleReviews) {
        await tx.execute({
          sql: `INSERT INTO reviews (productId, reviewerName, rating, comment, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          args: [dbId, r.reviewerName, r.rating, r.comment, now, now]
        });
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  console.log(`Seeded ${productCount} products (from ${normalized.length} raw entries) into the database.`);
  db.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
