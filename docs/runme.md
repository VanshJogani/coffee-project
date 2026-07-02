python -m scrapers.run_all          # 1. Scrape (outputs CSVs to
  results/parsed/)
                                      #    ↳ also runs cleaner automatically
  → results/cleaned/

  python -m results.merger            # 2. Merge all cleaned CSVs →
  cleaned_coffee_products.json

  node clean_data.js                  # 3. (Optional) Polish origins/notes →
  cleaned_coffee_products_v2.json

  npm run seed                        # 4. Seed the SQLite database from the
  JSON

  In short:

  ┌────────────┬───────────────────┬───────────────────────────────────┐
  │    Step    │      Command      │           What it does            │
  ├────────────┼───────────────────┼───────────────────────────────────┤
  │ Scrape +   │ python -m         │ Runs all 67 scrapers in parallel, │
  │ Clean      │ scrapers.run_all  │  auto-cleans each CSV             │
  ├────────────┼───────────────────┼───────────────────────────────────┤
  │ Merge      │ python -m         │ Combines all cleaned CSVs into    │
  │            │ results.merger    │ one cleaned_coffee_products.json  │
  ├────────────┼───────────────────┼───────────────────────────────────┤
  │ Refine     │ node              │ Extra JS-based polishing of       │
  │ (optional) │ clean_data.js     │ origin/notes → _v2.json           │
  ├────────────┼───────────────────┼───────────────────────────────────┤
  │            │                   │ Drops & recreates SQLite tables,  │
  │ Seed DB    │ npm run seed      │ loads the JSON into               │
  │            │                   │ backend/coffee.db                 │
  └────────────┴───────────────────┴───────────────────────────────────┘

  After npm run seed, the backend serves the new data with populated origins
  and tasting notes. You can also run a single roaster to test first:

  python -m scrapers.run_all --only "Blue Tokai"