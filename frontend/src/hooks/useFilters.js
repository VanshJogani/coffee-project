import { useState, useEffect, useMemo } from "react";
import api from "../api/client";

export function useFilters(selectedCategory) {
  const [options, setOptions] = useState({
    roasters: [], roastTypes: [], origins: [], processes: [],
    priceMin: 0, priceMax: 10000
  });

  const [selectedRoasters, setSelectedRoasters] = useState([]);
  const [selectedRoastTypes, setSelectedRoastTypes] = useState([]);
  const [selectedOrigins, setSelectedOrigins] = useState([]);
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
    origin: selectedOrigins.length === 1 ? selectedOrigins[0] : undefined,
    process: selectedProcesses.join(",") || undefined,
    flavour: selectedFlavours.join(",") || undefined,
    priceMin: priceRange[0] > options.priceMin ? priceRange[0] : undefined,
    priceMax: priceRange[1] < options.priceMax ? priceRange[1] : undefined,
  }), [selectedRoasters, selectedRoastTypes, selectedOrigins, selectedProcesses,
       selectedFlavours, priceRange, options.priceMin, options.priceMax]);

  return {
    options,
    selectedRoasters, selectedRoastTypes, selectedOrigins,
    selectedProcesses, selectedFlavours, priceRange,
    setPriceRange,
    onToggleRoaster: toggle(setSelectedRoasters),
    onToggleRoastType: toggle(setSelectedRoastTypes),
    onToggleOrigin: toggle(setSelectedOrigins),
    onToggleProcess: toggle(setSelectedProcesses),
    onToggleFlavour: toggle(setSelectedFlavours),
    clearFilters,
    activeFilters,
  };
}
