# Coffee Project

A full-stack specialty coffee companion app. Browse and filter coffees from Indian roasters, track your brews with a guided pour timer, manage bean inventory, write and share recipes, and engage with a community feed — all backed by SQLite and served via Express, with a React + Vite + Tailwind frontend.

---

## What It Does

### Explore
- Browse ~1,700 canonical coffee products from Indian specialty roasters
- Server-side filtering: roaster, roast type, origin, process, flavour notes, price range
- Fuse.js fuzzy search with 350ms debounce
- Dynamic filter options loaded from the DB (no hardcoded lists)
- Paginated results, sort by newest / rating / price / "discover" (random)
- Product detail modal with tasting notes, reviews, and average rating

### Brew Now
- Select a bean from your inventory and a recipe to brew with
- Auto-fills brew parameters (grind, ratio, temp) from the recipe
- **Pour timer** — for pourover methods (V60, Chemex, Kalita, Clever, etc.):
  - Derives pour schedule from recipe steps automatically
  - Manual quick-setup: set number of pours + interval, timer splits water evenly
  - Live "POUR NOW" pulsing banner with pour weight
  - Countdown to next pour, segmented progress bar
  - Effective target time computed from last pour + drawdown
- Simple step-by-step guidance for non-pourover methods (AeroPress, French Press, Moka Pot)
- Post-brew log: rating, notes, public/private toggle
- Save current setup as a new recipe directly from the brew screen

### Recipes
- 6 built-in recipes (James Hoffman V60, Tetsu Kasuya 4:6, AeroPress Inverted, French Press Classic, Moka Pot Stovetop, Chemex Classic)
- Create, edit, fork, and delete custom recipes
- Step editor with time, pour grams, and instruction per step
- Navigate directly from a recipe card to Brew Now with recipe pre-loaded

### Community
- Reddit-style post feed — write a post with a title, body, and optional attached recipe
- Like posts (upvote counter)
- Import any attached recipe into your own collection with one click
- Try a community recipe directly (goes to Brew Now pre-loaded)
- "Post" button on your recipes opens the compose modal with the recipe pre-attached

### Bean Inventory
- Add beans by linking to a product in the catalogue or adding a custom entry
- Track grams remaining, purchase date, open date, notes
- Inventory entries appear in the Brew Now bean dropdown (with grams remaining shown)
- Brew logs reference inventory items

### Brew Log
- Automatic log entry after every brew
- Tracks: bean, recipe, brewer, grinder, grind size, ratio, temp, brew time, rating, notes
- Public/private flag per log entry

---

## Architecture

### Backend

| Layer | Tech |
|---|---|
| Runtime | Node.js + Express |
| Database | SQLite via `better-sqlite3` (synchronous, WAL mode) |
| ORM | None — raw parameterized SQL |
| Tests | Jest + Supertest |

**Routes:**
- `GET/POST /api/products` — paginated product list with 9 server-side filters
- `GET /api/products/filter-options` — dynamic filter values from DB
- `GET /api/products/:id` — single product with reviews and avg rating
- `GET/POST/PUT/DELETE /api/reviews`
- `GET/POST/PUT/DELETE /api/recipes` — supports `?community=1` for public recipes
- `GET/POST/PUT/DELETE /api/inventory`
- `GET/POST/PUT/DELETE /api/brew-logs`
- `GET/POST/DELETE /api/brew-notes`
- `GET/POST/PUT/DELETE /api/posts` — community feed
- `PUT /api/posts/:id/like` — upvote a post
- `GET /api/health`

**DB Schema highlights:**
- `products` + `product_variants` — canonical product deduplication (3,097 SKUs → 1,718 products)
- `recipes` — steps stored as JSON array of `{ timeSec, instruction, pourGrams }`; `isPublic`, `authorName`, `authorSetup` columns added via migration
- `community_posts` — title, body, authorName, recipeId (FK to recipes), likes counter
- 13 indexes on filter/join columns
- Additive migrations via `PRAGMA table_info` + `ALTER TABLE` (safe to re-run)

### Frontend

| Layer | Tech |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Styling | TailwindCSS (custom luxury theme) |
| HTTP | Axios with response interceptor + vanilla DOM toast |
| Search | Fuse.js fuzzy re-ranking on current page |
| State | useState / useReducer / useMemo / custom hooks |

**Custom hooks:**
- `useFilters` — manages all filter state, fetches filter-options when category changes, exposes `activeFilters` via `useMemo` for reference stability
- `useProducts` — server-side paginated fetching with cancellation tokens, initial-load-only loading flag, `filtersKey` via `JSON.stringify` to prevent infinite re-fetch loops
- `useProductDetail` — modal open/close, optimistic review list updates

**Pour timer (pure functional):**
```
isPourover(brewerType)
derivePourSchedule(steps, totalWater)   → schedule from recipe steps
buildQuickSchedule(numPours, intervalSec, totalWater)  → even-split manual schedule
computePourState(elapsed, schedule)     → { pourIndex, isPouring, nextPourIn, cumulativeGrams, allDone }
```
All state is computed from `elapsed` time on every render — no extra reducer actions, no drift.

---

## What We're Planning to Add

### Grinder Conversion & Dial-In Assistant
When importing a community recipe, the app will ask for your grinder model. A conversion layer maps grind sizes between grinder types (e.g. Comandante clicks → Timemore clicks → generic coarseness scale). Users can then share "dialed-in" versions of a recipe that are specific to their grinder + coffee combination, so others with the same setup can get a starting point instantly.

### Auth & User Profiles
Sign up with email or OAuth. User profile captures: display name, grinder, default brewer. This unlocks:
- Attributing posts and recipes to an account
- Private vs shared brew logs
- Following other brewers
- Personalised recipe recommendations

