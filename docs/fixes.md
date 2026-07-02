# Bug Audit Report — Coffee Project

**Date:** 2026-06-22  
**Auditor:** Claude (automated senior engineer audit)  
**Scope:** Full codebase — backend, frontend, infrastructure/config  

---

## Architecture Overview

```
coffee-project/
├── backend/          Express.js API + @libsql/client (Turso)
│   ├── src/
│   │   ├── app.js         Entry point, middleware, schema init
│   │   ├── server.js      HTTP server + graceful shutdown
│   │   ├── db.js          Singleton DB connection (libSQL)
│   │   ├── validation.js  Rating validator
│   │   ├── routes/        REST endpoints (products, reviews, roasters, recipes, inventory, brewLogs, posts, processes, brewNotes)
│   │   └── utils/         Origin/process normalizers
│   ├── seed.js            DB seeder (products)
│   └── seedRecipes.js     DB seeder (recipes)
├── frontend/         React + Vite + TailwindCSS (PWA)
│   ├── src/
│   │   ├── App.jsx        Router shell
│   │   ├── api/client.js  Axios wrapper
│   │   ├── hooks/         useProducts, useFilters, useProductDetail, useInlineSvg
│   │   ├── components/    UI components (cards, modals, maps, filters)
│   │   └── pages/         ExplorePage, BrewPage, LandingPage, IndiaMapPage
│   └── public/sw.js       Service worker (PWA caching)
├── docker-compose.yml
├── render.yaml            Render.com deployment config
└── clean_data.js          Data cleaning utility
```

**Data flow:** Frontend → Axios client → Backend Express API → Turso/libSQL DB

---

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 10    |
| Medium   | 17    |
| Low      | 12    |
| **Total**| **42**|

---

## CRITICAL (3)

### C1. Test suite completely broken — wrong API and wrong import

**File:** `backend/tests/products.test.js:3,9-33,37`  
**Description:** The test imports `app` as `require("../src/app")` which returns `{ app, dbReady }`, not the Express app directly. It also calls `db.run()` (callback-style SQLite3 API) but the project uses `@libsql/client` which is promise-based (`db.execute()`).  
**Trigger:** `npm test` always fails. `db.run` is `undefined`, `request(app)` receives an object not an Express app.  
**Suggested fix:**  
```js
const { app, dbReady } = require("../src/app");
// In beforeAll: await dbReady;
// Replace db.run(...) with await db.execute({ sql, args: [...] })
```

---

### C2. Database schema race condition on direct import

**File:** `backend/src/app.js:20-26,59-67`  
**Description:** Routes are registered immediately, but `dbReady` (schema init promise) may not have resolved. `server.js` mitigates this with `dbReady.then(() => app.listen(...))`, but any direct import of `app.js` (tests, other tooling) can hit routes before schema exists.  
**Trigger:** Test sends request before `dbReady` resolves → queries fail against non-existent tables.  
**Suggested fix:** Add guard middleware:
```js
app.use(async (req, res, next) => {
  await dbReady;
  next();
});
```

---

### C3. CORS defaults to wildcard with credentials in production

**File:** `backend/src/app.js:33-38` + `render.yaml:17`  
**Description:** When `CORS_ORIGIN` env var is unset (which is the default — `render.yaml` marks it `sync: false`), the code sets `origin: true` which reflects any requesting origin. Combined with `credentials: true`, this allows any website to make authenticated cross-origin requests.  
**Trigger:** Deploy to Render without manually setting `CORS_ORIGIN` → any malicious site can make credentialed requests.  
**Suggested fix:** Fail hard in production if `CORS_ORIGIN` is not set:
```js
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN must be set in production');
}
```

---

## HIGH (10)

### H1. Dockerfile.backend installs wrong package.json

**File:** `Dockerfile.backend:5-8`  
**Description:** `COPY package.json` copies the **root** `package.json` (which has `csv-parse` and workspace config), not `backend/package.json`. The backend's actual dependencies (express, cors, helmet, @libsql/client) are never installed.  
**Trigger:** `docker-compose build` → container starts → `MODULE_NOT_FOUND` crash.  
**Suggested fix:**
```dockerfile
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev
COPY backend/ .
```

---

### H2. Dockerfile.frontend strips devDeps before `vite build`

