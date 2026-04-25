## Caffe Elegante – Indian Specialty Coffee Explorer

A full-stack app to discover, browse, filter, and review specialty coffee from 60+ Indian roasters. Features multiple browsing modes including a Tinder-style swipe interface, card carousel, and traditional grid view.

### Project structure

```
backend/          Express API + SQLite
frontend/         React + Vite + Tailwind UI
scrapers/         Scraper framework (Shopify + HTML base classes)
pipeline/         Data cleaning pipeline
ScraperScripts/   Legacy scraper scripts
Cleaners/         Legacy cleaner scripts
results/          Scraped & cleaned data (parsed → cleaned → merged)
```

### Features

- **Three view modes**: Grid (filterable), Cards (swipeable carousel), Swipe (Tinder-style like/dislike)
- **Coffee Randomizer**: "I'm Feeling Lucky" button with fully-random or preference-filtered random selection
- **Swipe preferences**: Like/dislike coffees with persistent localStorage tracking; view and manage your picks
- **Discover mode**: Randomized roaster ordering on every page load for variety
- **Multi-filter system**: Roaster, roast type, origin, process, tasting notes (flavour wheel), price range
- **Categories**: Coffee, Tea, Accessories, Events, Subscriptions
- **Fuzzy search**: Client-side Fuse.js + server-side SQLite LIKE
- **Product variants**: Multiple weights/sizes grouped as one product with price comparison
- **Reviews**: Community ratings with star display
- **Flavour Wheel**: Interactive reference for tasting note exploration

### Data pipeline

```
[Roaster websites] → scrapers/ → results/parsed/*.csv → pipeline/cleaner.py → results/cleaned/*.csv → results/merged → seed.js → SQLite
```

**Scraper framework** (`scrapers/`):
- `ShopifyScraper` — Base class for Shopify stores (JSON API, automatic variant/price extraction)
- `HtmlScraper` — Base class for WooCommerce/custom sites (CSS selector-based extraction with fallbacks)
- `NaivoScraper` — Custom Playwright-based scraper for dynamic-loading sites
- 60+ roaster configurations with `FILTER_COFFEE=True` where non-coffee items need filtering

**Pipeline cleaner** (`pipeline/cleaner.py`):
- Product categorization (Coffee/Tea/Accessories/Events/Subscriptions)
- Roast level detection (15+ patterns: explicit phrases, labeled fields, contextual keywords)
- Tasting notes extraction (labeled sections, "notes of" patterns, sentence scoring)
- Non-coffee filtering (merch, food, equipment, apparel keywords)
- Weight normalization ("250 Grams" → "250g", brewing methods filtered out)
- Origin and process extraction from descriptions
- Variant price parsing with brewing-method detection (V60/Pour Over won't appear as weights)

### Backend

- **Tech**: Node.js, Express, `better-sqlite3`
- **DB**: SQLite (`backend/coffee.db`)
- **Tables**: `products`, `reviews`, `recipes`, `brew_logs`, `brew_notes`, `bean_inventory`
- **Endpoints**:
  - `GET /api/products?roaster=&roastType=&origin=&process=&category=&search=&sort=&page=&limit=`
  - `GET /api/products/:id` — single product with reviews
  - `POST/PUT/DELETE /api/reviews`
  - `GET /api/health`

### Frontend

- **Tech**: React 18, Vite, TailwindCSS, Fuse.js
- **Key components**:
  - `ProductCard` — grid card with price + weight display
  - `CardCarousel` — single-card browsing with touch/swipe navigation
  - `SwipeView` — Tinder-style card stack with like/dislike, preference tabs, undo
  - `CoffeeRandomizer` — "I'm Feeling Lucky" modal with customize/random paths
  - `FiltersPanel` — multi-select filters with price range slider
  - `ProductDetailModal` — full detail with variants, "Try Another" for randomizer flow
  - `InteractiveFlavourWheel` — visual tasting note reference
  - `SortSelect` — Discover / Newest / Rating / Roast / Price sorting

### Setup

```bash
npm install              # installs backend + frontend (workspaces)
npm run seed             # seeds SQLite from cleaned_coffee_products.json
npm run dev              # starts backend :4000 + frontend :5173
npm test                 # runs backend + frontend tests
```

### Environment

Copy `.env.example` to `.env`:

```
BACKEND_PORT=4000
DATABASE_PATH=./backend/coffee.db
CORS_ORIGIN=http://localhost:5173
```

### Running the scraper pipeline

```bash
cd scrapers && python run_all.py       # scrape all roasters → results/parsed/
cd pipeline && python cleaner.py       # clean all → results/cleaned/
cd results && python merger.py         # merge → cleaned_coffee_products.json
npm run seed                           # re-seed database
```

Requires: `pip install requests beautifulsoup4 pandas playwright`

For dynamic sites (Naivo): `playwright install chromium`

### Docker

```bash
docker-compose build && docker-compose up
```

Exposes backend on `:4000`, frontend on `:5173`.
