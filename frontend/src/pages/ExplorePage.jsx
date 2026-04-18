import React, { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { fetchProducts, fetchProduct, createReview, deleteReview } from "../api/client";
import ProductCard from "../components/ProductCard";
import SearchBar from "../components/SearchBar";
import SortSelect from "../components/SortSelect";
import FiltersPanel from "../components/FiltersPanel";
import Pagination from "../components/Pagination";
import ProductDetailModal from "../components/ProductDetailModal";
import FlavourWheelModal from "../components/FlavourWheelModal";
import LoadingScreen from "../components/LoadingScreen";
import ModeDropdown from "../components/ModeDropdown";
import CoffeeRandomizer from "../components/CoffeeRandomizer";
import CardCarousel from "../components/CardCarousel";
import SwipeView from "../components/SwipeView";

function ExplorePage() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("discover");
  const [selectedCategory, setSelectedCategory] = useState("Coffee");
  const [selectedRoasters, setSelectedRoasters] = useState([]);
  const [selectedRoastTypes, setSelectedRoastTypes] = useState([]);
  const [selectedOrigins, setSelectedOrigins] = useState([]);
  const [selectedProcesses, setSelectedProcesses] = useState([]);
  const [selectedFlavours, setSelectedFlavours] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 1000]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [fromRandomizer, setFromRandomizer] = useState(false);

  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "cards" | "swipe"
  const pageSize = 24;

  const loadAllProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchProducts({ page: 1, limit: 5000, sort: "newest" });
      let products = data.data || [];

      products = products.map(p => {
        let r = p.roastType;
        if (r === "Dark" || r === "Dark Roast") r = "Dark Roast";
        else if (r === "Medium" || r === "Medium Roast") r = "Medium Roast";
        else if (r === "Medium Dark" || r === "Medium-Dark" || r === "Medium Dark Roast" || r === "Medium-Dark Roast") r = "Medium-Dark Roast";
        else if (r === "Light" || r === "Light Roast") r = "Light Roast";
        return { ...p, roastType: r };
      });

      const groupedMap = new Map();
      for (const p of products) {
        const key = `${p.name}::${p.roaster}`;
        if (!groupedMap.has(key)) groupedMap.set(key, { ...p, variants: [] });
        groupedMap.get(key).variants.push({ id: p.id, quantity: p.quantity || "Standard", price: p.price });
      }

      const groupedProducts = Array.from(groupedMap.values());
      groupedProducts.forEach(g => {
        g.variants.sort((a, b) => {
          if (a.price == null && b.price != null) return 1;
          if (b.price == null && a.price != null) return -1;
          return (a.price || 0) - (b.price || 0);
        });
        const valid = g.variants.filter(v => v.price != null);
        g.price = valid.length ? valid[0].price : (g.variants[0]?.price ?? null);
        g.quantity = valid.length ? valid[0].quantity : (g.variants[0]?.quantity ?? "");
      });

      // Shuffle by roaster so the initial page shows a different mix each time
      const byRoaster = new Map();
      for (const p of groupedProducts) {
        const r = p.roaster || "";
        if (!byRoaster.has(r)) byRoaster.set(r, []);
        byRoaster.get(r).push(p);
      }
      const roasters = Array.from(byRoaster.keys());
      for (let i = roasters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roasters[i], roasters[j]] = [roasters[j], roasters[i]];
      }
      // Interleave: round-robin across shuffled roasters for variety on each page
      const shuffled = [];
      const buckets = roasters.map(r => {
        const items = byRoaster.get(r);
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
      });
      let added = true;
      let idx = 0;
      while (added) {
        added = false;
        for (const bucket of buckets) {
          if (idx < bucket.length) {
            shuffled.push(bucket[idx]);
            added = true;
          }
        }
        idx++;
      }

      setAllProducts(shuffled);
    } catch (e) {
      console.error(e);
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAllProducts(); }, []);

  const categoryFilteredProducts = useMemo(() =>
    selectedCategory ? allProducts.filter(p => p.category === selectedCategory) : allProducts,
    [allProducts, selectedCategory]
  );

  const roasterOptions = useMemo(() =>
    Array.from(new Set(categoryFilteredProducts.map(p => p.roaster).filter(Boolean))).sort(),
    [categoryFilteredProducts]
  );
  const roastTypeOptions = useMemo(() =>
    Array.from(new Set(categoryFilteredProducts.map(p => p.roastType).filter(Boolean))).sort(),
    [categoryFilteredProducts]
  );
  const originOptions = useMemo(() =>
    Array.from(new Set(categoryFilteredProducts.map(p => p.origin).filter(Boolean))).sort(),
    [categoryFilteredProducts]
  );
  const processOptions = useMemo(() =>
    Array.from(new Set(categoryFilteredProducts.map(p => p.process).filter(Boolean))).sort(),
    [categoryFilteredProducts]
  );
  const [priceMin, priceMax] = useMemo(() => {
    const prices = categoryFilteredProducts.map(p => p.price).filter(v => v != null && v > 0);
    if (!prices.length) return [0, 10000];
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  }, [categoryFilteredProducts]);

  const filteredProducts = useMemo(() => {
    let items = allProducts;
    if (selectedCategory) items = items.filter(p => p.category === selectedCategory);
    if (selectedRoasters.length) items = items.filter(p => selectedRoasters.includes(p.roaster));
    if (selectedRoastTypes.length) items = items.filter(p => selectedRoastTypes.includes(p.roastType));
    if (selectedOrigins.length) items = items.filter(p => selectedOrigins.includes(p.origin));
    if (selectedProcesses.length) items = items.filter(p => selectedProcesses.includes(p.process));
    if (selectedFlavours.length) {
      items = items.filter(p => {
        const h = `${p.tastingNotes || ""} ${p.description || ""}`.toLowerCase();
        return selectedFlavours.every(f => h.includes(f.toLowerCase()));
      });
    }
    if (priceRange[0] > priceMin || priceRange[1] < priceMax) {
      items = items.filter(p => p.price == null || (p.price >= priceRange[0] && p.price <= priceRange[1]));
    }
    if (search) {
      const fuse = new Fuse(items, { keys: ["name", "roaster", "tastingNotes", "origin", "description"], threshold: 0.35 });
      items = fuse.search(search).map(r => r.item);
    }
    const sorted = [...items];
    sorted.sort((a, b) => {
      switch (sort) {
        case "rating": return (b.avgRating || 0) - (a.avgRating || 0);
        case "roastType": return (a.roastType || "").localeCompare(b.roastType || "") || (a.name || "").localeCompare(b.name || "");
        case "priceAsc": return (a.price == null ? 1 : b.price == null ? -1 : (a.price || 0) - (b.price || 0));
        case "priceDesc": return (a.price == null ? 1 : b.price == null ? -1 : (b.price || 0) - (a.price || 0));
        case "newest": return (new Date(b.cuppingDate || 0) - new Date(a.cuppingDate || 0)) || (b.id || 0) - (a.id || 0);
        case "discover":
        default: return 0;
      }
    });
    return sorted;
  }, [allProducts, selectedCategory, selectedRoasters, selectedRoastTypes, selectedOrigins, selectedProcesses, selectedFlavours, priceRange, priceMin, priceMax, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const displayedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, sort, selectedCategory, selectedRoasters, selectedRoastTypes, selectedOrigins, selectedProcesses, selectedFlavours, priceRange]);

  const handleToggle = (cur, val) => cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];

  const openDetail = async (product) => {
    try {
      const full = await fetchProduct(product.id);
      setSelectedProduct({ ...full, variants: product.variants });
      setDetailOpen(true);
    } catch (e) { console.error(e); }
  };

  const openDetailFromCard = async (product) => {
    setFromRandomizer(false);
    await openDetail(product);
  };

  const handleCreateReview = async (payload) => {
    const created = await createReview(payload);
    setSelectedProduct(prev => !prev ? prev : { ...prev, reviews: [created, ...(prev.reviews || [])] });
    await loadAllProducts();
  };

  const handleDeleteReview = async (id) => {
    await deleteReview(id);
    setSelectedProduct(prev => !prev ? prev : { ...prev, reviews: (prev.reviews || []).filter(r => r.id !== id) });
    await loadAllProducts();
  };

  const handleRandomCoffee = async (product) => {
    setFromRandomizer(true);
    await openDetail(product);
  };

  const handleTryAnother = async () => {
    const coffeeProducts = allProducts.filter(p => p.category === "Coffee");
    if (!coffeeProducts.length) return;
    const random = coffeeProducts[Math.floor(Math.random() * coffeeProducts.length)];
    await openDetail(random);
  };

  const handleClearFilters = () => {
    setSelectedRoasters([]);
    setSelectedRoastTypes([]);
    setSelectedOrigins([]);
    setSelectedProcesses([]);
    setSelectedFlavours([]);
    setPriceRange([priceMin, priceMax]);
  };

  return (
    <>
      {loading && <LoadingScreen />}
      <div className="min-h-screen stone-gradient">
        <header className="border-b border-luxury-clay/20 bg-luxury-umber text-white shelf-glow sticky top-0 z-50">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-luxury-gold/50 via-luxury-gold to-luxury-gold/50 opacity-30" />
          <div className="container-page py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <ModeDropdown />
              <div className="w-px h-8 bg-luxury-gold/20" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-luxury-gold/10 flex items-center justify-center border border-luxury-gold/20">
                  <span className="text-lg">☕</span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold tracking-tight text-luxury-light">Caffè Elegante</h1>
                    <button
                      onClick={() => setWheelOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-luxury-gold/20 text-luxury-gold hover:bg-luxury-gold/30 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border border-luxury-gold/30"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                      Flavour Wheel
                    </button>
                  </div>
                  <p className="text-xs text-luxury-clay opacity-80 font-medium uppercase tracking-[0.2em] mt-0.5">
                    Curated Indian Specialty Coffee
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
                {[
                  { key: "grid", label: "Grid", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
                  { key: "cards", label: "Cards", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
                  { key: "swipe", label: "Swipe", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
                ].map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setViewMode(key)}
                    className={`px-3 py-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                      viewMode === key
                        ? "bg-luxury-gold/20 text-luxury-gold"
                        : "text-luxury-clay hover:text-white"
                    }`}
                    title={label}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                    </svg>
                    <span className="hidden md:inline">{label}</span>
                  </button>
                ))}
              </div>
              <SortSelect value={sort} onChange={setSort} />
            </div>
          </div>
          <div className="container-page flex items-center gap-8 py-0">
            {["Coffee", "Tea", "Accessories", "Events", "Subscriptions"].map(cat => (
              <button
                key={cat}
                type="button"
                className={`pb-4 pt-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${selectedCategory === cat ? "border-luxury-gold text-luxury-light" : "border-transparent text-luxury-clay hover:text-luxury-light hover:border-luxury-clay/30"}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        <main className="container-page py-12 flex flex-col md:flex-row gap-8">
          {viewMode === "grid" && (
            <FiltersPanel
              selectedCategory={selectedCategory}
              roasterOptions={roasterOptions}
              roastTypeOptions={roastTypeOptions}
              originOptions={originOptions}
              processOptions={processOptions}
              selectedRoasters={selectedRoasters}
              selectedRoastTypes={selectedRoastTypes}
              selectedOrigins={selectedOrigins}
              selectedProcesses={selectedProcesses}
              selectedFlavours={selectedFlavours}
              priceRange={priceRange}
              priceMin={priceMin}
              priceMax={priceMax}
              onToggleRoaster={v => setSelectedRoasters(cur => handleToggle(cur, v))}
              onToggleRoastType={v => setSelectedRoastTypes(cur => handleToggle(cur, v))}
              onToggleOrigin={v => setSelectedOrigins(cur => handleToggle(cur, v))}
              onToggleProcess={v => setSelectedProcesses(cur => handleToggle(cur, v))}
              onToggleFlavour={v => setSelectedFlavours(cur => handleToggle(cur, v))}
              onPriceRangeChange={setPriceRange}
              onClear={handleClearFilters}
            />
          )}
          <section className="flex-1 flex flex-col">
            {viewMode === "grid" && (
              <div className="mb-3">
                <SearchBar value={search} onChange={setSearch} />
              </div>
            )}
            {error && <div className="py-2 text-sm text-red-600" role="alert">{error}</div>}
            {!loading && !filteredProducts.length && (
              <div className="py-10 text-center text-sm text-slate-500">No coffees match your filters yet.</div>
            )}

            {viewMode === "grid" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedProducts.map(p => (
                    <ProductCard key={p.id} product={p} onClick={() => openDetailFromCard(p)} />
                  ))}
                </div>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </>
            )}

            {viewMode === "cards" && (
              <CardCarousel
                products={filteredProducts}
                onProductClick={openDetailFromCard}
              />
            )}

            {viewMode === "swipe" && (
              <SwipeView
                products={filteredProducts}
                onProductClick={openDetailFromCard}
              />
            )}
          </section>
        </main>

        <ProductDetailModal
          product={selectedProduct}
          isOpen={detailOpen}
          onClose={() => { setDetailOpen(false); setFromRandomizer(false); }}
          onCreateReview={handleCreateReview}
          onDeleteReview={handleDeleteReview}
          fromRandomizer={fromRandomizer}
          onTryAnother={handleTryAnother}
        />
        <FlavourWheelModal isOpen={wheelOpen} onClose={() => setWheelOpen(false)} />

        <CoffeeRandomizer allProducts={allProducts} onSelectCoffee={handleRandomCoffee} />
      </div>
    </>
  );
}

export default ExplorePage;
