import { useState, useEffect, useMemo } from "react";
import api from "../api/client";

export function useFilters(selectedCategory, { initialOrigins = [] } = {}) {
  const [options, setOptions] = useState({
    roasters: [], roastTypes: [], origins: [], processes: [],
    priceMin: 0, priceMax: 10000
  });
  const [groupedProcessOptions, setGroupedProcessOptions] = useState({});

  const [selectedRoasters, setSelectedRoasters] = useState([]);
  const [selectedRoastTypes, setSelectedRoastTypes] = useState([]);
  const [selectedOrigins, setSelectedOrigins] = useState(initialOrigins);
  const [selectedProcesses, setSelectedProcesses] = useState([]);
  const [selectedFlavours, setSelectedFlavours] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 10000]);

  useEffect(() => {
    const params = selectedCategory ? { category: selectedCategory } : {};
    api.get("/products/filter-options", { params })
      .then(r => {
        const d = r.data;
        setOptions(d);
        setPriceRange([d.priceMin, d.priceMax]);
      })
      .catch(() => {});
  }, [selectedCategory]);

  // Fetch grouped processes (only non-empty ones)
  useEffect(() => {
    const params = selectedCategory ? { category: selectedCategory } : {};
    api.get("/products/grouped-processes", { params })
      .then(r => {
        if (r.data.grouped) {
          // Transform the grouped data: {categoryName: {description, methods: [...]}} 
          // into {categoryName: [...methods]}
          const transformed = {};
          Object.entries(r.data.grouped).forEach(([categoryName, categoryData]) => {
            transformed[categoryName] = categoryData.methods || [];
          });
          setGroupedProcessOptions(transformed);
        }
      })
      .catch(() => {});
  }, [selectedCategory]);

  const toggle = (setter) => (val) =>
    setter(cur => cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]);

  const clearFilters = () => {
    setSelectedRoasters([]);
    setSelectedRoastTypes([]);
    setSelectedOrigins([]);
    setSelectedProcesses([]);
    setSelectedFlavours([]);
    setPriceRange([options.priceMin, options.priceMax]);
  };

  const activeFilters = useMemo(() => ({
    roaster: selectedRoasters.join(",") || undefined,
    roastType: selectedRoastTypes.join(",") || undefined,
    origin: selectedOrigins.join(",") || undefined,
    process: selectedProcesses.join(",") || undefined,
    flavour: selectedFlavours.join(",") || undefined,
    priceMin: priceRange[0] > options.priceMin ? priceRange[0] : undefined,
    priceMax: priceRange[1] < options.priceMax ? priceRange[1] : undefined,
  }), [selectedRoasters, selectedRoastTypes, selectedOrigins, selectedProcesses,
       selectedFlavours, priceRange, options.priceMin, options.priceMax]);

  return {
    options,
    groupedProcessOptions,
    selectedRoasters, selectedRoastTypes, selectedOrigins,
    selectedProcesses, selectedFlavours, priceRange,
    setPriceRange,
    setSelectedOrigins,
    setSelectedFlavours,
    onToggleRoaster: toggle(setSelectedRoasters),
    onToggleRoastType: toggle(setSelectedRoastTypes),
    onToggleOrigin: toggle(setSelectedOrigins),
    onToggleProcess: toggle(setSelectedProcesses),
    onToggleFlavour: toggle(setSelectedFlavours),
    clearFilters,
    activeFilters,
  };
}
