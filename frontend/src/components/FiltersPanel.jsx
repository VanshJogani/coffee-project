import React from "react";

const FLAVOUR_CHIPS = [
  // Floral
  "Honeysuckle", "Saffron", "Greeny", "Rose", "Jasmine", "Chamomile", "Black Tea",
  // Fruity - Berry
  "Strawberry", "Raspberry", "Mulberry", "Blueberry", "Raisin", "Plum", "Dates", "Fig",
  // Fruity - Dried Fruit
  "Apricot", "Coconut", "Cherry", "Pomegranate", "Mango", "Pineapple", "Passionfruit",
  // Fruity - Other Fruit
  "Grape", "Apple", "Papaya", "Muskmelon", "Peach", "Pear",
  // Fruity - Citrus
  "Orange", "Lemon", "Lime",
  // Sour / Fermented
  "Wine", "Whiskey", "Fermented", "Overripe",
  // Green / Vegetative
  "Olive Oil", "Bay Leaf", "Coriander", "Tulsi",
  // Roasted
  "Smokey", "Grain", "Malt", "Pipe Tobacco", "Cereal",
  // Spices
  "Pepper", "Anise", "Fennel", "Cardamom", "Nutmeg", "Cinnamon", "Clove",
  // Nutty / Cocoa
  "Almond", "Hazelnut", "Cashewnut", "Peanut", "Walnut",
  "Chocolate", "Dark Chocolate", "Cocoa Nibs", "Honey", "Caramelised",
  // Sweet
  "Jaggery", "Molasses", "Sugarcane", "Vanilla",
  // Others
  "Woody", "Earthy",
];

