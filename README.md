## Coffee Explorer – Full‑stack App

A production‑ready example app to browse, filter, search, sort and review specialty coffee products, backed by SQLite and served via an Express API, with a React + Vite + Tailwind frontend.

The app expects a `cleaned_coffee_products.json` file in the project root containing an array of cleaned product objects.

### Project structure

- **backend/** – Express API + SQLite
- **frontend/** – React + Vite + Tailwind UI
- **pipeline/**, **ScraperScripts/**, **Cleaners/** – your existing scraping/cleaning code (unchanged)
- **results/** – not used directly by this app, kept for your pipeline

### Backend overview

- **Tech**: Node.js, Express, `better-sqlite3`, Jest + Supertest
- **DB**: SQLite file (default `backend/coffee.db`)
- **Core tables**:
  - `products(id, productId, name, roaster, roastType, origin, tastingNotes, score, price, imageUrl, cuppingDate)`
  - `reviews(id, productId → products.id, reviewerName, rating, comment, createdAt, updatedAt)`
- **Endpoints**:
  - `GET /api/products?roaster=&roastType=&origin=&search=&sort=&page=&limit=`
    - Filters: multi-roaster, multi-roastType, single origin
    - Search: basic `LIKE` over name/roaster/tastingNotes (backend) + Fuse.js fuzzy search (frontend)
    - Sort: `newest`, `rating`, `roastType`, `priceAsc`, `priceDesc`
    - Returns `{ data: [...], pagination: { page, limit, total, totalPages } }`
  - `GET /api/products/:id` – single product with `avgRating`, `reviewCount`, and `reviews[]`
  - `POST /api/reviews` – body `{ productId, name, rating (1–5), comment }`
  - `PUT /api/reviews/:id` – update rating/comment/name
  - `DELETE /api/reviews/:id`
  - `GET /api/health` – health check

Basic input validation/sanitization is done in `backend/src/validation.js`. CORS is configured via `.env` (`CORS_ORIGIN`).

### Frontend overview

- **Tech**: React 18, Vite, React Router, TailwindCSS, Fuse.js, Vitest + Testing Library
- **Key components** (in `frontend/src/components`):
  - `ProductCard` – product card in grid
  - `FiltersPanel` – roaster / roast type / origin multi-select filters
  - `SearchBar` – global search box
  - `SortSelect` – sort dropdown
  - `ProductDetailModal` – detail view with image, origin map link, tasting notes, description and reviews
  - `Reviews` – list + add/delete review UI
  - `RatingStars` – star rating display
  - `Pagination` – simple previous/next pager

The main UI lives in `frontend/src/App.jsx` and uses `/api/products` and `/api/products/:id` to hydrate data. Client‑side fuzzy search is implemented with Fuse.js for quick filtering by name, roaster, tasting notes and origin.

### Setup & running locally

1. **Prerequisites**

- Node.js 18+
- `cleaned_coffee_products.json` in the project root (same folder as this `README.md`).

2. **Install dependencies**

From the project root (`PythonProject`):

```bash
npm install
```

This uses npm workspaces to install both `backend` and `frontend` dependencies.

3. **Seed the database**

```bash
npm run seed
```

This runs:

```bash
node backend/seed.js cleaned_coffee_products.json
```

It will:

- Create `backend/coffee.db` if needed.
- Create `products` and `reviews` tables.
- Load and normalize each entry from `cleaned_coffee_products.json` into `products`.
- Add a couple of sample reviews per product into `reviews`.

4. **Run the app in development**

```bash
npm run dev
```

This starts:

- Backend API on `http://localhost:4000`
- Frontend dev server on `http://localhost:5173`

The frontend dev server proxies `/api` to the backend, so you only open the frontend URL in your browser.

5. **Run tests**

- Backend tests (Jest + Supertest) and frontend tests (Vitest) from root:

```bash
npm test
```

### Example API usage (curl)

Assuming backend on `http://localhost:4000`.

- **List products (page 1, 24 per page, newest)**

```bash
curl "http://localhost:4000/api/products?page=1&limit=24&sort=newest"
```

- **Filter by roaster and roast type**

```bash
curl "http://localhost:4000/api/products?roaster=Blue%20Tokai,Araku&roastType=Medium%20Roast"
```

- **Search (server-side LIKE)**

```bash
curl "http://localhost:4000/api/products?search=chocolate"
```

- **Get single product with reviews**

```bash
curl "http://localhost:4000/api/products/1"
```

- **Create a review**

```bash
curl -X POST "http://localhost:4000/api/reviews" \
  -H "Content-Type: application/json" \
  -d '{"productId":1,"name":"Vansh","rating":5,"comment":"Loved this coffee!"}'
```

- **Update a review**

```bash
curl -X PUT "http://localhost:4000/api/reviews/1" \
  -H "Content-Type: application/json" \
  -d '{"name":"Vansh","rating":4,"comment":"Still good, a bit bright."}'
```

- **Delete a review**

```bash
curl -X DELETE "http://localhost:4000/api/reviews/1"
```

### Environment configuration

Copy `.env.example` to `.env` in the project root and adjust as needed:

```bash
cp .env.example .env
```

Defaults:

- `BACKEND_PORT=4000` – Express server port
- `DATABASE_PATH=./backend/coffee.db` – SQLite file path
- `CORS_ORIGIN=http://localhost:5173` – frontend origin allowed to call backend

### Docker & deployment

Optional Docker setup is included:

- `Dockerfile.backend` – builds the backend (Express + SQLite)
- `Dockerfile.frontend` – builds the frontend (Vite static bundle served via `vite preview`)
- `docker-compose.yml` – runs both services together

Build and run with Docker:

```bash
docker-compose build
docker-compose up
```

This exposes:

- Backend on `http://localhost:4000`
- Frontend on `http://localhost:5173` (proxied from container’s 4173)

For deployment to services like Render/Heroku (backend) and Vercel/Netlify (frontend):

- Deploy the **backend** as a Node.js service using `backend/src/server.js`, with `DATABASE_PATH` pointing to a persistent volume or managed SQLite/other DB.
- Deploy the **frontend** as a static site built with `npm --workspace frontend run build`, serving the `frontend/dist` folder and configuring the API URL via environment variable (or proxy).

### Search design choices

- **Frontend fuzzy search (Fuse.js)**: For fast, user‑friendly search across relatively small to medium datasets, the app pulls a page of products from the backend and uses Fuse.js to do fuzzy matching across `name`, `roaster`, `tastingNotes`, and `origin`. This gives instant feedback and flexible matching without extra DB complexity.
- **Backend search (SQLite LIKE)**: The backend also supports a simple `search` query param, implemented with `LIKE` on the same fields. This is useful when datasets grow, or when you want server‑side filtering before sending data to the client.

**Scaling later**: For larger datasets, you can:

- Move to SQLite FTS5 (or a dedicated search engine) and build an FTS index over `tastingNotes`, `name`, etc., backing `/api/products` with `MATCH` queries.
- Keep Fuse.js only for client‑side refinement on top of server‑filtered subsets, or drop it entirely in favor of server‑side ranking.

### Data model notes

- The backend normalizes each product from `cleaned_coffee_products.json` into a consistent schema (`normalizeProduct` in `backend/seed.js`), with sensible defaults for missing fields (e.g., price/image optional).
- Reviews are modeled in a separate table and aggregated via `AVG(rating)` and `COUNT(*)` in product list/detail queries so sorting by rating and displaying counts is efficient.

All done — repo created and runnable. Hit me if you want Tailwind theme tweaks, authentication (signup/login), or deployment scripts to a cloud provider.