**File:** `Dockerfile.frontend:7,11`  
**Description:** `npm install --omit=dev` skips devDependencies. Then `npm run build` invokes `vite build` — but `vite` is in devDependencies.  
**Trigger:** `docker-compose build` → "vite: not found" error.  
**Suggested fix:** Use multi-stage build: install all deps in build stage, copy only `dist/` to serve stage.

---

### H3. Render cron job requires paid plan

**File:** `render.yaml:20-32`  
**Description:** The `coffee-scraper` cron service uses `plan: free`, but Render's free tier does not support cron jobs (requires Starter plan).  
**Trigger:** Deploy → cron service fails to create or never executes.  
**Suggested fix:** Change to `plan: starter` or move scraping to GitHub Actions cron.

---

### H4. SQL LIKE wildcard injection in product search

**File:** `backend/src/routes/products.js:199,214-219`  
**Description:** User-supplied `search` and `flavour` are embedded in LIKE patterns (`%${search}%`) without escaping `%` and `_` wildcards. While parameterized queries prevent SQL injection, users can manipulate LIKE semantics to bypass filters.  
**Trigger:** `?search=%25` matches everything; `?search=___` probes name lengths.  
**Suggested fix:**
```js
const escaped = search.replace(/[%_]/g, '\\$&');
// SQL: ... LIKE '%' || ? || '%' ESCAPE '\'
```

---

### H5. Graceful shutdown never closes HTTP server

**File:** `backend/src/server.js:19-23`  
**Description:** SIGTERM handler calls `closeDb()` then `process.exit()` but never calls `server.close()`. In-flight requests are killed without draining. SIGINT (Ctrl+C) is not handled.  
**Trigger:** Container orchestrator sends SIGTERM → active requests receive abrupt RST.  
**Suggested fix:**
```js
const server = app.listen(PORT, ...);
process.on('SIGTERM', () => {
  server.close(() => { closeDb(); process.exit(0); });
});
process.on('SIGINT', () => { /* same */ });
```

---

### H6. Price filter includes NULL-priced products

**File:** `backend/src/routes/products.js:204-211`  
**Description:** WHERE clause uses `(p.price IS NULL OR p.price >= ?)`. Products with no price pass all price filters, appearing in results regardless of user's selection.  
**Trigger:** `?priceMin=500&priceMax=1000` → products with `NULL` price shown.  
**Suggested fix:** Remove the `IS NULL` fallback: `p.price >= ?` (or add an explicit "include unpriced" toggle).

---

### H7. Roaster POST accepts whitespace-only names; PUT can null out all fields

**File:** `backend/src/routes/roasters.js:177-212,217-249`  
**Description:**  
- POST: checks `if (!name)` but doesn't trim → `"   "` passes (truthy whitespace string)  
- PUT: uses `field !== undefined ? field : null` → any omitted field becomes `null`, erasing existing data  
**Trigger:** POST `{ name: "  " }` → whitespace roaster. PUT `{ name: "Updated" }` → websiteUrl/description/year nulled.  
**Suggested fix:** Trim+validate in POST. In PUT, preserve existing values for omitted fields.

---

### H8. Brew log PUT silently drops recipeId and beanInventoryId updates

**File:** `backend/src/routes/brewLogs.js:85-107`  
**Description:** UPDATE statement includes 10 fields but omits `recipeId` and `beanInventoryId`. Changes to these fields are silently ignored.  
**Trigger:** User tries to reassign a brew log to a different recipe → nothing happens.  
**Suggested fix:** Add `recipeId = ?, beanInventoryId = ?` to the UPDATE SET clause.

---

### H9. CardCarousel crashes when product list shrinks

**File:** `frontend/src/components/CardCarousel.jsx:4-16`  
**Description:** `index` state persists across product array changes. If the user is at index 15 and filters reduce results to 3 items, `products[15]` is `undefined` → crash on property access.  
**Trigger:** Apply restrictive filter while viewing a card at a high index.  
**Suggested fix:**
```jsx
useEffect(() => {
  if (index >= products.length) setIndex(Math.max(0, products.length - 1));
}, [products.length]);
```

---

### H10. ProductDetailModal backdrop click doesn't close modal (desktop)

