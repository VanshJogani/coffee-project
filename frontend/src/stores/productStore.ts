import { create } from "zustand";
import type { Product, FilterOptions, ActiveFilters, PaginationInfo } from "../types";

interface ProductState {
  products: Product[];
  pagination: PaginationInfo;
  filterOptions: FilterOptions;
  activeFilters: ActiveFilters;
  loading: boolean;
  initialLoad: boolean;

  // Actions
  setProducts: (products: Product[], pagination: PaginationInfo) => void;
  setFilterOptions: (options: FilterOptions) => void;
  setFilter: <K extends keyof ActiveFilters>(key: K, value: ActiveFilters[K]) => void;
  resetFilters: () => void;
  setLoading: (loading: boolean) => void;
  setInitialLoad: (loading: boolean) => void;
  setPage: (page: number) => void;
}

const DEFAULT_FILTERS: ActiveFilters = {
  roaster: [],
  roastType: [],
  origin: [],
  process: [],
  flavour: [],
  priceMin: null,
  priceMax: null,
  category: "Coffee",
  search: "",
  sort: "newest",
};

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filterOptions: { roasters: [], roastTypes: [], origins: [], processes: [], priceMin: 0, priceMax: 10000 },
  activeFilters: { ...DEFAULT_FILTERS },
  loading: false,
  initialLoad: true,

  setProducts: (products, pagination) => set({ products, pagination, loading: false }),
  setFilterOptions: (options) => set({ filterOptions: options }),
  setFilter: (key, value) =>
    set((state) => ({
      activeFilters: { ...state.activeFilters, [key]: value },
      pagination: { ...state.pagination, page: 1 }, // Reset to page 1 on filter change
    })),
  resetFilters: () => set({ activeFilters: { ...DEFAULT_FILTERS } }),
  setLoading: (loading) => set({ loading }),
  setInitialLoad: (loading) => set({ initialLoad: loading }),
  setPage: (page) => set((state) => ({ pagination: { ...state.pagination, page } })),
}));
