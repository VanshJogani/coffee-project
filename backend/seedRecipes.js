/**
 * Seeds built-in brew recipes into the database.
 * Safe to re-run — skips recipes that already exist by name + isBuiltIn.
 *
 * Usage: node backend/seedRecipes.js
 */

const path = require("path");
const { getDb, initSchema } = require("./src/db");

const BUILT_IN_RECIPES = [
  {
    name: "James Hoffman V60",
    brewerType: "V60",
    grindSize: "Medium-Fine",
    coffeeGrams: 30,
    waterGrams: 500,
    waterTempC: 94,
    bloomTimeSec: 45,
    targetBrewTimeSec: 210,
    notes: "The definitive V60 technique from James Hoffman. Creates a very clean, bright cup. Use a gooseneck kettle for precise pouring.",
    steps: [
      { timeSec: 0,   instruction: "Start timer. Pour 60g of water for bloom (2× coffee weight).", pourGrams: 60 },
      { timeSec: 45,  instruction: "Bloom complete. Pour to 300g in a slow, steady spiral from centre out.", pourGrams: 240 },
      { timeSec: 75,  instruction: "Pour remaining 200g in steady concentric circles.", pourGrams: 200 },
      { timeSec: 120, instruction: "All water added. Swirl the dripper gently once to level the bed.", pourGrams: 0 },
      { timeSec: 150, instruction: "Give the slurry a gentle stir with a spoon.", pourGrams: 0 },
      { timeSec: 210, instruction: "Drawdown complete. Remove dripper. Serve immediately.", pourGrams: 0 },
    ],
  },
  {
    name: "Tetsu Kasuya 4:6 Method",
    brewerType: "V60",
    grindSize: "Medium-Coarse",
    coffeeGrams: 20,
    waterGrams: 300,
    waterTempC: 93,
    bloomTimeSec: 0,
    targetBrewTimeSec: 210,
    notes: "World Brewers Cup winning technique. First 40% of water controls acidity/sweetness; last 60% controls strength. Coarser grind than most V60 recipes.",
    steps: [
      { timeSec: 0,   instruction: "Pour 50g (1st of 5 pours). Controls sweetness — pour faster for more sweetness.", pourGrams: 50 },
      { timeSec: 45,  instruction: "Pour 70g (2nd pour). Controls acidity — pour slower for less acidity.", pourGrams: 70 },
      { timeSec: 90,  instruction: "Pour 60g (3rd pour). Begins the strength phase.", pourGrams: 60 },
      { timeSec: 135, instruction: "Pour 60g (4th pour). Increases body — add more pours here for stronger brew.", pourGrams: 60 },
      { timeSec: 180, instruction: "Pour final 60g (5th pour). Wait for full drawdown.", pourGrams: 60 },
    ],
  },
  {
    name: "AeroPress Inverted",
    brewerType: "AeroPress",
    grindSize: "Medium-Fine",
    coffeeGrams: 15,
    waterGrams: 200,
    waterTempC: 85,
    bloomTimeSec: 30,
    targetBrewTimeSec: 120,
    notes: "Inverted method gives full immersion and more control over brew time. Use off-boil water (85–90°C) for best results.",
    steps: [
      { timeSec: 0,  instruction: "Invert AeroPress. Add 15g of medium-fine ground coffee.", pourGrams: 0 },
      { timeSec: 5,  instruction: "Pour 40g water. Stir 3 times. Bloom for 30 seconds.", pourGrams: 40 },
      { timeSec: 35, instruction: "Pour remaining 160g water steadily. Stir once.", pourGrams: 160 },
      { timeSec: 60, instruction: "Attach filter cap (pre-wetted). Carefully flip onto your cup. Press slowly over 20–30 seconds.", pourGrams: 0 },
    ],
  },
  {
    name: "French Press Classic",
    brewerType: "French Press",
    grindSize: "Coarse",
    coffeeGrams: 30,
    waterGrams: 500,
    waterTempC: 93,
    bloomTimeSec: 30,
    targetBrewTimeSec: 270,
    notes: "A full-immersion brew that produces a rich, full-bodied cup. Use a coarse grind to avoid sediment in the cup.",
    steps: [
      { timeSec: 0,   instruction: "Add 30g coarse ground coffee to French Press. Pour 60g water to bloom.", pourGrams: 60 },
      { timeSec: 30,  instruction: "Pour remaining 440g water. Place lid on top (plunger up). Do not press.", pourGrams: 440 },
      { timeSec: 60,  instruction: "Give the crust a single stir to break it. Re-seat lid.", pourGrams: 0 },
      { timeSec: 270, instruction: "Press the plunger slowly and steadily. Pour all coffee immediately to stop extraction.", pourGrams: 0 },
    ],
  },
  {
    name: "Moka Pot Stovetop",
    brewerType: "Moka Pot",
    grindSize: "Medium-Fine",
    coffeeGrams: 18,
    waterGrams: 90,
    waterTempC: 100,
    bloomTimeSec: 0,
    targetBrewTimeSec: 300,
    notes: "Use pre-heated water in the bottom chamber to reduce the time on heat and avoid burnt flavours. Medium heat throughout.",
    steps: [
      { timeSec: 0,   instruction: "Fill bottom chamber with pre-boiled water up to the safety valve line.", pourGrams: 90 },
      { timeSec: 10,  instruction: "Fill the filter basket with 18g medium-fine coffee. Level the bed — do not tamp.", pourGrams: 0 },
      { timeSec: 20,  instruction: "Assemble and place on stove over medium heat. Keep lid open to monitor.", pourGrams: 0 },
      { timeSec: 240, instruction: "As soon as coffee begins to flow (light brown), reduce to lowest heat.", pourGrams: 0 },
      { timeSec: 285, instruction: "Listen for a gurgling sound — remove from heat immediately. Coffee is done.", pourGrams: 0 },
    ],
  },
];

async function main() {
  const db = getDb();
  initSchema(db);

  const now = new Date().toISOString();
  let seeded = 0;
  let skipped = 0;

  await new Promise((resolve) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      let pending = BUILT_IN_RECIPES.length;
      const done = () => { if (--pending === 0) resolve(); };

      BUILT_IN_RECIPES.forEach((recipe) => {
        db.get(
          "SELECT id FROM recipes WHERE name = ? AND isBuiltIn = 1",
          [recipe.name],
          (err, existing) => {
            if (err) { console.error(err); done(); return; }
            if (existing) { skipped++; done(); return; }

            db.run(
              `INSERT INTO recipes
               (name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
                bloomTimeSec, targetBrewTimeSec, steps, isBuiltIn, notes, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
              [
                recipe.name, recipe.brewerType, recipe.grindSize, recipe.coffeeGrams,
                recipe.waterGrams, recipe.waterTempC, recipe.bloomTimeSec,
                recipe.targetBrewTimeSec, JSON.stringify(recipe.steps), recipe.notes, now, now,
              ],
              (insertErr) => {
                if (insertErr) console.error("Insert error:", insertErr);
                else seeded++;
                done();
              }
            );
          }
        );
      });
    });
  });

  await new Promise((resolve) => {
    db.run("COMMIT", () => {
      console.log(`✅ Built-in recipes: ${seeded} seeded, ${skipped} already existed.`);
      process.exit(0);
    });
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