### Dial-In Sharing
Each coffee product page gets a "dialed-in setups" section — community members post their exact parameters (grinder, grind setting, dose, yield, time, temp, tasting notes) for that specific coffee. Filterable by grinder model. Think a collaborative dial-in database per coffee.

### Adjust Recipe (Beta)
When importing a community recipe, an "Adjust for my setup" option runs the recipe through a parameter adjustment model:
- Grind size conversion (grinder mapping table)
- Dose/yield scaling (ratio preserved, absolute weights recalculated)
- Water temperature adjustments for altitude (future)

### Grinder Database
A reference table of grinder models with their grind range and step size. Used by the conversion layer and the dial-in sharing feature. Community-contributed and admin-curated.

### Notifications / Brew Reminders
Push or in-app reminders for: "your beans have been open for 14 days", "try a new recipe", etc.

### Offline Mode (PWA)
Service worker caching for the brew timer and recipe viewer so you can use it without internet mid-brew.

---

## Security Considerations

### Current State (No Auth)
The app currently has no authentication. All write operations (create recipe, post to community, like, delete) are unauthenticated. This is intentional for the initial version — the focus is on core functionality first.

**Mitigations in place:**
- All SQL uses parameterized queries (`?` placeholders) — no SQL injection surface
- `helmet` middleware sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- CORS configured via `CORS_ORIGIN` env var — locked to frontend origin in production
- Input validation on required fields (name, brewerType, title, etc.) before DB writes
- Likes are increment-only — no decrement, no negative values possible
- `isBuiltIn` recipes are protected from edit/delete at the route level (403 response)

### When Auth Is Added
- Passwords: bcrypt with work factor ≥ 12, never stored plain
- Sessions: short-lived JWTs (15min access + refresh token rotation) or `express-session` with a server-side store
- All write routes gated behind `requireAuth` middleware
- Recipe/post ownership: only the author (by userId) can edit or delete their content
- Rate limiting: `express-rate-limit` on auth endpoints and write operations
- CSRF protection: `SameSite=Strict` cookies or double-submit cookie pattern
- Content sanitization: strip HTML from all user-supplied text fields before storing

### Data Exposure
- Currently: all posts, recipes, and brew logs marked `isPublic=1` are world-readable — expected behaviour for a no-auth community feature
- When auth lands: private brew logs (isPublic=0) must be behind ownership check; currently they're just "not shown in UI" which is not sufficient for sensitive data
- The SQLite database file should never be in a public directory or committed with real user data — add `backend/coffee.db` to `.gitignore` for production forks

### Input Risks to Watch
- Recipe `steps` field is stored as JSON and parsed on read — validate that steps is an array of objects before insertion (currently trusts client shape)
- `authorName` and post `body` are rendered as `textContent` (not `innerHTML`) in React — safe from XSS as-is, but enforce this on any future rich-text upgrade
- File uploads are not implemented yet — when added, validate MIME type server-side, not just extension; store outside the web root

---

## Setup

### Prerequisites
- Node.js 18+
- `cleaned_coffee_products.json` in the project root (product catalogue)

### Install
```bash
npm install
```
Uses npm workspaces — installs backend and frontend dependencies together.

### Seed the database
```bash
# Seed coffee products
npm run seed

# Seed built-in brew recipes
node backend/seedRecipes.js
```

### Run in development
```bash
npm run dev
```
- Backend API: `http://localhost:4000`
- Frontend: `http://localhost:5173` (proxies `/api` to backend)

### Environment variables
Copy `.env.example` to `.env`:
```
BACKEND_PORT=4000
DATABASE_PATH=./backend/coffee.db
CORS_ORIGIN=http://localhost:5173
```

### Run tests
```bash
npm test
```

---

## Project Structure

```
coffee-project/
├── backend/
│   ├── src/
│   │   ├── app.js              Express app setup
│   │   ├── db.js               Schema, indexes, migrations
│   │   └── routes/
│   │       ├── products.js
│   │       ├── reviews.js
│   │       ├── recipes.js
│   │       ├── inventory.js
│   │       ├── brewLogs.js
│   │       ├── brewNotes.js
│   │       └── posts.js        Community post feed
│   ├── seed.js                 Product catalogue seeder
│   └── seedRecipes.js          Built-in recipe seeder
├── frontend/
│   └── src/
│       ├── api/client.js       Axios instance + all API functions
│       ├── hooks/
│       │   ├── useFilters.js
│       │   ├── useProducts.js
│       │   └── useProductDetail.js
│       └── pages/
│           ├── ExplorePage.jsx
│           └── brew/
│               ├── BrewNowPage.jsx   Pour timer, bean/recipe selection
│               ├── RecipesPage.jsx   My recipes + community feed
│               ├── InventoryPage.jsx
│               └── BrewLogPage.jsx
├── TECHNICAL_CHANGES.md        Architecture decisions log
└── README.md
```

---

## API Reference (selected endpoints)

```bash
# Products
GET  /api/products?roaster=Blue+Tokai&roastType=Light+Roast&page=1&limit=24
GET  /api/products/filter-options
GET  /api/products/:id

# Recipes
GET  /api/recipes               # built-in + my recipes
GET  /api/recipes?community=1   # public community recipes
POST /api/recipes
PUT  /api/recipes/:id
DELETE /api/recipes/:id

# Community posts
GET  /api/posts
POST /api/posts                 # { title, body, authorName, recipeId? }
PUT  /api/posts/:id/like
DELETE /api/posts/:id

# Brew logs
GET  /api/brew-logs
POST /api/brew-logs             # { recipeId, beanInventoryId, coffeeGrams, ... }

# Inventory
GET  /api/inventory
POST /api/inventory             # { productId? | customName, gramsRemaining, ... }
```