**File:** `frontend/src/components/ProductDetailModal.jsx:48,242`  
**Description:** The backdrop div has `-z-10` (behind everything), so clicks on the dark overlay area hit the parent div which has no `onClick`. The modal card uses `e.stopPropagation()`, preventing bubble. Result: clicking outside the card on desktop does nothing.  
**Trigger:** User clicks dark area around modal → no dismiss.  
**Suggested fix:** Move `onClick={onClose}` to the parent overlay div, with `stopPropagation` on the modal content.

---

## MEDIUM (17)

### M1. `|| null` coercion destroys valid zero values (3 routes)

**Files:**  
- `backend/src/routes/brewLogs.js:68-69`  
- `backend/src/routes/recipes.js:60-67`  
- `backend/src/routes/roasters.js:191,313`  

**Description:** Pattern `value || null` converts `0` to `null`. Affects: coffeeGrams, waterGrams, waterTempC, brewTimeSec, rating, bloomTimeSec, targetBrewTimeSec, establishedYear, latitude, longitude.  
**Trigger:** POST with `coffeeGrams: 0` or `latitude: 0` (equator) stores NULL.  
**Suggested fix:** Replace `|| null` with `?? null` (nullish coalescing).

---

### M2. Race condition: brew log inventory deduction not atomic

**File:** `backend/src/routes/brewLogs.js:64-78`  
**Description:** INSERT into `brew_logs` and UPDATE to `bean_inventory.gramsRemaining` are separate operations with no transaction. Crash between them or concurrent requests can double-deduct or skip deduction.  
**Trigger:** Two simultaneous brew log POSTs for the same bean.  
**Suggested fix:** Wrap in `db.batch()` or transaction.

---

### M3. `JSON.parse` crashes on malformed stored data

**Files:**  
- `backend/src/routes/recipes.js:7`  
- `backend/src/routes/posts.js:25`  

**Description:** `JSON.parse(row.steps)` / `JSON.parse(recipe_steps)` throw on invalid JSON, crashing the entire GET response.  
**Trigger:** Corrupted row from bad migration or manual edit.  
**Suggested fix:** `try { JSON.parse(x) } catch { return [] }`

---

### M4. Posts endpoint has no pagination

**File:** `backend/src/routes/posts.js:54-59`  
**Description:** GET /api/posts returns ALL posts with no LIMIT. Will degrade as data grows.  
**Trigger:** Thousands of posts → multi-MB response, slow page load.  
**Suggested fix:** Add `page`/`limit` query params with defaults.

---

### M5. Docker frontend: vite preview has no API proxy

**File:** `docker-compose.yml:20-21`  
**Description:** In Docker, `vite preview` serves static files but does NOT run the dev proxy from `vite.config.js`. API calls to `/api` will 404.  
**Trigger:** `docker-compose up` → frontend loads but all API calls fail.  
**Suggested fix:** Use nginx with proxy config, or set `VITE_API_URL` as build-time env var.

---

### M6. manifest.json references non-existent icons

**File:** `frontend/public/manifest.json:11-21`  
**Description:** References `/icons/icon-192.svg` and `/icons/icon-512.svg` but no `icons/` directory exists in `public/`.  
**Trigger:** PWA install → broken/generic app icon.  
**Suggested fix:** Create the SVG icon files or update paths to existing assets.

---

### M7. `dotenv.config()` path resolution breaks in test environments

**File:** `backend/src/app.js:17` + `backend/src/server.js:2`  
**Description:** `dotenv.config()` resolves relative to CWD, not to the file. Tests run from monorepo root won't find `backend/.env`.  
**Trigger:** `cd coffee-project && npm test` → env vars missing → DB connection fails.  
**Suggested fix:** `dotenv.config({ path: path.join(__dirname, '..', '.env') })`

---

### M8. SwipeView touch event access without null check

**File:** `frontend/src/components/SwipeView.jsx:55-74`  
**Description:** `e.touches[0].clientX` accessed without checking if `touches[0]` exists. On fast gestures, `touches` array can be empty mid-move.  
**Trigger:** Rapid touch interaction → `Cannot read properties of undefined`.  
**Suggested fix:** `e.touches?.[0]?.clientX ?? 0`

---

### M9. useFilters `clearFilters` uses stale price range during category switch

