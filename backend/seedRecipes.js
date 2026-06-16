/**
 * Seeds built-in brew recipes into the database.
 * Safe to re-run — deletes existing built-ins and re-seeds.
 *
 * Usage: node backend/seedRecipes.js
 */

const { getDb, initSchema, runMigrations } = require("./src/db");

const BUILT_IN_RECIPES = [
  // -- Original 6 -------------------------------------------------------------
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
      { phase: "brew", timeSec: 0,   instruction: "Start timer. Pour 60g of water for bloom (2× coffee weight).", pourGrams: 60 },
      { phase: "brew", timeSec: 45,  instruction: "Bloom complete. Pour to 300g in a slow, steady spiral from centre out.", pourGrams: 240 },
      { phase: "brew", timeSec: 75,  instruction: "Pour remaining 200g in steady concentric circles.", pourGrams: 200 },
      { phase: "brew", timeSec: 120, instruction: "All water added. Swirl the dripper gently once to level the bed.", pourGrams: 0 },
      { phase: "brew", timeSec: 150, instruction: "Give the slurry a gentle stir with a spoon.", pourGrams: 0 },
      { phase: "brew", timeSec: 210, instruction: "Drawdown complete. Remove dripper. Serve immediately.", pourGrams: 0 },
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
      { phase: "brew", timeSec: 0,   instruction: "Pour 50g (1st of 5 pours). Controls sweetness — pour faster for more sweetness.", pourGrams: 50 },
      { phase: "brew", timeSec: 45,  instruction: "Pour 70g (2nd pour). Controls acidity — pour slower for less acidity.", pourGrams: 70 },
      { phase: "brew", timeSec: 90,  instruction: "Pour 60g (3rd pour). Begins the strength phase.", pourGrams: 60 },
      { phase: "brew", timeSec: 135, instruction: "Pour 60g (4th pour). Increases body — add more pours here for stronger brew.", pourGrams: 60 },
      { phase: "brew", timeSec: 180, instruction: "Pour final 60g (5th pour). Wait for full drawdown.", pourGrams: 60 },
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
      { phase: "prep", instruction: "Invert AeroPress. Add 15g of medium-fine ground coffee." },
      { phase: "brew", timeSec: 0,  instruction: "Pour 40g water. Stir 3 times. Bloom for 30 seconds.", pourGrams: 40 },
      { phase: "brew", timeSec: 30, instruction: "Pour remaining 160g water steadily. Stir once.", pourGrams: 160 },
      { phase: "brew", timeSec: 55, instruction: "Attach filter cap (pre-wetted). Carefully flip onto your cup. Press slowly over 20–30 seconds.", pourGrams: 0 },
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
      { phase: "prep", instruction: "Add 30g coarse ground coffee to French Press." },
      { phase: "brew", timeSec: 0,   instruction: "Pour 60g water to bloom. Saturate all grounds.", pourGrams: 60 },
      { phase: "brew", timeSec: 30,  instruction: "Pour remaining 440g water. Place lid on top (plunger up). Do not press.", pourGrams: 440 },
      { phase: "brew", timeSec: 60,  instruction: "Give the crust a single stir to break it. Re-seat lid.", pourGrams: 0 },
      { phase: "brew", timeSec: 270, instruction: "Press the plunger slowly and steadily. Pour all coffee immediately to stop extraction.", pourGrams: 0 },
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
      { phase: "prep", instruction: "Fill bottom chamber with pre-boiled water up to the safety valve line (90g)." },
      { phase: "prep", instruction: "Fill the filter basket with 18g medium-fine coffee. Level the bed — do not tamp." },
      { phase: "brew", timeSec: 0,   instruction: "Assemble and place on stove over medium heat. Keep lid open to monitor.", pourGrams: 0 },
      { phase: "brew", timeSec: 220, instruction: "As soon as coffee begins to flow (light brown), reduce to lowest heat.", pourGrams: 0 },
      { phase: "brew", timeSec: 265, instruction: "Listen for a gurgling sound — remove from heat immediately. Coffee is done.", pourGrams: 0 },
    ],
  },
  {
    name: "Chemex Classic",
    brewerType: "Chemex",
    grindSize: "Medium-Coarse",
    coffeeGrams: 42,
    waterGrams: 700,
    waterTempC: 94,
    bloomTimeSec: 45,
    targetBrewTimeSec: 300,
    notes: "The Chemex produces a very clean, bright cup due to the thick paper filter. Grind coarser than V60 to account for the slower flow rate.",
    steps: [
      { phase: "brew", timeSec: 0,   instruction: "Pour 80g water for bloom. Ensure all grounds are saturated.", pourGrams: 80 },
      { phase: "brew", timeSec: 45,  instruction: "Pour to 350g in slow concentric circles, keeping water level steady.", pourGrams: 270 },
      { phase: "brew", timeSec: 120, instruction: "Pour to 530g as the water level drops.", pourGrams: 180 },
      { phase: "brew", timeSec: 200, instruction: "Pour remaining 170g to reach 700g total.", pourGrams: 170 },
      { phase: "brew", timeSec: 300, instruction: "Drawdown complete. Remove filter. Swirl Chemex and serve.", pourGrams: 0 },
    ],
  },
  // -- 10 AeroPress from organized_recipes.json --------------------------------
  {
    name: "James Hoffmann's Ultimate AeroPress",
    brewerType: "AeroPress",
    grindSize: "Medium-Fine",
    coffeeGrams: 11,
    waterGrams: 200,
    waterTempC: 99,
    bloomTimeSec: 0,
    targetBrewTimeSec: 230,
    notes: "Standard (non-inverted) position. No need to rinse or preheat. Swirl instead of stir. For medium roast try 90–95°C; for dark roast 85–90°C.",
    steps: [
      { phase: "prep", instruction: "Set AeroPress in standard position on a server. Add 11g coffee." },
      { phase: "brew", timeSec: 0,   instruction: "Start timer. Add 200g of 99°C water, aiming to wet all grounds.", pourGrams: 200 },
      { phase: "brew", timeSec: 5,   instruction: "Place plunger about 1cm in — creates a vacuum to stop dripping.", pourGrams: 0 },
      { phase: "brew", timeSec: 120, instruction: "Wait until 2:00.", pourGrams: 0 },
      { phase: "brew", timeSec: 140, instruction: "Holding both brewer and plunger, gently swirl.", pourGrams: 0 },
      { phase: "brew", timeSec: 170, instruction: "Wait 30 more seconds.", pourGrams: 0 },
      { phase: "brew", timeSec: 200, instruction: "Press gently all the way — takes about 30 seconds. Stop at the hiss.", pourGrams: 0 },
    ],
  },
  {
    name: "13g That Makes You Happy",
    brewerType: "AeroPress",
    grindSize: "Coarse",
    coffeeGrams: 13,
    waterGrams: 180,
    waterTempC: 90,
    bloomTimeSec: 30,
    targetBrewTimeSec: 150,
    notes: "Works for almost any process. Produces a balanced, sweet and clean cup. If you want more extraction, add 5 extra stirs at step 3 or extend bloom by 10 seconds.",
    steps: [
      { phase: "prep", instruction: "Prep AeroPress in inverted position. Add 13g coarsely ground coffee." },
      { phase: "brew", timeSec: 0,  instruction: "Bloom: add 30g water, stir 5 times. Wait until 0:30.", pourGrams: 30 },
      { phase: "brew", timeSec: 30, instruction: "Pour remaining 150g water, stir 5 times.", pourGrams: 150 },
      { phase: "brew", timeSec: 90, instruction: "Flip AeroPress carefully onto your cup.", pourGrams: 0 },
      { phase: "brew", timeSec: 90, instruction: "Press slowly over 60 seconds. Finish at around 2:30.", pourGrams: 0 },
    ],
  },
  {
    name: "Tim Wendelboe AeroPress",
    brewerType: "AeroPress",
    grindSize: "Medium-Fine",
    coffeeGrams: 14,
    waterGrams: 200,
    waterTempC: 96,
    bloomTimeSec: 0,
    targetBrewTimeSec: 180,
    notes: "Clean and bright recipe from Tim Wendelboe (Oslo). Steep then stir twice — once before, once after the steep.",
    steps: [
      { phase: "prep", instruction: "Rinse paper filter. Add 14g of fine filter ground coffee." },
      { phase: "brew", timeSec: 0,   instruction: "Pour 200g of 96°C water over the grounds.", pourGrams: 200 },
      { phase: "brew", timeSec: 10,  instruction: "Stir 3 times back to front. Place handle on to stop dripping.", pourGrams: 0 },
      { phase: "brew", timeSec: 70,  instruction: "After 60 second steep, remove handle and stir 3 times again.", pourGrams: 0 },
      { phase: "brew", timeSec: 80,  instruction: "Place handle back on AeroPress and press for 20–30 seconds.", pourGrams: 0 },
    ],
  },
  {
    name: "The Only AeroPress Recipe You'll Ever Need",
    brewerType: "AeroPress",
    grindSize: "Medium",
    coffeeGrams: 15,
    waterGrams: 225,
    waterTempC: 98,
    bloomTimeSec: 0,
    targetBrewTimeSec: 260,
    notes: "Double filter method for a very clean cup. Longer steep than most recipes gives excellent body and clarity. Great beginner recipe.",
    steps: [
      { phase: "prep", instruction: "Place two rinsed paper filters in the AeroPress cap. Add 15g medium ground coffee." },
      { phase: "brew", timeSec: 0,   instruction: "Start timer. Briskly add 225g of 98°C water. Place plunger in immediately.", pourGrams: 225 },
      { phase: "brew", timeSec: 60,  instruction: "At 1:00 — remove plunger, gently break the crust with a spoon. Replace plunger.", pourGrams: 0 },
      { phase: "brew", timeSec: 240, instruction: "At 4:00 — begin pressing slowly. Stop at the hiss.", pourGrams: 0 },
    ],
  },
  {
    name: "2015 World AeroPress Champion",
    brewerType: "AeroPress",
    grindSize: "Fine",
    coffeeGrams: 20,
    waterGrams: 260,
    waterTempC: 79,
    bloomTimeSec: 30,
    targetBrewTimeSec: 120,
    notes: "Championship recipe by Shuichi Sasaki (Japan). Low water temperature and fine grind. Turbulent agitation during bloom is key.",
    steps: [
      { phase: "prep", instruction: "Pre-wash filter. Preheat inverted AeroPress in 79°C water for 15 seconds." },
      { phase: "prep", instruction: "Add 20g coffee to inverted chamber." },
      { phase: "brew", timeSec: 0,  instruction: "Bloom phase: pour 60g of 79°C water within 5 seconds.", pourGrams: 60 },
      { phase: "brew", timeSec: 15, instruction: "Turbulent wiggle for 15 seconds, then let rest 10 seconds (total 30s bloom).", pourGrams: 0 },
      { phase: "brew", timeSec: 45, instruction: "Pour remaining 200g water to the top.", pourGrams: 200 },
      { phase: "brew", timeSec: 50, instruction: "Screw on filter cap, flip immediately and press for 45 seconds.", pourGrams: 0 },
    ],
  },
  {
    name: "2021 World AeroPress Champion",
    brewerType: "AeroPress",
    grindSize: "Medium-Fine",
    coffeeGrams: 18,
    waterGrams: 200,
    waterTempC: 80,
    bloomTimeSec: 0,
    targetBrewTimeSec: 150,
    notes: "Championship recipe. Very gentle agitation, low temperature, inverted method. Swirl and pour from altitude after pressing for aeration.",
    steps: [
      { phase: "brew", timeSec: 0,   instruction: "Inverted AeroPress. Start timer, add 50g water at 80°C.", pourGrams: 50 },
      { phase: "brew", timeSec: 10,  instruction: "Stir very gently 3 times back and forth.", pourGrams: 0 },
      { phase: "brew", timeSec: 15,  instruction: "Pour from 50g to 200g water at 80°C.", pourGrams: 150 },
      { phase: "brew", timeSec: 30,  instruction: "Allow to brew. At 0:50 stir very gently 3 more times.", pourGrams: 0 },
      { phase: "brew", timeSec: 60,  instruction: "Push excess air out, attach filter cap.", pourGrams: 0 },
      { phase: "brew", timeSec: 95,  instruction: "At 1:35 — put pitcher on, flip at 1:40. Press from 1:40 to 2:00.", pourGrams: 0 },
      { phase: "brew", timeSec: 120, instruction: "Swirl and pour from altitude into another pitcher. Serve.", pourGrams: 0 },
    ],
  },
  {
    name: "Tetsu Kasuya AeroPress",
    brewerType: "AeroPress",
    grindSize: "Coarse",
    coffeeGrams: 20,
    waterGrams: 300,
    waterTempC: 93,
    bloomTimeSec: 30,
    targetBrewTimeSec: 200,
    notes: "AeroPress adaptation of Tetsu Kasuya's technique. Pour slowly in pulses — produces an unusually smooth, full-bodied cup for AeroPress.",
    steps: [
      { phase: "prep", instruction: "Standard position. Add 20g coarsely ground coffee." },
      { phase: "brew", timeSec: 0,   instruction: "Pour 40g bloom water. Wait until 0:30.", pourGrams: 40 },
      { phase: "brew", timeSec: 30,  instruction: "Pour in gentle 40g pulses until all 300g is added by 3:00.", pourGrams: 260 },
      { phase: "brew", timeSec: 180, instruction: "All water added. Plunge slowly for 20 seconds. Stop at the hiss.", pourGrams: 0 },
    ],
  },
  {
    name: "2023 World AeroPress Champion",
    brewerType: "AeroPress",
    grindSize: "Medium-Fine",
    coffeeGrams: 18,
    waterGrams: 180,
    waterTempC: 89,
    bloomTimeSec: 0,
    targetBrewTimeSec: 145,
    notes: "Split-dose recipe — 16g in the chamber, 2g added mid-brew on top of the liquid. Bypass dilution gives precise strength control.",
    steps: [
      { phase: "brew", timeSec: 0,  instruction: "Put 16g coffee into inverted AeroPress. Pour 100g of 89°C water.", pourGrams: 100 },
      { phase: "brew", timeSec: 30, instruction: "Stir in a circular motion for 5 seconds.", pourGrams: 0 },
      { phase: "brew", timeSec: 45, instruction: "Add remaining 2g of coffee on top.", pourGrams: 0 },
      { phase: "brew", timeSec: 55, instruction: "Stir for another 5 seconds.", pourGrams: 0 },
      { phase: "brew", timeSec: 60, instruction: "Press plunger slightly to remove excess air, attach filter cap.", pourGrams: 0 },
      { phase: "brew", timeSec: 95, instruction: "Flip carefully. Press for 30 seconds. Target yield ~75ml.", pourGrams: 0 },
      { phase: "brew", timeSec: 125, instruction: "Bypass: add room-temp water to 115g, then hot water to 155g.", pourGrams: 0 },
    ],
  },
  {
    name: "Coffee with April",
    brewerType: "AeroPress",
    grindSize: "Medium-Fine",
    coffeeGrams: 13,
    waterGrams: 200,
    waterTempC: 88,
    bloomTimeSec: 30,
    targetBrewTimeSec: 120,
    notes: "Clean, minimalist recipe from April Coffee. Standard position with a brief bloom. Quick press gives a bright, sweet cup.",
    steps: [
      { phase: "prep", instruction: "Rinsed filter in cap, standard position. Add 13g coffee." },
      { phase: "brew", timeSec: 0,  instruction: "Pour 50g water quickly. Stir slightly. Place piston to stop dripping.", pourGrams: 50 },
      { phase: "brew", timeSec: 30, instruction: "Remove piston. Pour remaining 150g water.", pourGrams: 150 },
      { phase: "brew", timeSec: 30, instruction: "Place piston back. Let sit until 1:30.", pourGrams: 0 },
      { phase: "brew", timeSec: 90, instruction: "Press slowly to 2:00. Stop at the hiss.", pourGrams: 0 },
    ],
  },
  {
    name: "Blue Bottle AeroPress",
    brewerType: "AeroPress",
    grindSize: "Medium",
    coffeeGrams: 15,
    waterGrams: 200,
    waterTempC: 94,
    bloomTimeSec: 30,
    targetBrewTimeSec: 105,
    notes: "Blue Bottle Coffee's house AeroPress recipe. Inverted method, short bloom, one agitation stir. Clean and consistent.",
    steps: [
      { phase: "prep", instruction: "Invert AeroPress. Add 15g medium ground coffee." },
      { phase: "brew", timeSec: 0,  instruction: "Start timer. Add 30g of 94°C water.", pourGrams: 30 },
      { phase: "brew", timeSec: 30, instruction: "Add remaining 170g water.", pourGrams: 170 },
      { phase: "brew", timeSec: 60, instruction: "Stir 10 times to agitate.", pourGrams: 0 },
      { phase: "brew", timeSec: 75, instruction: "Place cap with rinsed filter. Invert onto cup and press. Finish by 1:45.", pourGrams: 0 },
    ],
  },
  // -- 4 Pourover recipes (for testing pour timer) ----------------------------
  {
    name: "Scott Rao V60 — 3 Pours",
    brewerType: "V60",
    grindSize: "Medium-Fine",
    coffeeGrams: 15,
    waterGrams: 250,
    waterTempC: 94,
    bloomTimeSec: 45,
    targetBrewTimeSec: 210,
    notes: "Scott Rao's technique: high agitation bloom, then two slow pours. Keeps the bed flat throughout. Great for light roasts.",
    steps: [
      { phase: "brew", timeSec: 0,   instruction: "Pour 30g bloom water in tight circles. Saturate all grounds completely.", pourGrams: 30 },
      { phase: "brew", timeSec: 45,  instruction: "Pour to 150g in a slow spiral from centre outward. Keep water level steady.", pourGrams: 120 },
      { phase: "brew", timeSec: 90,  instruction: "Pour to 250g as the water level drops. Aim to finish pouring by 1:45.", pourGrams: 100 },
      { phase: "brew", timeSec: 210, instruction: "Drawdown complete. Remove dripper. Swirl the server and serve.", pourGrams: 0 },
    ],
  },
  {
    name: "Origami 5-Pour V60",
    brewerType: "V60",
    grindSize: "Medium-Fine",
    coffeeGrams: 18,
    waterGrams: 300,
    waterTempC: 93,
    bloomTimeSec: 40,
    targetBrewTimeSec: 220,
    notes: "5-pour technique for maximum sweetness and clarity. Even pour intervals with a turbulent bloom. Works beautifully with Ethiopian and Kenyan light roasts.",
    steps: [
      { phase: "brew", timeSec: 0,   instruction: "Pour 36g bloom water — 2× coffee weight. Agitate gently to saturate all grounds.", pourGrams: 36 },
      { phase: "brew", timeSec: 40,  instruction: "Pour 1 of 4: add 64g water in steady concentric circles.", pourGrams: 64 },
      { phase: "brew", timeSec: 80,  instruction: "Pour 2 of 4: add 60g water as level drops.", pourGrams: 60 },
      { phase: "brew", timeSec: 120, instruction: "Pour 3 of 4: add 70g water, keep level from dropping too far.", pourGrams: 70 },
      { phase: "brew", timeSec: 160, instruction: "Final pour: add 70g water to reach 300g total.", pourGrams: 70 },
      { phase: "brew", timeSec: 220, instruction: "Drawdown complete. Remove dripper and serve.", pourGrams: 0 },
    ],
  },
  {
    name: "Kalita Wave 4-Pour",
    brewerType: "Kalita",
    grindSize: "Medium",
    coffeeGrams: 20,
    waterGrams: 300,
    waterTempC: 94,
    bloomTimeSec: 45,
    targetBrewTimeSec: 240,
    notes: "The flat-bed Kalita Wave brews very evenly. Pour in the centre — no need to spiral. Consistent intervals produce a balanced, sweet cup.",
    steps: [
      { phase: "brew", timeSec: 0,   instruction: "Pour 40g bloom water into the centre. Saturate all grounds. Wait.", pourGrams: 40 },
      { phase: "brew", timeSec: 45,  instruction: "Pour 80g water steadily into the centre. Keep it slow.", pourGrams: 80 },
      { phase: "brew", timeSec: 90,  instruction: "Pour 80g water as the level drops.", pourGrams: 80 },
      { phase: "brew", timeSec: 140, instruction: "Pour final 100g water. Finish pouring by 2:30.", pourGrams: 100 },
      { phase: "brew", timeSec: 240, instruction: "Drawdown complete. Remove wave filter and serve.", pourGrams: 0 },
    ],
  },
  {
    name: "Chemex 4-Pour Technique",
    brewerType: "Chemex",
    grindSize: "Medium-Coarse",
    coffeeGrams: 30,
    waterGrams: 500,
    waterTempC: 94,
    bloomTimeSec: 45,
    targetBrewTimeSec: 270,
    notes: "A four-pour approach to the Chemex that gives more control than a continuous pour. The thick filters slow drawdown — slightly coarser grind helps balance.",
    steps: [
      { phase: "prep", instruction: "Rinse the Chemex filter thoroughly. Add 30g coffee." },
      { phase: "brew", timeSec: 0,   instruction: "Bloom: pour 60g water in a spiral. All grounds must be wet.", pourGrams: 60 },
      { phase: "brew", timeSec: 45,  instruction: "Pour 150g water in slow concentric circles.", pourGrams: 150 },
      { phase: "brew", timeSec: 110, instruction: "Pour 150g water as the level drops.", pourGrams: 150 },
      { phase: "brew", timeSec: 175, instruction: "Final pour: add 140g water to reach 500g total.", pourGrams: 140 },
      { phase: "brew", timeSec: 270, instruction: "Drawdown complete — about 4:30 total. Remove filter and serve.", pourGrams: 0 },
    ],
  },
];

async function main() {
  const db = getDb();
  await initSchema(db);
  await runMigrations(db);

  const now = new Date().toISOString();
  let seeded = 0;

  // Delete existing built-ins so we can re-seed with updated step phases
  await db.execute("DELETE FROM recipes WHERE isBuiltIn = 1");

  // Batch insert all built-in recipes
  const statements = BUILT_IN_RECIPES.map(recipe => ({
    sql: `INSERT INTO recipes
     (name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC,
      bloomTimeSec, targetBrewTimeSec, steps, isBuiltIn, sourceRecipe, notes,
      isPublic, authorName, authorSetup, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, 0, NULL, NULL, ?, ?)`,
    args: [
      recipe.name, recipe.brewerType, recipe.grindSize, recipe.coffeeGrams,
      recipe.waterGrams, recipe.waterTempC, recipe.bloomTimeSec,
      recipe.targetBrewTimeSec, JSON.stringify(recipe.steps),
      recipe.notes, now, now
    ]
  }));

  await db.batch(statements, "write");
  seeded = BUILT_IN_RECIPES.length;

  console.log(`✅ Built-in recipes: ${seeded} seeded (re-seeded with prep/brew phases).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
