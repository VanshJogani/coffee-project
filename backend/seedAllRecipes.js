/**
 * Bulk-seeds ALL recipes from organized_recipes.json into the database.
 * Transforms the scraped format into the DB schema format.
 * Safe to re-run — skips recipes whose name already exists.
 *
 * Usage: node backend/seedAllRecipes.js
 */

const path = require("path");
const dotenv = require("dotenv");

// Bypass corporate SSL inspection for Turso connection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Load env from root .env (handles TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { getDb, initSchema, runMigrations, closeDb } = require("./src/db");

const recipesPath = path.resolve(__dirname, "../organized_recipes.json");
const organizedRecipes = require(recipesPath);

/**
 * Normalize grind size strings to standard values
 */
function normalizeGrindSize(raw) {
  if (!raw) return "Medium";
  const lower = raw.toLowerCase();
  if (lower.includes("very fine") || lower === "espresso") return "Extra-Fine";
  if (lower.includes("coarse") && lower.includes("medium")) return "Medium-Coarse";
  if (lower.includes("coarse")) return "Coarse";
  if (lower.includes("fine") && lower.includes("medium")) return "Medium-Fine";
  if (lower.includes("fine")) return "Fine";
  if (lower.includes("medium")) return "Medium";
  return "Medium";
}

/**
 * Parse a numeric value from a string (handles "11", "11g", etc.)
 */
function parseNum(val) {
  if (val == null) return null;
  const n = parseFloat(String(val).replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

/**
 * Convert scraped steps into our DB step format.
 * The scraped format has: { step_number, action, timer_seconds?, timer_instruction? }
 * Our DB format needs: { phase, timeSec, instruction, pourGrams }
 */
function transformSteps(steps) {
  if (!steps || !Array.isArray(steps) || steps.length === 0) return [];

  const result = [];
  let cumulativeTime = 0;

  for (const step of steps) {
    const action = step.action || "";
    const lowerAction = action.toLowerCase();

    // Determine phase — prep steps before actual brewing starts
    const isPrep =
      lowerAction.includes("prep") ||
      lowerAction.includes("rinse") ||
      lowerAction.includes("preheat") ||
      lowerAction.includes("grind") ||
      (lowerAction.includes("add") && lowerAction.includes("ground")) ||
      (lowerAction.includes("add") && lowerAction.includes("coffee") && !lowerAction.includes("water"));

    // Try to extract pour grams from the action text
    let pourGrams = 0;
    const pourMatch = action.match(/(\d+)\s*(?:g|grams?|ml)\s*(?:of\s*)?water/i) ||
                      action.match(/pour\s*(\d+)\s*(?:g|grams?|ml)/i) ||
                      action.match(/add\s*(\d+)\s*(?:g|grams?|ml)/i);
    if (pourMatch && (lowerAction.includes("water") || lowerAction.includes("pour"))) {
      pourGrams = parseInt(pourMatch[1], 10);
    }

    if (isPrep && result.length === 0) {
      result.push({
        phase: "prep",
        instruction: action,
      });
    } else {
      result.push({
        phase: "brew",
        timeSec: cumulativeTime,
        instruction: action,
        pourGrams,
      });
      // Advance time by timer_seconds if present
      if (step.timer_seconds && step.timer_seconds > 0) {
        cumulativeTime += step.timer_seconds;
      }
    }
  }

  return result;
}

/**
 * Estimate brew time defaults based on brewer type and brew speed.
 * These are reasonable defaults for when no time data is available in the recipe.
 */
const BREW_TIME_DEFAULTS = {
  AeroPress: { fast: 60, medium: 120, slow: 240 },
  V60: { fast: 120, medium: 180, slow: 270 },
  "French Press": { fast: 180, medium: 240, slow: 300 },
  Chemex: { fast: 180, medium: 240, slow: 300 },
  "Moka Pot": { fast: 180, medium: 240, slow: 300 },
  Clever: { fast: 120, medium: 180, slow: 240 },
  Kalita: { fast: 120, medium: 180, slow: 240 },
  Other: { fast: 90, medium: 150, slow: 240 },
};

/**
 * Try to extract a time duration (in seconds) from a step's action text.
 * Looks for patterns like "2 minutes", "0:40", "30 seconds", "4-6 minutes", etc.
 * For ranges, uses the midpoint.
 */
function parseTimeFromText(text) {
  if (!text) return 0;

  // Match "X:YY" timestamp format (e.g., "0:40", "2:30")
  const timestampMatch = text.match(/(\d+):(\d{2})\b/);
  if (timestampMatch) {
    return parseInt(timestampMatch[1], 10) * 60 + parseInt(timestampMatch[2], 10);
  }

  // Match "X-Y minutes" range (use midpoint)
  const rangeMinMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*min(?:ute)?s?/i);
  if (rangeMinMatch) {
    const low = parseInt(rangeMinMatch[1], 10);
    const high = parseInt(rangeMinMatch[2], 10);
    return Math.round((low + high) / 2) * 60;
  }

  // Match "X minutes" or "X min"
  const minMatch = text.match(/(\d+)\s*min(?:ute)?s?/i);
  if (minMatch) {
    return parseInt(minMatch[1], 10) * 60;
  }

  // Match "X-Y seconds" range
  const rangeSecMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*sec(?:ond)?s?/i);
  if (rangeSecMatch) {
    const low = parseInt(rangeSecMatch[1], 10);
    const high = parseInt(rangeSecMatch[2], 10);
    return Math.round((low + high) / 2);
  }

  // Match "X seconds" or "X sec" or "Xs"
  const secMatch = text.match(/(\d+)\s*s(?:ec(?:ond)?s?)?\b/i);
  if (secMatch) {
    const val = parseInt(secMatch[1], 10);
    // Only count if it's a plausible duration (not step numbers, weights, etc.)
    if (val >= 5 && val <= 600) return val;
  }

  return 0;
}