**File:** `frontend/src/hooks/useFilters.js:50-56`  
**Description:** `clearFilters` resets price to current `options` state, which may still be the old category's values if the fetch hasn't returned yet.  
**Trigger:** Change category → immediately click Reset → old price range applied.  
**Suggested fix:** Disable reset during loading, or use fetched values directly.

---

### M10. BrewNowPage recipe effect can reset active brew session

**File:** `frontend/src/pages/brew/BrewNowPage.jsx:353-367`  
**Description:** Effect depends on `[selectedRecipeId, recipes]`. If `recipes` re-sets from any cause while a brew is in progress, the effect dispatches RESET and sets `brewPhase: "setup"`.  
**Trigger:** HMR or parent re-render causes recipes reload → active brew silently reset.  
**Suggested fix:** Guard: `if (brewPhase !== "setup") return;`

---

### M11. ExplorePage `atlasOrigin` not updated on URL change after mount

**File:** `frontend/src/pages/ExplorePage.jsx:43-47`  
**Description:** `useEffect(() => { if (urlOrigin) setAtlasOrigin(urlOrigin); }, [])` — empty deps means URL changes after initial mount are ignored.  
**Trigger:** Navigate back from map with different origin param → stale region banner.  
**Suggested fix:** `[urlOrigin]` in deps array.

---

### M12. CoffeeRandomizer gives no feedback on empty pool

**File:** `frontend/src/components/CoffeeRandomizer.jsx:33-67`  
**Description:** If filtered random pool is empty, the modal silently closes with no selection or message.  
**Trigger:** Use randomizer with very restrictive criteria → nothing happens.  
**Suggested fix:** Show inline message: "No coffees match your criteria."

---

### M13. RegionPopover `onClose` in deps causes listener flicker

**File:** `frontend/src/components/RegionPopover.jsx:11-25`  
**Description:** If `onClose` is an inline arrow function (new ref every render), the effect re-runs every render: removing/re-adding click listener with a 50ms gap.  
**Trigger:** Frequent parent re-renders (map pan/zoom) → dismiss handler intermittently missing.  
**Suggested fix:** `useRef` for onClose, or `useCallback` at the parent.

---

### M14. MobileFilterSheet dismiss triggers during content scroll

**File:** `frontend/src/components/MobileFilterSheet.jsx:20-38`  
**Description:** Swipe-down dismiss fires globally on the sheet div. Scrolling down in the filter list can trigger unintended dismiss if gesture exceeds 120px.  
**Trigger:** Scroll filter list downward 120px → sheet closes.  
**Suggested fix:** Only enable dismiss when `scrollRef.scrollTop === 0`.

---

### M15. useProducts provides no loading indicator for subsequent fetches

**File:** `frontend/src/hooks/useProducts.js:11,70-75`  
**Description:** `initialLoading` becomes `false` after first load and never re-activates. Page/filter changes have no visible loading state.  
**Trigger:** Change page or filters → no skeleton/spinner feedback.  
**Suggested fix:** Add a separate `fetching` state toggled on every request.

---

### M16. Frontend test always fails — wrong assertion text

**File:** `frontend/src/App.test.jsx:8-11`  
**Description:** Test asserts `Coffee Explorer` but app title is "Caffe Elegante".  
**Trigger:** `npm test` → assertion failure.  
**Suggested fix:** Update assertion to match actual rendered content.

---

### M17. Docker volume mount path mismatch for SQLite

**File:** `docker-compose.yml:13`  
**Description:** Mounts `./backend/coffee.db:/app/backend/coffee.db` but WORKDIR is `/app` and CMD is `node src/server.js`. If code uses a relative path like `./coffee.db`, it resolves to `/app/coffee.db`, not `/app/backend/coffee.db`. (If using Turso in production, mount is dead weight.)  
**Trigger:** Local Docker dev without Turso creds → DB file not found at expected path.  
**Suggested fix:** Verify DB file path in code matches mount point, or remove if Turso-only.

---

## LOW (12)

### L1. `validateRating` silently rounds non-integer ratings

**File:** `backend/src/validation.js:6-11`  
**Trigger:** `rating: 2.7` → stored as 3.  
**Fix:** Reject non-integers with `Number.isInteger()` check.

