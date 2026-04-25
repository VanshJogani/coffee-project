import { useState, useEffect, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import { fetchProducts } from "../api/client";

const PAGE_SIZE = 24;

export function useProducts({ category, search, sort, activeFilters }) {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const isFirstLoad = useRef(true);
  const prevFiltersKey = useRef("");

  // Serialize activeFilters to a stable string so we can use it in deps
  const filtersKey = useMemo(() => {
    const entries = Object.entries(activeFilters)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
  }, [activeFilters]);

  // Reset to page 1 when filters/search/sort/category change
  useEffect(() => {
    if (prevFiltersKey.current !== "" && prevFiltersKey.current !== filtersKey) {
      setPage(1);
    }
    prevFiltersKey.current = filtersKey;
  }, [filtersKey, category, search, sort]);

  // Single fetch effect
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError("");
      try {
        const cleanFilters = Object.fromEntries(
          Object.entries(activeFilters).filter(([, v]) => v !== undefined)
        );
        const params = {
          page,
          limit: PAGE_SIZE,
          sort: sort === "discover" ? "discover" : sort,
          ...(category ? { category } : {}),
          ...cleanFilters,
          ...(search ? { search } : {}),
        };
        const data = await fetchProducts(params);
        if (cancelled) return;

        let rows = data.data || [];

        // Client-side fuzzy re-rank when search is present
        if (search && rows.length > 0) {
          const fuse = new Fuse(rows, {
            keys: ["name", "roaster", "tastingNotes", "origin", "description"],
            threshold: 0.4,
          });
          const results = fuse.search(search);
          if (results.length > 0) rows = results.map(r => r.item);
        }

        setProducts(rows);
        setTotal(data.pagination?.total ?? 0);
      } catch {
        if (!cancelled) setError("Failed to load products.");
      } finally {
        if (!cancelled) {
          if (isFirstLoad.current) {
            isFirstLoad.current = false;
            setInitialLoading(false);
          }
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [page, category, search, sort, filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { products, total, page, setPage, totalPages, loading: initialLoading, error };
}