/**
 * Transform a single organized recipe to our DB format
 */
function transformRecipe(recipe) {
  const meta = recipe.metadata || {};

  const coffeeGrams = parseNum(meta.coffee_weight_g);
  const waterGrams = parseNum(meta.water_volume_ml);
  const waterTempC = parseNum(meta.temperature_c);
  const grindSize = normalizeGrindSize(meta.grind_size);

  const steps = transformSteps(recipe.steps);

  // Calculate total brew time from steps — use the max cumulative timeSec
  let targetBrewTimeSec = 0;
  for (const step of steps) {
    if (step.timeSec && step.timeSec > targetBrewTimeSec) {
      targetBrewTimeSec = step.timeSec;
    }
  }

  // If we didn't get a brew time from step timings, sum timer_seconds from source steps
  if (targetBrewTimeSec === 0 && recipe.steps) {
    targetBrewTimeSec = recipe.steps.reduce((sum, s) => sum + (s.timer_seconds || 0), 0);
  }

  // If still 0, try to parse time references from the step action text
  if (targetBrewTimeSec === 0 && recipe.steps) {
    let maxTimeParsed = 0;
    for (const step of recipe.steps) {
      const parsed = parseTimeFromText(step.action);
      if (parsed > maxTimeParsed) {
        maxTimeParsed = parsed;
      }
      // Also check timer_instruction field
      const parsedInstr = parseTimeFromText(step.timer_instruction);
      if (parsedInstr > maxTimeParsed) {
        maxTimeParsed = parsedInstr;
      }
    }
    if (maxTimeParsed > 0) {
      targetBrewTimeSec = maxTimeParsed;
    }
  }

  // If still 0, use a reasonable default based on brewer type and brew_speed
  if (targetBrewTimeSec === 0) {
    const brewerType = "AeroPress"; // Currently all recipes are AeroPress
    const brewSpeed = meta.brew_speed || "medium";
    const defaults = BREW_TIME_DEFAULTS[brewerType] || BREW_TIME_DEFAULTS.Other;
    targetBrewTimeSec = defaults[brewSpeed] || defaults.medium;
  }

  // Detect bloom time from steps
  let bloomTimeSec = 0;
  const bloomStep = recipe.steps?.find(s =>
    s.action && s.action.toLowerCase().includes("bloom")
  );
  if (bloomStep && bloomStep.timer_seconds) {
    bloomTimeSec = bloomStep.timer_seconds;
  }

  // Build notes from description (truncate to keep it reasonable)
  let notes = recipe.short_description || "";
  if (meta.coffee_roast && meta.coffee_roast !== "Any") {
    notes += notes ? ` Roast: ${meta.coffee_roast}.` : `Roast: ${meta.coffee_roast}.`;
  }
  if (meta.inverted) {
    notes += " Inverted method.";
  }

  return {
    name: recipe.title,
    brewerType: "AeroPress",
    grindSize,
    coffeeGrams,
    waterGrams,
    waterTempC: waterTempC ? Math.round(waterTempC) : null,
    bloomTimeSec,
    targetBrewTimeSec,
    steps,
    notes: notes || null,
    sourceRecipe: recipe.url || null,
  };
}

