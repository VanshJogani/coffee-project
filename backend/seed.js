const fs = require("fs");
const path = require("path");
const { getDb, initSchema } = require("./src/db");

function normalizeProduct(raw, index) {
  const product = {
    productId: String(raw.productId || raw.id || index + 1),
    name: raw.name || raw.Name || "Unknown Coffee",
    roaster: raw.roaster || raw.Roaster || "Unknown Roaster",
    roastType: raw.roastType || raw.Roast_Level || "",
    origin: raw.origin || raw.Origin || raw.Farm || "",
    tastingNotes: raw.tastingNotes || raw.Tasting_Notes || "",
    score: raw.score != null ? Number(raw.score) : null,
    price: raw.price != null ? String(raw.price).replace(/[^0-9.]/g, '') ? Number(String(raw.price).replace(/[^0-9.]/g, '')) : null : (raw.Price != null ? String(raw.Price).replace(/[^0-9.]/g, '') ? Number(String(raw.Price).replace(/[^0-9.]/g, '')) : null : null),
    imageUrl: raw.imageUrl || raw.Image_URL || "",
    cuppingDate: raw.cuppingDate || null,
    description: raw.description || raw.Description || raw.Desc || "",
    url: raw.url || raw.URL || "",
    quantity: raw.quantity || raw.Quantity || ""
  };

  const lowerName = product.name.toLowerCase();
  const lowerDesc = (product.description || "").toLowerCase();
  const combined = lowerName + " " + lowerDesc;
  let category = "Coffee";

  // --- Subscription detection ---
  if (lowerName.includes("subscription") || lowerName.includes("subscribe")) {
    category = "Subscriptions";
  }
  // --- Accessory / Equipment detection ---
  else {
    const accessoryKeywords = [
      // Brewing Equipment
      "aeropress", "v60", "hario", "chemex", "french press", "moka pot",
      "dripper", "pour over", "pourover", "siphon", "percolator", "bialetti",
      "clever dripper", "kalita", "origami dripper", "cold brew maker",
      "brewer", "press filter", "brass filter", "prass filter",
      // Grinders
      "grinder", "burr grinder", "hand grinder",
      // Kettles & Servers
      "kettle", "gooseneck", "server", "carafe", "pitcher", "decanter",
      // Drinkware
      "mug", "tumbler", "cup", "cups", "waycup", "glass ", "glasses",
      "sipper", "flask", "bottle", "reusable",
      // Scales & Tools
      "scale ", "weighing", "thermometer", "timer", "tamper", "portafilter",
      "milk frother", "frother", "steam wand", "knock box", "distribution tool",
      // Filters & Consumables
      "filter paper", "paper filter", "metal filter", "mesh filter",
      "wave filter",
      // Merchandise & Apparel
      "t-shirt", "tshirt", "tee ", "hoodie", "cap ", "hat ", "tote bag", "tote",
      "sticker", "poster", "pin ", "badge", "merch", "merchandise",
      "bag tag", "coaster",
      // Gift & Hamper
      "gift box", "gift set", "gift card", "hamper", "combo pack",
      // Books & Decor
      "book ", "candle", "diffuser", "decor", "artwork",
      // Food / Non-Coffee beverages
      "syrup", "chocolate bar", "brownie", "cookie", "biscuit", "cake",
      "trail mix", "granola",
      // Machine parts
      "gasket", "group head", "drip tray",
      // Appliances
      "coffee maker", "coffee machine", "espresso machine",
      // Saucer
      "saucer"
    ];

    // Items that are clearly NOT coffee products (services, events, experiences, misc)
    const definitelyNotCoffee = [
      "bike", "rental", "bicycle", "cycle",
      "music", "live music", "concert", "gig",
      "pottery", "ceramic", "workshop", "class ",
      "tour ", "tours", "tasting session", "event",
      "yoga", "meditation", "wellness",
      "laundry", "cleaning", "ironing",
      "brace", "bracelet", "jewel", "necklace", "ring ",
      "tattoo", "piercing",
      "surfboard", "surf ", "kayak", "paddle",
      "accommodation", "stay ", "hostel", "room ",
      "spa ", "massage", "facial",
      "meal ", "breakfast", "lunch", "dinner", "brunch",
      "parking", "locker", "storage",
      "sim card", "wifi", "internet",
      "voucher", "coupon",
      "pen ", "notebook", "diary",
      "planter", "plant ", "succulent", "seed kit",
      "perfume", "fragrance", "soap", "shampoo",
      "puzzle", "game ", "board game",
      "cushion", "pillow", "blanket", "towel",
      "bag pack", "backpack", "luggage",
      "umbrella", "raincoat",
      "air freshener", "incense",
      "keychain", "magnet"
    ];

    const teaKeywords = [
      "tea ", " tea", "chai ", " chai", "matcha", "green tea", "black tea",
      "herbal tea", "tisane", "iced tea"
    ];

    const coffeeKeywords = [
      "roast", "beans", "bean ", "blend", "estate", "coffee", "peaberry",
      "arabica", "robusta", "naturals", "microlot", "decaf", "espresso",
      "single origin", "washed", "honey process", "natural process",
      "anaerobic", "monsooned", "instant coffee", "filter coffee",
      "drip bag", "drip box", "brew bag"
    ];

    const hasCoffeeAttributes = Boolean(
      product.roastType || product.tastingNotes || product.origin ||
      raw.Roast_Level || raw.Tasting_Notes
    );
    const hasCoffeeKeyword = coffeeKeywords.some(k => lowerName.includes(k));
    const hasAccessoryKeyword = accessoryKeywords.some(k => lowerName.includes(k));
    const hasTeaKeyword = teaKeywords.some(k => lowerName.includes(k));
    const isDefinitelyNotCoffee = definitelyNotCoffee.some(k => lowerName.includes(k));
    const hasStrongCoffeeAttr = Boolean(product.roastType || raw.Roast_Level);

    // 1. Definitely-not-coffee items (bike rental, live music, etc.) — always Accessories
    if (isDefinitelyNotCoffee && !hasCoffeeKeyword) {
      category = "Accessories";
    }
    // 2. Tea detection - Prioritize if it has tea keywords and is not strongly coffee
    else if (hasTeaKeyword && !hasCoffeeKeyword) {
      // Even if it has "origin", tea has origins too. 
      // We only skip if it has explicit coffee-only attributes like Roast Level
      if (!hasStrongCoffeeAttr) {
        category = "Tea";
      }
    }
    // 3. Has accessory keyword AND coffee keyword — check deeper
    else if (hasAccessoryKeyword && hasCoffeeKeyword) {
      // If it's clearly equipment, always mark accessory
      const strongAccessory = ["grinder", "kettle", "gooseneck", "scale ", "v60",
        "chemex", "aeropress", "french press", "moka pot", "percolator",
        "tumbler", "mug", "server", "pitcher", "frother", "tamper", "machine",
        "cup", "cups", "saucer", "glass", "bialetti", "brewer", "press filter",
        "brass filter", "prass filter", "pour over", "reusable"];
      if (strongAccessory.some(k => lowerName.includes(k))) {
        category = "Accessories";
      }
    }
    // 4. Explicit accessory in name, no coffee keyword
    else if (hasAccessoryKeyword && !hasCoffeeKeyword) {
      category = "Accessories";
    }
    // 5. No coffee keywords AND no coffee attributes — probably not coffee
    else if (!hasCoffeeKeyword && !hasStrongCoffeeAttr) {
      // Check description more strictly: need 2+ coffee keywords to keep it as Coffee
      const descCoffeeHits = coffeeKeywords.filter(k => lowerDesc.includes(k)).length;
      if (descCoffeeHits < 2) {
        // If it still has tea keywords, it's Tea, otherwise Accessories
        if (hasTeaKeyword) {
          category = "Tea";
        } else {
          category = "Accessories";
        }
      }
    }
  }

  product.category = category;

  // --- Post-processing for Tea ---
  if (category === "Tea") {
    const nameUpper = product.name.toUpperCase();

    // Extract Origin if empty
    if (!product.origin) {
      if (nameUpper.includes("ASSAM")) product.origin = "Assam";
      else if (nameUpper.includes("DARJEELING")) product.origin = "Darjeeling";
      else if (nameUpper.includes("NILGIRI")) product.origin = "Nilgiri";
      else if (nameUpper.includes("KASHMIRI")) product.origin = "Kashmir";
      else if (nameUpper.includes("SOUTH AFRICAN")) product.origin = "South Africa";
      else if (nameUpper.includes("JAPANESE")) product.origin = "Japan";
    }

    // Use roastType field for Tea Type since it's otherwise empty
    if (!product.roastType) {
      if (nameUpper.includes("GREEN")) product.roastType = "Green Tea";
      else if (nameUpper.includes("BLACK")) product.roastType = "Black Tea";
      else if (nameUpper.includes("WHITE")) product.roastType = "White Tea";
      else if (nameUpper.includes("MATCHA")) product.roastType = "Matcha";
      else if (nameUpper.includes("CHAI") || nameUpper.includes("MASALA")) product.roastType = "Chai / Masala";
      else if (nameUpper.includes("HERBAL") || nameUpper.includes("TISANE") || nameUpper.includes("ROOIBOS") || nameUpper.includes("MINT") || nameUpper.includes("CHAMOMILE")) product.roastType = "Herbal / Tisane";
      else if (nameUpper.includes("CASCARA")) product.roastType = "Cascara";
      else if (nameUpper.includes("EARL GREY")) product.roastType = "Earl Grey";
      else if (nameUpper.includes("JASMINE")) product.roastType = "Jasmine";
      else if (nameUpper.includes("INFUSER") || nameUpper.includes("BALL")) product.roastType = "Tea Accessories";
      else product.roastType = "Other Tea";
    }
  }

  return product;
}

