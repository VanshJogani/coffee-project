import React, { useState, useEffect, useRef } from "react";
import { useFilters } from "../hooks/useFilters";
import { useProducts } from "../hooks/useProducts";
import { useProductDetail } from "../hooks/useProductDetail";
import { fetchProduct, fetchProducts } from "../api/client";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import MobileFilterSheet from "../components/MobileFilterSheet";
import SkeletonCard from "../components/SkeletonCard";

const CATEGORIES = ["Coffee", "Tea", "Accessories", "Events", "Subscriptions"];

function ExplorePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState("Coffee");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("discover");
  const [viewMode, setViewMode] = useState("grid");
  const [wheelOpen, setWheelOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [atlasOrigin, setAtlasOrigin] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const debounceRef = useRef(null);

  // Read origin from URL params (from Coffee Atlas navigation)
  const urlOrigin = searchParams.get("origin");
  const initialOrigins = urlOrigin ? [urlOrigin] : [];

  // Track atlas origin for the banner
  useEffect(() => {
    if (urlOrigin) {
      setAtlasOrigin(urlOrigin);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search input by 350ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const filters = useFilters(selectedCategory, { initialOrigins });
  const { products, page, setPage, totalPages, loading, error } = useProducts({
    category: selectedCategory,
    search: debouncedSearch,
    sort,
    activeFilters: filters.activeFilters,
  });
  const detail = useProductDetail();

  // Track initial load for skeleton vs full-screen loading
  useEffect(() => {
    if (!loading && initialLoad) setInitialLoad(false);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    filters.clearFilters();
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
    setAtlasOrigin(null);
    setSearchParams({});
  };

  const handleClearAtlasFilter = () => {
    setAtlasOrigin(null);
    filters.setSelectedOrigins([]);
    setSearchParams({});
  };

  const handleRandomCoffee = async (product) => {
    await detail.openDetail(product, true);
  };

  const handleTryAnother = async () => {
    const data = await fetchProducts({ category: "Coffee", sort: "discover", limit: 200, page: 1, _bust: Date.now() });
    const pool = data.data || [];
    if (!pool.length) return;
    const random = pool[Math.floor(Math.random() * pool.length)];
    const full = await fetchProduct(random.id);
    detail.openDetail({ ...full, variants: full.variants || [] }, true);
  };

  return (
    <>
      {loading && initialLoad && <LoadingScreen />}
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
                    <div className="flex items-center gap-2">
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
                    <button
                      onClick={() => navigate("/map")}
                      className="flex items-center gap-1.5 px-3 py-1 bg-luxury-gold/10 text-luxury-gold hover:bg-luxury-gold/25 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border border-luxury-gold/20"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 13l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 4V7" />
                      </svg>
                      Coffee Map
                    </button>
                    </div>
                  </div>
                  <p className="text-xs text-luxury-clay opacity-80 font-medium uppercase tracking-[0.2em] mt-0.5">
                    Curated Indian Specialty Coffee
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
                    className={`px-3 py-2 min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                      viewMode === key ? "bg-luxury-gold/20 text-luxury-gold" : "text-luxury-clay hover:text-white"
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
          <div className="container-page flex items-center gap-4 md:gap-8 py-0 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                className={`min-h-[44px] pb-3 pt-3 px-1 text-xs md:text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? "border-luxury-gold text-luxury-light"
                    : "border-transparent text-luxury-clay hover:text-luxury-light hover:border-luxury-clay/30"
                }`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        <main className="container-page py-8 md:py-12 flex flex-col gap-6">
          {/* Atlas origin banner */}
          {atlasOrigin && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-luxury-gold/10 border border-luxury-gold/25 backdrop-blur-sm -mb-2">
              <span className="text-base">🗺️</span>
              <span className="text-xs font-medium text-luxury-umber">
                Showing coffees from <strong className="text-luxury-gold">{atlasOrigin}</strong>
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleClearAtlasFilter}
                  className="text-[10px] font-bold uppercase tracking-widest text-luxury-clay hover:text-luxury-gold transition-colors"
                >
                  View All
                </button>
                <span className="text-luxury-clay/30">|</span>
                <button
                  onClick={() => navigate("/map")}
                  className="text-[10px] font-bold uppercase tracking-widest text-luxury-clay hover:text-luxury-gold transition-colors"
                >
                  Back to Atlas
                </button>
              </div>
            </div>
          )}

          {/* Mobile filter trigger */}
          {viewMode === "grid" && (
            <div className="flex items-center gap-3 md:hidden">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-luxury-clay/25 bg-white shadow-sm hover:border-luxury-gold transition-all min-h-[44px]"
              >
                <svg className="w-4 h-4 text-luxury-umber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="text-xs font-bold text-luxury-umber">Filters</span>
                {(filters.selectedRoasters.length + filters.selectedRoastTypes.length + filters.selectedOrigins.length + filters.selectedProcesses.length + filters.selectedFlavours.length) > 0 && (
                  <span className="bg-luxury-gold text-luxury-umber text-[10px] font-bold min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                    {filters.selectedRoasters.length + filters.selectedRoastTypes.length + filters.selectedOrigins.length + filters.selectedProcesses.length + filters.selectedFlavours.length}
                  </span>
                )}
              </button>
              <div className="flex-1">
                <SearchBar value={searchInput} onChange={setSearchInput} />
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-8">
            {viewMode === "grid" && (
            <div className="hidden md:block">
              <FiltersPanel
                selectedCategory={selectedCategory}
                roasterOptions={filters.options.roasters}
                roastTypeOptions={filters.options.roastTypes}
                originOptions={filters.options.origins}
                processOptions={filters.options.processes}
                groupedProcessOptions={filters.groupedProcessOptions}
                selectedRoasters={filters.selectedRoasters}
                selectedRoastTypes={filters.selectedRoastTypes}
                selectedOrigins={filters.selectedOrigins}
                selectedProcesses={filters.selectedProcesses}
                selectedFlavours={filters.selectedFlavours}
                priceRange={filters.priceRange}
                priceMin={filters.options.priceMin}
                priceMax={filters.options.priceMax}
                onToggleRoaster={filters.onToggleRoaster}
                onToggleRoastType={filters.onToggleRoastType}
                onToggleOrigin={filters.onToggleOrigin}
                onToggleProcess={filters.onToggleProcess}
                onToggleFlavour={filters.onToggleFlavour}
                onPriceRangeChange={filters.setPriceRange}
                onClear={filters.clearFilters}
                expandOrigin={!!atlasOrigin}
              />
            </div>
          )}
          <section className="flex-1 flex flex-col">
            {viewMode === "grid" && (
              <div className="mb-3 hidden md:block">
                <SearchBar value={searchInput} onChange={setSearchInput} />
              </div>
            )}
            {error && <div className="py-2 text-sm text-red-600" role="alert">{error}</div>}
            {!loading && !products.length && (
              <div className="py-10 text-center text-sm text-slate-500">No products match your filters.</div>
            )}

            {viewMode === "grid" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {loading && !initialLoad ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                  ) : (
                    products.map(p => (
                      <ProductCard key={p.id} product={p} onClick={() => detail.openDetail(p)} />
                    ))
                  )}
                </div>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </>
            )}

            {viewMode === "cards" && (
              <CardCarousel products={products} onProductClick={p => detail.openDetail(p)} />
            )}

            {viewMode === "swipe" && (
              <SwipeView products={products} onProductClick={p => detail.openDetail(p)} />
            )}
          </section>
          </div>
        </main>

        <ProductDetailModal
          product={detail.selectedProduct}
          isOpen={detail.detailOpen}
          onClose={detail.closeDetail}
          onCreateReview={detail.handleCreateReview}
          onDeleteReview={detail.handleDeleteReview}
          fromRandomizer={detail.fromRandomizer}
          onTryAnother={handleTryAnother}
        />
        <FlavourWheelModal
          isOpen={wheelOpen}
          onClose={() => setWheelOpen(false)}
          onFlavourSelect={(flavour) => filters.setSelectedFlavours([flavour])}
        />
        <MobileFilterSheet
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          filterProps={{
            selectedCategory,
            roasterOptions: filters.options.roasters,
            roastTypeOptions: filters.options.roastTypes,
            originOptions: filters.options.origins,
            processOptions: filters.options.processes,
            groupedProcessOptions: filters.groupedProcessOptions,
            selectedRoasters: filters.selectedRoasters,
            selectedRoastTypes: filters.selectedRoastTypes,
            selectedOrigins: filters.selectedOrigins,
            selectedProcesses: filters.selectedProcesses,
            selectedFlavours: filters.selectedFlavours,
            priceRange: filters.priceRange,
            priceMin: filters.options.priceMin,
            priceMax: filters.options.priceMax,
            onToggleRoaster: filters.onToggleRoaster,
            onToggleRoastType: filters.onToggleRoastType,
            onToggleOrigin: filters.onToggleOrigin,
            onToggleProcess: filters.onToggleProcess,
            onToggleFlavour: filters.onToggleFlavour,
            onPriceRangeChange: filters.setPriceRange,
            onClear: filters.clearFilters,
            expandOrigin: !!atlasOrigin,
          }}
          activeFilterCount={
            filters.selectedRoasters.length + filters.selectedRoastTypes.length +
            filters.selectedOrigins.length + filters.selectedProcesses.length +
            filters.selectedFlavours.length
          }
        />
        <CoffeeRandomizer onSelectCoffee={handleRandomCoffee} />
      </div>
    </>
  );
}

export default ExplorePage;