/**
 * Update brew times for existing recipes that have targetBrewTimeSec = 0 or NULL.
 * Matches recipes by name and recalculates from the source JSON.
 */
async function updateExistingTimes(db) {
  const now = new Date().toISOString();

  // Find all recipes with missing/zero brew times
  const zeroTimeRecipes = await db.execute(
    "SELECT id, name FROM recipes WHERE targetBrewTimeSec IS NULL OR targetBrewTimeSec = 0"
  );

  if (zeroTimeRecipes.rows.length === 0) {
    console.log("✅ No recipes with zero/null brew times found — nothing to update.");
    return;
  }

  console.log(`Found ${zeroTimeRecipes.rows.length} recipes with zero/null brew times. Updating...`);

  // Build a lookup from source JSON by title
  const sourceByTitle = new Map();
  for (const recipe of organizedRecipes) {
    sourceByTitle.set(recipe.title, recipe);
  }

  const BATCH_SIZE = 50;
  let updated = 0;
  const toUpdate = [];

  for (const row of zeroTimeRecipes.rows) {
    const source = sourceByTitle.get(row.name);
    if (!source) continue; // Not from our JSON source, skip

    const transformed = transformRecipe(source);
    if (transformed.targetBrewTimeSec > 0) {
      toUpdate.push({ id: row.id, targetBrewTimeSec: transformed.targetBrewTimeSec });
    }
  }

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const statements = batch.map(item => ({
      sql: "UPDATE recipes SET targetBrewTimeSec = ?, updatedAt = ? WHERE id = ?",
      args: [item.targetBrewTimeSec, now, item.id]
    }));

    await db.batch(statements, "write");
    updated += batch.length;
    process.stdout.write(`\r  Updated ${updated}/${toUpdate.length}...`);
  }

  console.log(`\n✅ Updated brew times for ${updated} recipes.`);
}

async function main() {
  const args = process.argv.slice(2);
  const updateTimesOnly = args.includes("--update-times");

  const db = getDb();
  await initSchema(db);
  await runMigrations(db);

  // If --update-times flag is passed, only fix existing records and exit
  if (updateTimesOnly) {
    await updateExistingTimes(db);
    closeDb();
    return;
  }

  const now = new Date().toISOString();

  // Get existing recipe names to avoid duplicates
  const existing = await db.execute("SELECT name FROM recipes");
  const existingNames = new Set(existing.rows.map(r => r.name));

  const toInsert = [];
  let skipped = 0;

  for (const recipe of organizedRecipes) {
    if (existingNames.has(recipe.title)) {
      skipped++;
      continue;
    }

    const transformed = transformRecipe(recipe);
    toInsert.push(transformed);
  }

  if (toInsert.length === 0) {
    console.log(`✅ Nothing to seed — all ${skipped} recipes already exist.`);
    // Still update times for existing recipes that have 0
    await updateExistingTimes(db);
    closeDb();
    return;
  }

  // Batch insert in groups of 50 (libsql batch limit)
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const statements = batch.map(recipe => ({
      sql: `INSERT INTO recipes
       (name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
        bloomTimeSec, targetBrewTimeSec, steps, isBuiltIn, sourceRecipe, notes,
        isPublic, authorName, authorSetup, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, NULL, NULL, ?, ?)`,
      args: [
        recipe.name, recipe.brewerType, recipe.grindSize, recipe.coffeeGrams,
        recipe.waterGrams, recipe.waterTempC, recipe.bloomTimeSec,
        recipe.targetBrewTimeSec, JSON.stringify(recipe.steps),
        recipe.sourceRecipe, recipe.notes, now, now
      ]
    }));

    await db.batch(statements, "write");
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${toInsert.length}...`);
  }

  console.log(`\n✅ Seeded ${inserted} new recipes (skipped ${skipped} duplicates).`);

  // Also fix any existing recipes with zero times
  await updateExistingTimes(db);
  closeDb();
}

main().catch(err => {
  console.error("❌ Seed failed:", err);
  closeDb();
  process.exit(1);
});
