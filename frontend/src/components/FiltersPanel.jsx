import React from "react";

function MultiCheckbox({ label, options, selected, onToggle }) {
  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => {
      const aSelected = selected.includes(a);
      const bSelected = selected.includes(b);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0; // Maintain alphabetical order within groups
    });
  }, [options, selected]);

  return (
    <div className="mb-8">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 px-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {sortedOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition-all duration-300 ${
              selected.includes(opt)
                ? "border-luxury-umber bg-luxury-umber text-white shadow-lg"
                : "border-luxury-clay/40 bg-white text-luxury-umber/70 hover:border-luxury-gold hover:text-luxury-umber shadow-sm"
            }`}
          >
            {opt || "Unknown"}
          </button>
        ))}
      </div>
    </div>
  );
}

function FiltersPanel({
  selectedCategory,
  roasterOptions,
  roastTypeOptions,
  originOptions,
  selectedRoasters,
  selectedRoastTypes,
  selectedOrigins,
  onToggleRoaster,
  onToggleRoastType,
  onToggleOrigin,
  onClear
}) {
  const roastLabel = selectedCategory === "Tea" ? "Tea Type" : "Roast Type";
  const originLabel = selectedCategory === "Tea" ? "Origin" : "Origin / Farm";

  return (
    <aside className="w-full md:w-72 md:shrink-0 md:pr-4 mb-6 md:mb-0">
      <div className="md:sticky md:top-32 md:max-h-[calc(100vh-9rem)] overflow-y-auto pr-4 scrollbar-hide">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-luxury-clay/20">
          <h2 className="text-xs font-bold uppercase tracking-widest text-luxury-umber italic">Filters</h2>
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] font-bold uppercase tracking-widest text-luxury-clay hover:text-luxury-gold transition-colors"
          >
            Reset
          </button>
        </div>
      <MultiCheckbox
        label="Roaster"
        options={roasterOptions}
        selected={selectedRoasters}
        onToggle={onToggleRoaster}
      />
      <MultiCheckbox
        label={roastLabel}
        options={roastTypeOptions}
        selected={selectedRoastTypes}
        onToggle={onToggleRoastType}
      />
      <MultiCheckbox
        label={originLabel}
        options={originOptions}
        selected={selectedOrigins}
        onToggle={onToggleOrigin}
      />
      </div>
    </aside>
  );
}

export default FiltersPanel;
