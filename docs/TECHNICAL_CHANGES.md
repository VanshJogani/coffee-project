# Technical Changes

Architectural improvements applied to the Coffee Explorer codebase.
Auth is intentionally out of scope for this pass.

---

## 1. SQLite driver: `sqlite3` → `better-sqlite3`

**Before:** `sqlite3` (async, callback-based). Every query required a `new Promise(...)` wrapper.  
**After:** `better-sqlite3` (synchronous). Queries are direct method calls.

Changes:
- `backend/src/db.js` — rewritten around `better-sqlite3`. Added `pragma journal_mode = WAL` (better write concurrency) and `pragma foreign_keys = ON` (enforces FK constraints at the DB level).
- All six route files — removed ~120 lines of `dbGet/dbAll/dbRun` Promise shims. Each handler is now 30–40% shorter.
- `backend/seed.js` — rewritten using `better-sqlite3` with a single transaction for the full seed.
- `backend/package.json` — `sqlite3` removed, `better-sqlite3` added.

---

## 2. SQL Injection Fix (products route)

**Before:** `products.js` built SQL via string concatenation with a custom `esc()` single-quote escape function that did not cover all injection vectors.

```js
// BEFORE — unsafe string interpolation
const vals = list.map((v) => `'${esc(v)}'`).join(",");
whereClauses.push(`p.roaster IN (${vals})`);
```

**After:** All queries use `?` positional parameters with `better-sqlite3`'s prepared statements. User input never touches SQL strings.

```js
// AFTER — parameterized
whereClauses.push(`p.roaster IN (${list.map(() => "?").join(",")})`);
params.push(...list);
```

All other routes (`reviews`, `recipes`, `inventory`, `brewLogs`, `brewNotes`) were already using named parameters (`@id`) with the old driver — these have been carried over cleanly.

---

## 3. Database Indexes

**Before:** No indexes. Queries filtering on text columns performed full table scans across 3,000+ rows.

**After:** Indexes created at schema init time (`db.js`) and during seed (`seed.js`):

| Index | Column(s) |
|---|---|
| `idx_products_roaster` | `products.roaster` |
| `idx_products_roastType` | `products.roastType` |
| `idx_products_origin` | `products.origin` |
| `idx_products_category` | `products.category` |
| `idx_products_cuppingDate` | `products.cuppingDate` |
| `idx_products_price` | `products.price` |
| `idx_products_name` | `products.name` |
| `idx_product_variants_productId` | `product_variants.productId` |
| `idx_reviews_productId` | `reviews.productId` |
| `idx_brew_logs_beanInventoryId` | `brew_logs.beanInventoryId` |
| `idx_brew_logs_recipeId` | `brew_logs.recipeId` |
| `idx_brew_notes_productId` | `brew_notes.productId` |
| `idx_bean_inventory_productId` | `bean_inventory.productId` |

---

## 4. Roast Type Normalization Moved to Seed

**Before:** `ExplorePage.jsx` normalized roast type strings on every page load inside `loadAllProducts()`:

```js
if (r === "Dark" || r === "Dark Roast") r = "Dark Roast";
else if (r === "Medium" || r === "Medium Roast") r = "Medium Roast";
// ...
```

**After:** A `normalizeRoastType()` function in `seed.js` canonicalizes all values at ingest time using regex matching. The DB stores clean values; no runtime normalization needed.

```js
function normalizeRoastType(raw) {
  if (/^dark/i.test(r)) return "Dark Roast";
  if (/^medium[\s-]dark/i.test(r)) return "Medium-Dark Roast";
  if (/^medium/i.test(r)) return "Medium Roast";
  if (/^light/i.test(r)) return "Light Roast";
  return r;
}
```

---

## 5. Product Variants Data Model

**Before:** The DB had one row per SKU (e.g., three rows for 100g/250g/500g of the same coffee). Client-side JS grouped them by `name::roaster` key on every render of 3,000 rows.

**After:**

- New `product_variants` table: `(id, productId FK, quantity, price, originalProductId)`.
- `seed.js` deduplicates on `name.toLowerCase() + roaster.toLowerCase()`. One canonical product row is written; additional SKUs become variant rows.
- Result: **3,097 raw entries → 1,718 canonical products** with attached variants.
- `GET /api/products/:id` now returns a `variants[]` array alongside `reviews[]`.
- `GET /api/products` list endpoint no longer needs to carry variant data in every row.