---

### L2. `getProcessHierarchy` can infinite-loop on circular parent references

**File:** `backend/src/utils/processNormalizer.js:244-259`  
**Trigger:** Only if taxonomy data has circular refs (currently safe).  
**Fix:** Add visited-node `Set` for cycle detection.

---

### L3. Post title/body not length-limited

**File:** `backend/src/routes/posts.js:67,80-83`  
**Trigger:** POST with huge title/body (mitigated by Express 100KB body limit).  
**Fix:** `.slice(0, 200)` for title, `.slice(0, 10000)` for body.

---

### L4. parseInt produces NaN for non-numeric query params

**File:** `backend/src/routes/brewLogs.js:15`  
**Trigger:** `?productId=abc` → useless DB query with NaN.  
**Fix:** Validate parseInt result; return 400 if NaN.

---

### L5. Inventory allows negative gramsRemaining

**File:** `backend/src/routes/inventory.js:83`  
**Trigger:** PUT with `gramsRemaining: -50` accepted.  
**Fix:** Validate `>= 0`.

---

### L6. seedRecipes.js never closes DB connection

**File:** `backend/seedRecipes.js:382-417`  
**Trigger:** Process may hang after seeding.  
**Fix:** Call `closeDb()` at end.

---

### L7. Likes endpoint allows unlimited likes per client

**File:** `backend/src/routes/posts.js:101-111`  
**Trigger:** Script spams like endpoint to inflate counts.  
**Fix:** Track by IP/session once auth exists.

---

### L8. `normalizeOrigin` drops unknown origins

**File:** `backend/src/utils/originNormalizer.js:174`  
**Trigger:** Products with origins not in lookup map (e.g., "El Salvador") invisible in filter UI.  
**Fix:** Return trimmed/title-cased input as fallback instead of `null`.

---

### L9. `express.json()` has no explicit size limit / no rate limiting

**File:** `backend/src/app.js:31`  
**Trigger:** Rapid 100KB payloads for DoS (partially mitigated by Express default 100KB limit).  
**Fix:** `express.json({ limit: '50kb' })` + rate limiting middleware.

---

### L10. Console.log statements in production API client

**File:** `frontend/src/api/client.js:5,13,20`  
**Trigger:** API structure leaked to anyone with devtools open.  
**Fix:** Remove or gate behind `import.meta.env.DEV`.

---

### L11. FiltersPanel allows negative price input

**File:** `frontend/src/components/FiltersPanel.jsx:334-372`  
**Trigger:** Type -100 in min price field → accepted.  
**Fix:** `Math.max(0, Number(e.target.value))` in onChange.

---

### L12. Deprecated docker-compose `version` key + manifest `"any maskable"` format

**Files:** `docker-compose.yml:1`, `frontend/public/manifest.json:15,20`  
**Trigger:** Warning noise / potential icon issues on older Android WebViews.  
**Fix:** Remove `version:` line; split icon entries by purpose.

---

## Areas That Look Clean ✓

- **Hook cleanup patterns** — `useProducts`, `useInlineSvg`, `useFilters` all use cancellation flags correctly
- **Service worker caching strategy** — Network-first for API, cache-first for static assets is appropriate for PWA
- **Route error handling** — All backend routes have try/catch with 500 responses
- **SQL parameterization** — All user input is parameterized (no raw string interpolation in SQL values)
- **IndiaSvgMap component** — Properly memoized, pure rendering
- **Vite config** — Proxy setup, build config, and React plugin configuration are correct
- **Vercel config** — SPA rewrite rule is standard and correct
- **originNormalizer / processNormalizer** — Core logic is correct (aside from the unknown-origin fallback)
- **Debounce in ExplorePage** — Properly cleans up with `clearTimeout`

---

## Recommended Fix Priority

1. **Immediate (blocks development/deployment):**  
   C1, C2, H1, H2, M16 — broken tests and Docker builds

2. **Before production deploy:**  
   C3, H3, H4, H5, H6, M1, M2, M5 — security, data correctness, deployment

3. **Next sprint (UX/correctness):**  
   H7, H8, H9, H10, M3-M15 — user-facing bugs and race conditions

4. **Backlog (hardening):**  
   All Low-severity items — validation, edge cases, cleanup
