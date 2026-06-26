/**
 * Bulk-seeds ALL recipes from organized_recipes.json into the database.
 * Transforms the scraped format into the DB schema format.
 * Safe to re-run — skips recipes whose name already exists.
 *
 * Usage: node backend/seedAllRecipes.js
 */

const path = require("path");
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
 * Transform a single organized recipe to our DB format
 */
function transformRecipe(recipe) {
  const meta = recipe.metadata || {};

  const coffeeGrams = parseNum(meta.coffee_weight_g);
  const waterGrams = parseNum(meta.water_volume_ml);
  const waterTempC = parseNum(meta.temperature_c);
  const grindSize = normalizeGrindSize(meta.grind_size);

  const steps = transformSteps(recipe.steps);

  // Calculate total brew time from steps
  let targetBrewTimeSec = 0;
  for (const step of steps) {
    if (step.timeSec && step.timeSec > targetBrewTimeSec) {
      targetBrewTimeSec = step.timeSec;
    }
  }
  // If we didn't get a brew time from step timings, estimate from timer_seconds sum
  if (targetBrewTimeSec === 0 && recipe.steps) {
    targetBrewTimeSec = recipe.steps.reduce((sum, s) => sum + (s.timer_seconds || 0), 0);
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

async function main() {
  const db = getDb();
  await initSchema(db);
  await runMigrations(db);

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
  closeDb();
}

main().catch(err => {
  console.error("❌ Seed failed:", err);
  closeDb();
  process.exit(1);
});