function createSampleReviews(db, productRowId) {
  const now = new Date().toISOString();

  const samples = [
    {
      reviewerName: "Coffee Lover",
      rating: 5,
      comment: "Fantastic cup, really enjoyed the balance and sweetness."
    },
    {
      reviewerName: "Taster Bot",
      rating: 4,
      comment: "Great clarity and acidity, would buy again."
    }
  ];

  samples.forEach((s) => {
    db.run(
      `INSERT INTO reviews
       (productId, reviewerName, rating, comment, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        productRowId,
        s.reviewerName,
        s.rating,
        s.comment,
        now,
        now
      ]
    );
  });
}

async function main() {
  const args = process.argv.slice(2);
  const jsonPath = args[0] || "results/cleaned_coffee_products.json";
  const fullPath = path.resolve(process.cwd(), jsonPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Could not find JSON file at ${fullPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(fullPath, "utf-8");

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse JSON:", e.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error("Expected top-level JSON array of products.");
    process.exit(1);
  }

  const db = getDb();

  db.serialize(() => {
    db.run("DROP TABLE IF EXISTS reviews");
    db.run("DROP TABLE IF EXISTS products");
    db.run("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, productId TEXT UNIQUE, name TEXT NOT NULL, roaster TEXT, roastType TEXT, origin TEXT, tastingNotes TEXT, score REAL, price REAL, imageUrl TEXT, cuppingDate TEXT, description TEXT, url TEXT, quantity TEXT, category TEXT);");
    db.run("CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER NOT NULL, reviewerName TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE);");

    db.run("BEGIN TRANSACTION");

    data.forEach((item, idx) => {
      const p = normalizeProduct(item, idx);

      db.run(
        `INSERT INTO products
         (productId, name, roaster, roastType, origin, tastingNotes, score, price, imageUrl, cuppingDate, description, url, quantity, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.productId,
          p.name,
          p.roaster,
          p.roastType,
          p.origin,
          p.tastingNotes,
          p.score,
          p.price,
          p.imageUrl,
          p.cuppingDate,
          p.description,
          p.url,
          p.quantity,
          p.category
        ],
        function (err) {
          if (err) {
            console.error("Insert error:", err);
            return;
          }

          createSampleReviews(db, this.lastID);
        }
      );
    });

    db.run("COMMIT", () => {
      db.get("SELECT COUNT(*) as c FROM products", (err, row) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }

        console.log(`Seeded ${row.c} products into the database.`);
        process.exit(0);
      });
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});