# Coffee Project Architecture

## 🏗️ System Overview

This is a full-stack specialty coffee companion application with three core components:

```
┌─────────────────────────────────────────────────────────────────┐
│                     COFFEE PROJECT ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   Frontend Layer     │         │   Backend Layer      │
│   (React + Vite)     │◄────────┤  (Express.js)        │
│                      │ HTTP    │                      │
│  • React Router      │◄───────►│  • RESTful API       │
│  • Axios Client      │         │  • Validation       │
│  • Fuse.js Search    │         │  • Routes           │
│  • Recharts Charts   │         │                      │
│  • Tailwind CSS      │         │  Port: 4000         │
│                      │         │                      │
│  Port: 5173/4173     │         └──────────────────────┘
└──────────────────────┘                    │
                                             │
                                    ┌────────▼─────────┐
                                    │  Data Layer      │
                                    │  (SQLite)        │
                                    │                  │
                                    │  • WAL mode      │
                                    │  • Foreign keys  │
                                    │  • Indexes       │
                                    └──────────────────┘
```

---

## 1️⃣ Frontend Layer (React + Vite)

**Location**: `frontend/`

### Technologies
- **Framework**: React 18.3 + Vite 5.4
- **HTTP Client**: Axios 1.7 (with error interceptor)
- **Search**: Fuse.js 7.0 (client-side fuzzy search)
- **Visualization**: Recharts 3.8 (data charts)
- **Styling**: Tailwind CSS 3.4 + PostCSS
- **Router**: React Router v6 (3 main pages)
- **Testing**: Vitest 2.1 + Testing Library

### Key Files
- `frontend/src/main.jsx` - React Router setup
- `frontend/src/App.jsx` - Main app component
- `frontend/src/api/client.js` - Centralized Axios instance
- `frontend/src/pages/ExplorePage.jsx` - Core product browsing UI

### Features
- Product exploration with filters (roaster, roast type, origin, process)
- Fuzzy search with Fuse.js
- Recipe browsing and creation
- Bean inventory tracking
- Brew logging system
- Community posts feed

---

## 2️⃣ Backend Layer (Express.js)

**Location**: `backend/`

### Technologies
- **Framework**: Express 4.19
- **Database**: SQLite 3 (better-sqlite3 12.9)
- **Security**: Helmet 7.1 (HTTP headers) + CORS
- **Validation**: Custom schema validation
- **Environment**: dotenv for config
- **Testing**: Jest 29.7 + Supertest
- **Dev**: Nodemon for auto-reload

### Key Files
- `backend/src/server.js` - Server startup (port 4000)
- `backend/src/app.js` - Express app setup
- `backend/src/db.js` - Database initialization & schema
- `backend/src/validation.js` - Request validation
- `backend/src/routes/` - API route handlers

### API Routes
```
/api/
├── /products              # Coffee product catalog
│   ├── GET /              # List with filters & search
│   ├── GET /filter-options # Distinct filter values
│   ├── GET /:id           # Product detail
│   └── POST /             # Add new product (admin)
├── /recipes               # Brew recipes
│   ├── GET /              # List all recipes
│   ├── GET /:id           # Recipe detail
│   ├── POST /             # Create recipe
│   └── PUT /:id           # Update recipe
├── /reviews               # Product reviews
│   ├── GET /products/:id  # Reviews for product
│   ├── POST /             # Create review
│   └── PUT /:id           # Update review
├── /inventory             # Bean inventory
│   ├── GET /              # User's beans
│   ├── POST /             # Add bean
│   └── PUT /:id           # Update bean
├── /brew-logs             # Brew session records
├── /brew-notes            # Quick product notes
├── /posts                 # Community posts
├── /roasters              # NEW: Roaster profiles
│   ├── GET /              # List roasters with ratings
│   ├── GET /filter-options
│   ├── GET /:id           # Roaster details
│   └── POST /:id/ratings  # Update roaster ratings
└── /processes             # NEW: Process taxonomy
    ├── GET /taxonomy      # Complete taxonomy structure
    ├── GET /standard      # List all standard processes
    ├── GET /categories    # All process categories
    ├── GET /categories/:id/methods # Methods in category
    ├── GET /:name/details # Process details with category
    ├── GET /:name/children # Child processes
    └── GET /:name/hierarchy # Parent chain
```