function GroupedProcesses({ label, groupedOptions, selected, onToggle, isCollapsible, isExpanded, onToggleExpand }) {
  const [expandedGroups, setExpandedGroups] = React.useState({});

  // Initialize expanded groups - all groups start expanded
  React.useEffect(() => {
    const initial = {};
    Object.keys(groupedOptions).forEach(group => {
      initial[group] = true;
    });
    setExpandedGroups(initial);
  }, [groupedOptions]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const totalItems = Object.values(groupedOptions).reduce((sum, items) => sum + items.length, 0);
  const selectedCount = Object.values(groupedOptions).reduce(
    (sum, items) => sum + items.filter(item => selected.includes(item)).length,
    0
  );

  return (
    <div className="mb-8">
      <div 
        className={`flex items-center justify-between px-1 mb-3 ${isCollapsible ? "cursor-pointer hover:text-luxury-gold transition-colors" : ""}`}
        onClick={() => isCollapsible && onToggleExpand && onToggleExpand()}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold">
          {label}
        </div>
        {isCollapsible && (
          <svg 
            className={`w-3 h-3 text-luxury-gold transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7-7m0 0L5 14m7-7v12" />
          </svg>
        )}
      </div>

      {(!isCollapsible || isExpanded) && (
        <div className="space-y-3">
          {Object.entries(groupedOptions).map(([groupName, items]) => (
            <div key={groupName} className="mb-3">
              <button
                type="button"
                onClick={() => toggleGroup(groupName)}
                className="flex items-center gap-2 w-full text-[10px] font-bold uppercase tracking-[0.1em] text-luxury-umber hover:text-luxury-gold transition-colors mb-2"
              >
                <svg 
                  className={`w-3 h-3 transition-transform duration-200 ${expandedGroups[groupName] ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>{groupName}</span>
                <span className="text-[9px] text-luxury-clay/60 font-normal">({items.length})</span>
              </button>

              {expandedGroups[groupName] && (
                <div className="flex flex-wrap gap-2 pl-4">
                  {items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onToggle(item)}
                      className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition-all duration-300 ${
                        selected.includes(item)
                          ? "border-luxury-umber bg-luxury-umber text-white shadow-lg"
                          : "border-luxury-clay/40 bg-white text-luxury-umber/70 hover:border-luxury-gold hover:text-luxury-umber shadow-sm"
                      }`}
                    >
                      {item || "Unknown"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isCollapsible && !isExpanded && (
        <div className="text-[10px] text-luxury-clay/60">
          {selectedCount > 0 ? `${selectedCount} selected` : `${totalItems} options`}
        </div>
      )}
    </div>
  );
}

function MultiCheckbox({ label, options, selected, onToggle, searchable, isCollapsible, isExpanded, onToggleExpand, maxVisible = null }) {
  const [query, setQuery] = React.useState("");

  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => {
      const aSelected = selected.includes(a);
      const bSelected = selected.includes(b);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
  }, [options, selected]);

  const visibleOptions = React.useMemo(() => {
    if (!searchable || !query.trim()) return sortedOptions;
    return sortedOptions.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  }, [sortedOptions, query, searchable]);

  // Limit visible options if maxVisible is set and not expanded
  const displayedOptions = React.useMemo(() => {
    if (!maxVisible || isExpanded || query.trim()) return visibleOptions;
    return visibleOptions.slice(0, maxVisible);
  }, [visibleOptions, maxVisible, isExpanded, query]);

  const hasMore = maxVisible && visibleOptions.length > maxVisible && !isExpanded;

  return (
    <div className="mb-8">
      <div 
        className={`flex items-center justify-between px-1 mb-3 ${isCollapsible ? "cursor-pointer hover:text-luxury-gold transition-colors" : ""}`}
        onClick={() => isCollapsible && onToggleExpand && onToggleExpand()}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold">
          {label}
        </div>
        {isCollapsible && (
          <svg 
            className={`w-3 h-3 text-luxury-gold transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7-7m0 0L5 14m7-7v12" />
          </svg>
        )}
      </div>

      {(!isCollapsible || isExpanded) && (
        <>
          {searchable && (
            <div className="relative mb-3">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-luxury-clay/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full rounded-md border border-luxury-clay/40 bg-white pl-7 pr-3 py-1.5 text-[11px] text-luxury-umber placeholder-luxury-clay/50 focus:outline-none focus:border-luxury-gold"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-luxury-clay/50 hover:text-luxury-gold"
                >
                  ×
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {displayedOptions.map((opt) => (
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
            {searchable && query && !visibleOptions.length && (
              <p className="text-[11px] text-luxury-clay/50 px-1">No items match.</p>
            )}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => onToggleExpand && onToggleExpand()}
              className="mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-luxury-gold hover:text-luxury-umber transition-colors"
            >
              Show {visibleOptions.length - maxVisible} more
            </button>
          )}
          {isExpanded && hasMore && visibleOptions.length > maxVisible && (
            <button
              type="button"
              onClick={() => onToggleExpand && onToggleExpand()}
              className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-luxury-clay hover:text-luxury-gold transition-colors"
            >
              Show less
            </button>
          )}
        </>
      )}
      {isCollapsible && !isExpanded && (
        <div className="text-[10px] text-luxury-clay/60">
          {selected.filter(s => visibleOptions.includes(s)).length > 0 ? `${selected.filter(s => visibleOptions.includes(s)).length} selected` : "Collapsed"}
        </div>
      )}
    </div>
  );
}

function FlavourChips({ selected, onToggle }) {
  const [query, setQuery] = React.useState("");

  const filteredChips = React.useMemo(() => {
    if (!query.trim()) return FLAVOUR_CHIPS;
    return FLAVOUR_CHIPS.filter(c => c.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  // Separate selected and unselected
  const selectedChips = filteredChips.filter(c => selected.includes(c));
  const unselectedChips = filteredChips.filter(c => !selected.includes(c));

  return (
    <div className="mb-8">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 px-1">
      </div>

      {/* Search input */}
      <div className="relative mb-3">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-luxury-clay/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search tasting notes…"
          className="w-full rounded-md border border-luxury-clay/40 bg-white pl-7 pr-3 py-1.5 text-[11px] text-luxury-umber placeholder-luxury-clay/50 focus:outline-none focus:border-luxury-gold"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-luxury-clay/50 hover:text-luxury-gold text-sm"
          >
            ×
          </button>
        )}
      </div>

      {/* Selected chips shown first */}
      {selectedChips.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-luxury-umber/50 mb-1.5 px-1">
            Selected ({selectedChips.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onToggle(chip)}
                className="rounded-full border border-luxury-gold bg-luxury-gold/20 text-luxury-umber px-2.5 py-0.5 text-[11px] font-medium transition-all duration-200 shadow-sm flex items-center gap-1"
              >
                {chip}
                <svg className="w-2.5 h-2.5 text-luxury-umber/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unselected chips */}
      <div className="flex flex-wrap gap-1.5">
        {unselectedChips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onToggle(chip)}
            className="rounded-full border border-luxury-clay/40 bg-white text-luxury-umber/60 px-2.5 py-0.5 text-[11px] font-medium transition-all duration-300 hover:border-luxury-gold hover:text-luxury-umber shadow-sm"
          >
            {chip}
          </button>
        ))}
        {query && !filteredChips.length && (
          <p className="text-[11px] text-luxury-clay/50 px-1">No notes match "{query}"</p>
        )}
      </div>
    </div>
  );
}

function PriceRange({ min, max, value, onChange }) {
  const [low, high] = value;
  return (
    <div className="mb-8">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3 px-1">
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={high}
          value={low}
          onChange={(e) => onChange([Math.min(Number(e.target.value), high), high])}
          className="w-20 rounded border border-luxury-clay/40 px-2 py-1 text-[11px] text-luxury-umber focus:outline-none focus:border-luxury-gold"
          placeholder="Min"
        />
        <span className="text-luxury-clay/60 text-xs">–</span>
        <input
          type="number"
          min={low}
          max={max}
          value={high}
          onChange={(e) => onChange([low, Math.max(Number(e.target.value), low)])}
          className="w-20 rounded border border-luxury-clay/40 px-2 py-1 text-[11px] text-luxury-umber focus:outline-none focus:border-luxury-gold"
          placeholder="Max"
        />
        <span className="text-luxury-clay/60 text-[10px]">₹</span>
      </div>
      {(low > min || high < max) && (
        <button
          type="button"
          onClick={() => onChange([min, max])}
          className="mt-2 text-[10px] text-luxury-clay hover:text-luxury-gold transition-colors"
        >
          Reset price
        </button>
      )}
    </div>
  );
}

function FiltersPanel({
  selectedCategory,
  roasterOptions,
  roastTypeOptions,
  originOptions,
  processOptions,
  groupedProcessOptions,
  selectedRoasters,
  selectedRoastTypes,
  selectedOrigins,
  selectedProcesses,
  selectedFlavours,
  priceRange,
  priceMin,
  priceMax,
  onToggleRoaster,
  onToggleRoastType,
  onToggleOrigin,
  onToggleProcess,
  onToggleFlavour,
  onPriceRangeChange,
  onClear,
  expandOrigin = false,
}) {
  const roastLabel = selectedCategory === "Tea" ? "Tea Type" : "Roast Type";
  const originLabel = selectedCategory === "Tea" ? "Origin" : "Origin / Region";

  // State for collapsible sections - all collapsed by default, origin expands if coming from atlas
  const [expandedSections, setExpandedSections] = React.useState({
    price: false,
    flavour: false,
    roaster: false,
    roastType: false,
    origin: expandOrigin,
    process: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

        {/* Price Range - Collapsible */}
        <div className="mb-8">
          <div 
            className="flex items-center justify-between px-1 mb-3 cursor-pointer hover:text-luxury-gold transition-colors"
            onClick={() => toggleSection("price")}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold">
              Price Range
            </div>
            <svg 
              className={`w-3 h-3 text-luxury-gold transition-transform duration-300 ${expandedSections.price ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7-7m0 0L5 14m7-7v12" />
            </svg>
          </div>
          {expandedSections.price && (
            <PriceRange
              min={priceMin}
              max={priceMax}
              value={priceRange}
              onChange={onPriceRangeChange}
            />
          )}
        </div>

        {/* Flavour Chips - Collapsible */}
        <div className="mb-8">
          <div 
            className="flex items-center justify-between px-1 mb-3 cursor-pointer hover:text-luxury-gold transition-colors"
            onClick={() => toggleSection("flavour")}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold">
              Tasting Notes
            </div>
            <svg 
              className={`w-3 h-3 text-luxury-gold transition-transform duration-300 ${expandedSections.flavour ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7-7m0 0L5 14m7-7v12" />
            </svg>
          </div>
          {expandedSections.flavour && (
            <FlavourChips selected={selectedFlavours} onToggle={onToggleFlavour} />
          )}
        </div>

        <MultiCheckbox
          label="Roaster"
          options={roasterOptions}
          selected={selectedRoasters}
          onToggle={onToggleRoaster}
          searchable
          isCollapsible={true}
          isExpanded={expandedSections.roaster}
          onToggleExpand={() => toggleSection("roaster")}
          maxVisible={8}
        />

        <MultiCheckbox
          label={roastLabel}
          options={roastTypeOptions}
          selected={selectedRoastTypes}
          onToggle={onToggleRoastType}
          isCollapsible={true}
          isExpanded={expandedSections.roastType}
          onToggleExpand={() => toggleSection("roastType")}
        />

        {originOptions.length > 0 && (
          <MultiCheckbox
            label={originLabel}
            options={originOptions}
            selected={selectedOrigins}
            onToggle={onToggleOrigin}
            isCollapsible={true}
            isExpanded={expandedSections.origin}
            onToggleExpand={() => toggleSection("origin")}
            maxVisible={6}
          />
        )}

        {processOptions.length > 0 && (
          groupedProcessOptions && Object.keys(groupedProcessOptions).length > 0 ? (
            <GroupedProcesses
              label="Process"
              groupedOptions={groupedProcessOptions}
              selected={selectedProcesses}
              onToggle={onToggleProcess}
              isCollapsible={true}
              isExpanded={expandedSections.process}
              onToggleExpand={() => toggleSection("process")}
            />
          ) : (
            <MultiCheckbox
              label="Process"
              options={processOptions}
              selected={selectedProcesses}
              onToggle={onToggleProcess}
              isCollapsible={true}
              isExpanded={expandedSections.process}
              onToggleExpand={() => toggleSection("process")}
              maxVisible={5}
            />
          )
        )}
      </div>
    </aside>
  );
}

export default FiltersPanel;