---

## 6. Server-Side Filtering and Pagination

**Before:** `ExplorePage.jsx` fetched `limit=5000` (all products) on mount, then filtered, sorted, and paginated entirely in the browser.

**After:** The backend `GET /api/products` endpoint handles all filtering server-side. The frontend requests one page at a time (default 24 items).

New query parameters added to `GET /api/products`:

| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by product category |
| `roaster` | comma-separated | `IN` filter on roaster |
| `roastType` | comma-separated | `IN` filter on roast type |
| `origin` | string | Exact match on origin |
| `process` | comma-separated | `IN` filter on process |
| `flavour` | comma-separated | `LIKE` match on tastingNotes + description |
| `priceMin` | number | Minimum price (nulls pass through) |
| `priceMax` | number | Maximum price (nulls pass through) |
| `search` | string | `LIKE` across name, roaster, tastingNotes, description |
| `sort` | string | `newest`, `rating`, `roastType`, `priceAsc`, `priceDesc`, `discover` |
| `page` | number | Page number (default 1) |
| `limit` | number | Page size (default 20, max 200) |

New endpoint: **`GET /api/products/filter-options?category=Coffee`**  
Returns available `roasters[]`, `roastTypes[]`, `origins[]`, `processes[]`, `priceMin`, `priceMax` for the given category. Used to populate filter panel options dynamically.

The `limit` cap is reduced from 5,000 to 200 to prevent accidental large payload requests.

---

## 7. ExplorePage Refactored into Custom Hooks

**Before:** `ExplorePage.jsx` was ~400 lines with 15+ `useState` calls managing product loading, filter state, pagination, and modal state all in one component.

**After:** Logic is split into three focused hooks:

### `hooks/useFilters.js`
- Fetches filter options from `/api/products/filter-options` when category changes.
- Manages selection state for roasters, roast types, origins, processes, flavours, and price range.
- Exposes `activeFilters` object (ready to spread into API params) and `clearFilters()`.

### `hooks/useProducts.js`
- Fetches one page of products from the server using the active filters and sort.
- Resets to page 1 whenever category, search, sort, or filters change.
- Applies Fuse.js fuzzy re-ranking client-side on the returned page when a search term is present (server already pre-filters; Fuse scores for ordering).
- Returns `{ products, total, page, setPage, totalPages, loading, error }`.

### `hooks/useProductDetail.js`
- Manages modal open/close state and `selectedProduct`.
- Wraps `fetchProduct`, `createReview`, and `deleteReview`.
- Optimistically updates `selectedProduct.reviews` on create/delete without refetching the full product list.

`ExplorePage.jsx` is now ~170 lines, all JSX and event wiring.

---

## 8. Centralized API Error Handling

**Before:** Axios errors were unhandled — uncaught promises silently failed or surfaced as raw console errors.

**After:** A response interceptor in `api/client.js` catches all 4xx/5xx responses and shows a non-blocking toast notification.

```js
api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    const message = err.response?.data?.error || err.message;
    if (status >= 400 && status < 500) showToast(message, "warn");
    else showToast("Server error — please try again.", "error");
    return Promise.reject(err);
  }
);
```

The `showToast()` helper creates a self-removing DOM element — no additional toast library required.

---

## Summary

| Area | Before | After |
|---|---|---|
| DB driver | `sqlite3` (async callbacks) | `better-sqlite3` (sync) |
| SQL safety | String concat + custom escape | Parameterized `?` placeholders |
| Indexes | None | 13 indexes on filter/join columns |
| Roast normalization | Client-side on every render | Seed time, stored clean in DB |
| Product data model | One row per SKU | Canonical product + `product_variants` table |
| Data loading | All 5,000 rows on mount | Paginated server-side (24/page) |
| Filtering | In-browser JS | SQL `WHERE` clauses with indexes |
| Deduplication | Client-side `Map` grouping | Eliminated by normalized data model |
| ExplorePage | ~400 lines, 15+ state calls | ~170 lines + 3 focused hooks |
| API errors | Silent / unhandled | Interceptor + toast notifications |