### Query Parameters
- `roaster`, `roastType`, `origin`, `process` - Server-side filters
- `search` - Text search (name, roaster, notes)
- `flavour` - Tasting notes filter
- `priceMin`, `priceMax` - Price range
- `sort` - "newest", "rating", "price", "discover"
- `page`, `limit` - Pagination

---

## 3️⃣ Data Layer (SQLite)

**Location**: `backend/coffee.db`

### Core Tables

#### Coffee Products
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `products` | Coffee catalog | productId, name, roaster, roastType, origin, process, tastingNotes, price, imageUrl, url, description |
| `product_variants` | Price/quantity variants | productId, quantity, price |

#### User Content
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `reviews` | Product reviews | productId, reviewerName, rating, comment, createdAt |
| `bean_inventory` | User's bean collection | productId, customName, gramsRemaining, purchaseDate, openedDate |
| `brew_logs` | Brew sessions | recipeId, beanInventoryId, rating, notes, brewTimeSec, waterTempC |
| `brew_notes` | Quick product notes | productId, authorName, body |
| `community_posts` | Forum posts | title, body, authorName, recipeId |

#### Recipes
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `recipes` | Brew guides | name, brewerType, grindSize, coffeeGrams, waterGrams, waterTempC, bloomTimeSec, targetBrewTimeSec, steps (JSON), isBuiltIn, isPublic |
| `user_profile` | User settings | displayName, defaultGrinder, defaultBrewer |

#### NEW: Roaster Data
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `roasters` | Roaster profiles | name, websiteUrl, establishedYear, description |
| `roaster_ratings` | Roaster quality metrics | roasterId, overallRating, consistencyRating, experimentationRating, totalReviews |
| `roaster_locations` | Physical cafes/shops | roasterId, city, state, country, address, latitude, longitude, phoneNumber, menuUrl, operatingHours |

#### NEW: Process Taxonomy
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `process_categories` | Processing method categories | name (8 main categories), description |
| `process_methods` | Individual process methods | categoryId, name, aliases (JSON), parentMethodId (for hierarchies) |

**Process Categories** (8 total):
1. Wet Processes - Depulped & fermented (Washed, Semi-Washed, etc.)
2. Dry Processes - Fruit intact (Natural, Sun Dried, Monsooned)
3. Honey & Mucilage Retained - Varying mucilage levels (White/Yellow/Red/Black Honey)
4. Hybrid Processes - Combined characteristics (Pulped Natural, Mixed Process)
5. Anaerobic & Controlled Fermentation - Oxygen-controlled (Carbonic Maceration, Lactic, etc.)
6. Co-Fermented & Flavor-Infused - Added flavors (Fruit Maceration, Barrel Aged, Wine)
7. Drying & Post-Processing - Drying techniques (Freeze Dried, Shade Dried, Solar Dried)
8. Experimental & Emerging - Novel methods (Multi-Stage Fermentation, Enzyme Assisted)

**Key Features**:
- Hierarchical structure with parent-child relationships
- 70+ standardized process methods with aliases
- All legacy process values automatically normalized on migration
- Complete data preservation during schema updates

### Indexes
- `idx_products_roaster`, `idx_products_roastType`, `idx_products_origin`, `idx_products_process`, `idx_products_fermentation`
- `idx_products_category`, `idx_products_price`, `idx_products_name`
- `idx_roasters_name`, `idx_roaster_ratings_roasterId`
- `idx_roaster_locations_roasterId`, `idx_roaster_locations_city`
- `idx_process_categories_name`, `idx_process_methods_name`, `idx_process_methods_categoryId`

### Database Features
- **WAL Mode**: Better concurrent read/write performance
- **Foreign Keys**: Referential integrity enabled
- **Cascading Deletes**: Data consistency on product removal
- **Process Normalization**: Automatic conversion to standard taxonomy
- **Hierarchical Queries**: Query parent/child process relationships

