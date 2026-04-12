import React, { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { fetchProducts, fetchProduct, createReview, deleteReview } from "./api/client";
import ProductCard from "./components/ProductCard";
import SearchBar from "./components/SearchBar";
import SortSelect from "./components/SortSelect";
import FiltersPanel from "./components/FiltersPanel";
import Pagination from "./components/Pagination";
import ProductDetailModal from "./components/ProductDetailModal";
import FlavourWheelModal from "./components/FlavourWheelModal";
import LoadingScreen from "./components/LoadingScreen";

function App() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("rating");
  const [selectedCategory, setSelectedCategory] = useState("Coffee");
  const [selectedRoasters, setSelectedRoasters] = useState([]);
  const [selectedRoastTypes, setSelectedRoastTypes] = useState([]);
  const [selectedOrigins, setSelectedOrigins] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 24;

  const loadAllProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: 1,
        limit: 5000,
        sort: "newest"
      };
      const data = await fetchProducts(params);
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
        if (!groupedMap.has(key)) {
          groupedMap.set(key, { ...p, variants: [] });
        }
        groupedMap.get(key).variants.push({
          id: p.id,
          quantity: p.quantity || "Standard",
          price: p.price
        });
      }

      const groupedProducts = Array.from(groupedMap.values());
      groupedProducts.forEach(g => {
        g.variants.sort((a,b) => {
          if (a.price == null && b.price != null) return 1;
          if (b.price == null && a.price != null) return -1;
          return (a.price || 0) - (b.price || 0);
        });
        
        const validVariants = g.variants.filter(v => v.price != null);
        if (validVariants.length > 0) {
          g.price = validVariants[0].price;
        } else if (g.variants.length > 0) {
          g.price = g.variants[0].price;
        }
      });

      setAllProducts(groupedProducts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllProducts();
  }, []);

  const categoryFilteredProducts = useMemo(() => {
    if (!selectedCategory) return allProducts;
    return allProducts.filter((p) => p.category === selectedCategory);
  }, [allProducts, selectedCategory]);

  const roasterOptions = useMemo(
    () => Array.from(new Set(categoryFilteredProducts.map((p) => p.roaster).filter(Boolean))).sort(),
    [categoryFilteredProducts]
  );
  const roastTypeOptions = useMemo(
    () => Array.from(new Set(categoryFilteredProducts.map((p) => p.roastType).filter(Boolean))).sort(),
    [categoryFilteredProducts]
  );
  const originOptions = useMemo(
    () => Array.from(new Set(categoryFilteredProducts.map((p) => p.origin).filter(Boolean))).sort(),
    [categoryFilteredProducts]
  );

  // Client-side filtering + fuzzy search + sorting over the full dataset
  const filteredProducts = useMemo(() => {
    let items = allProducts;

    if (selectedCategory) {
      items = items.filter((p) => p.category === selectedCategory);
    }

    if (selectedRoasters.length) {
      items = items.filter((p) => selectedRoasters.includes(p.roaster));
    }
    if (selectedRoastTypes.length) {
      items = items.filter((p) => selectedRoastTypes.includes(p.roastType));
    }
    if (selectedOrigins.length) {
      items = items.filter((p) => selectedOrigins.includes(p.origin));
    }

    if (search) {
      const fuse = new Fuse(items, {
        keys: ["name", "roaster", "tastingNotes", "origin"],
        threshold: 0.35
      });
      items = fuse.search(search).map((r) => r.item);
    }

      const sorted = [...items];
      sorted.sort((a, b) => {
        switch (sort) {
          case "rating":
            return (b.avgRating || 0) - (a.avgRating || 0);
          case "roastType":
            return (a.roastType || "").localeCompare(b.roastType || "") ||
              (a.name || "").localeCompare(b.name || "");
          case "priceAsc":
            if (!a.price && b.price) return 1;
            if (a.price && !b.price) return -1;
            return (a.price || 0) - (b.price || 0);
          case "priceDesc":
            if (!a.price && b.price) return 1;
            if (a.price && !b.price) return -1;
            return (b.price || 0) - (a.price || 0);
          case "newest":
          default:
            return (new Date(b.cuppingDate || 0) - new Date(a.cuppingDate || 0)) ||
              (b.id || 0) - (a.id || 0);
        }
      });
  
      return sorted;
    }, [allProducts, selectedCategory, selectedRoasters, selectedRoastTypes, selectedOrigins, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  const displayedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, sort, selectedCategory, selectedRoasters, selectedRoastTypes, selectedOrigins]);

  const handleToggle = (current, value) =>
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

  const openDetail = async (product) => {
    try {
      const full = await fetchProduct(product.id);
      setSelectedProduct({ ...full, variants: product.variants });
      setDetailOpen(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const handleCreateReview = async (payload) => {
    const created = await createReview(payload);
    setSelectedProduct((prev) =>
      !prev ? prev : { ...prev, reviews: [created, ...(prev.reviews || [])] }
    );
    await loadAllProducts();
  };

  const handleDeleteReview = async (id) => {
    await deleteReview(id);
    setSelectedProduct((prev) =>
      !prev ? prev : { ...prev, reviews: (prev.reviews || []).filter((r) => r.id !== id) }
    );
    await loadAllProducts();
  };

  const handleClearFilters = () => {
    setSelectedRoasters([]);
    setSelectedRoastTypes([]);
    setSelectedOrigins([]);
  };

  return (
    <>
      {loading && <LoadingScreen />}
      <div className="min-h-screen stone-gradient">
      <header className="border-b border-luxury-clay/20 bg-luxury-umber text-white shelf-glow overflow-hidden sticky top-0 z-50">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-luxury-gold/50 via-luxury-gold to-luxury-gold/50 opacity-30" />
        <div className="container-page py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-luxury-gold/10 flex items-center justify-center border border-luxury-gold/20">
              <span className="text-2xl">☕</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-luxury-light">Caffè Elegante</h1>
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
          <div className="flex items-center gap-3">
            <SortSelect value={sort} onChange={setSort} />
          </div>
        </div>
        <div className="container-page flex items-center gap-8 py-0">
          {["Coffee", "Tea", "Accessories", "Subscriptions"].map(cat => (
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
        <FiltersPanel
          selectedCategory={selectedCategory}
          roasterOptions={roasterOptions}
          roastTypeOptions={roastTypeOptions}
          originOptions={originOptions}
          selectedRoasters={selectedRoasters}
          selectedRoastTypes={selectedRoastTypes}
          selectedOrigins={selectedOrigins}
          onToggleRoaster={(v) => setSelectedRoasters((cur) => handleToggle(cur, v))}
          onToggleRoastType={(v) => setSelectedRoastTypes((cur) => handleToggle(cur, v))}
          onToggleOrigin={(v) => setSelectedOrigins((cur) => handleToggle(cur, v))}
          onClear={handleClearFilters}
        />

        <section className="flex-1 flex flex-col">
          <div className="mb-3">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          {loading && (
            <div className="py-10 text-center text-sm text-slate-500">Loading coffees…</div>
          )}
          {error && (
            <div className="py-2 text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
          {!loading && !filteredProducts.length && (
            <div className="py-10 text-center text-sm text-slate-500">
              No coffees match your filters yet.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedProducts.map((p) => (
              <ProductCard key={p.id} product={p} onClick={() => openDetail(p)} />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </section>
      </main>

      <ProductDetailModal
        product={selectedProduct}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onCreateReview={handleCreateReview}
        onDeleteReview={handleDeleteReview}
      />

      <FlavourWheelModal 
        isOpen={wheelOpen} 
        onClose={() => setWheelOpen(false)} 
      />
    </div>
    </>
  );
}

export default App;