---

## 4️⃣ Data Pipeline Layer (Python ETL)

**Location**: `pipeline/`, `scrapers/`, `ScraperScripts/`

### Components

#### Pipeline Orchestrator
- **runner.py** - Coordinates all scrapers & processing
- Triggers 12+ roaster-specific scrapers
- Runs generic parser for new roasters
- Cleans and normalizes data

#### Scrapers
- **roasters/** - Individual scraper modules for each coffee brand
  - Araku, Blue Tokai, Bloom, Curious Life, Fraction 9, Kappi Kottai, etc.
- **base/** - Base scraper class with common utilities
- **generic_roasters_scraper.py** - Fallback for unmapped roasters

#### Data Processing
- **parser.py** - GenericRoastersParser (web scraping logic)
- **cleaner.py** - Filters non-coffee items, normalizes product data

### Data Flow
```
Coffee Websites
       ↓
   Scrapers (12+ roasters)
       ↓
  Raw Product Data
       ↓
   Data Cleaner
  (Normalize & Filter)
       ↓
  cleaned_coffee_products.json
       ↓
   Database Seed
  (backend/seed.js)
       ↓
    SQLite DB
```

---

## 5️⃣ Development & Deployment

### Local Development

```bash
# Install all dependencies
npm install

# Seed built-in recipes (one-time)
npm run seed cleaned_coffee_products.json

# Run both backend & frontend concurrently
npm run dev

# Individual services
npm run dev:backend  # Port 4000
npm run dev:frontend # Port 5173
```

### Windows Batch Script
- `run.bat` - Convenient development launcher
  - Kills existing processes on ports 4000 & 5173
  - Seeds recipes
  - Starts both services

### Docker (Production)
- **docker-compose.yml** - Multi-container orchestration
- **Dockerfile.backend** - Node.js backend image
- **Dockerfile.frontend** - Node.js frontend build
- Services communicate via Docker network
- Frontend → Backend via service DNS

### Testing
```bash
npm test                  # Run all tests
npm run test:backend      # Backend Jest tests
npm run test:frontend     # Frontend Vitest tests
```

---

## 6️⃣ Project Structure

```
coffee-project/
├── backend/
│   ├── src/
│   │   ├── app.js              # Express app setup
│   │   ├── db.js               # Database initialization
│   │   ├── server.js           # Server startup
│   │   ├── validation.js       # Request validation
│   │   └── routes/             # API endpoints
│   ├── seed.js                 # Seed products from JSON
│   ├── seedRecipes.js          # Seed built-in recipes
│   ├── coffee.db               # SQLite database
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx            # React entry point
│   │   ├── App.jsx             # Main component
│   │   ├── api/client.js       # Axios instance
│   │   ├── pages/              # Route pages
│   │   ├── components/         # Reusable components
│   │   ├── hooks/              # Custom React hooks
│   │   └── assets/             # Images, styles
│   ├── index.html              # HTML template
│   └── package.json
│
├── pipeline/
│   ├── runner.py               # ETL orchestrator
│   ├── parser.py               # Web scraping logic
│   └── cleaner.py              # Data normalization
│
├── scrapers/
│   ├── roasters/               # Individual roaster scrapers
│   ├── base/                   # Base scraper class
│   └── registry.py
│
├── docker-compose.yml          # Container orchestration
├── Dockerfile.backend          # Backend image
├── Dockerfile.frontend         # Frontend image
├── run.bat                      # Dev launcher (Windows)
├── package.json                # Root workspace config
└── README.md
```

---

## 7️⃣ External Dependencies

### Frontend Dependencies
- **axios** (1.7.7) - HTTP client
- **fuse.js** (7.0.0) - Fuzzy search library
- **react** (18.3.1) - UI framework
- **react-dom** (18.3.1) - React rendering
- **react-router-dom** (6.28.0) - Client-side routing
- **recharts** (3.8.1) - Data visualization
- **tailwindcss** (3.4.13) - Utility CSS framework

### Backend Dependencies
- **express** (4.19.2) - Web framework
- **better-sqlite3** (12.9.0) - SQLite driver
- **cors** (2.8.5) - CORS middleware
- **helmet** (7.1.0) - HTTP security headers
- **dotenv** (16.4.5) - Environment variables

### Dev Tools
- **vite** (5.4.10) - Frontend bundler
- **nodemon** (3.1.0) - Auto-reload server
- **jest** (29.7.0) - Testing framework
- **vitest** (2.1.4) - Frontend test runner
- **concurrently** (9.0.0) - Run multiple commands

---

## 8️⃣ Key Features

### ☕ Coffee Discovery
- Browse 1000+ specialty coffee products
- Filter by roaster, roast type, origin, process
- Fuzzy search with Fuse.js
- View tasting notes & pricing

### 🎯 Recipe Management
- 6 built-in brew guides (V60, Aeropress, French Press, etc.)
- Create custom recipes with step-by-step instructions
- Track equipment & brewing parameters

### 📊 Personal Inventory
- Track bean collection with weight
- Monitor purchase & open dates
- Associate beans with brew logs

### 📝 Brew Logging
- Record brew sessions with ratings & notes
- Track temperature, grind size, brew time
- Link to recipes and beans

### 🤝 Community Features
- Share brew logs publicly
- Create community posts
- Comment on recipes

### 🏭 NEW: Roaster Profiles
- Roaster information & URLs
- Quality ratings (overall, consistency, experimentation)
- Physical locations with menus
- Operating hours & contact info

---

## 9️⃣ Data Flow Example: Product Query

```
User selects filters (roaster="Araku", roastType="Medium")
            ↓
Frontend sends: GET /api/products?roaster=Araku&roastType=Medium
            ↓
Backend receives request in routes/
            ↓
Validation checks query parameters
            ↓
Database query with filters applied
            ↓
Products JOIN ratings, then sort by price/rating/newest
            ↓
Return paginated results (20 per page)
            ↓
Frontend receives JSON response
            ↓
Render product grid with Recharts visualizations
            ↓
User can click product for detail view or add to inventory
```

---

## 🔟 Performance Optimizations

1. **Indexes** - 13 database indexes on frequently queried columns
2. **WAL Mode** - SQLite Write-Ahead Logging for concurrent reads
3. **Pagination** - Limit results (max 200 per request)
4. **Client-side Search** - Fuse.js for instant search without server round-trips
5. **Caching** - Browser caching of static assets (Vite)
6. **Lazy Loading** - React components loaded on demand

---

## 1️⃣1️⃣ Environment Variables

**Backend** (`.env`)
```
DATABASE_PATH=backend/coffee.db
PORT=4000
NODE_ENV=development
```

**Frontend** (`frontend/.env`)
```
VITE_API_URL=http://localhost:4000/api
```

---

## 1️⃣2️⃣ Tech Stack Summary

| Tier | Technology |
|------|-----------|
| **Frontend** | React 18.3 + Vite 5.4 + Tailwind CSS |
| **Backend** | Express 4.19 + Node.js |
| **Database** | SQLite 3 (WAL mode) |
| **HTTP** | REST API, Axios, CORS |
| **Search** | Fuse.js (client-side) |
| **Visualization** | Recharts |
| **Security** | Helmet, CORS, Foreign Keys |
| **Deployment** | Docker Compose |
| **Testing** | Jest, Vitest, Supertest |
| **Pipeline** | Python ETL (12+ scrapers) |

---

## Development Commands

```bash
# Development
npm run dev              # Frontend + Backend
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Build
npm run build            # Build both
npm run build:backend    # Backend build
npm run build:frontend   # Frontend build

# Testing
npm test                 # All tests
npm run test:backend
npm run test:frontend

# Seed Data
npm run seed <json_file> # Seed products from JSON file

# Clean & Reset
rm backend/coffee.db     # Delete database (fresh start)
npm run seed cleaned_coffee_products.json  # Reseed
```

---

Last Updated: May 9, 2026
