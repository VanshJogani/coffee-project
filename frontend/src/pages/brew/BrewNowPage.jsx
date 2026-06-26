import React, { useEffect, useReducer, useRef, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchRecipes, fetchCommunityRecipes, createBrewLog, createRecipe, fetchProducts, fetchInventory } from "../../api/client";

// ── Constants ────────────────────────────────────────────────────────────────
const POUROVER_METHODS = ["v60", "chemex", "kalita", "clever", "origami", "pourover", "pour over", "dripper"];
const POUR_FLASH_SEC = 5;
const ROAST_LEVELS = ["Light", "Medium-Light", "Medium", "Medium-Dark", "Dark"];
const COFFEE_BRANDS = ["Blue Tokai", "Greysoul", "Fraction9", "Corridors of Power", "Bloom", "Savorworks", "Subko", "KC Roasters", "Curious Life", "Other"];

const EQUIPMENT_PRESETS = [
  { id: "v60", label: "V60 Standard", brewerName: "V60", grindSize: "Medium-Fine", waterTempC: "93", coffeeGrams: "15", waterGrams: "250" },
  { id: "aeropress", label: "AeroPress Classic", brewerName: "AeroPress", grindSize: "Medium-Fine", waterTempC: "85", coffeeGrams: "15", waterGrams: "200" },
  { id: "french-press", label: "French Press", brewerName: "French Press", grindSize: "Coarse", waterTempC: "93", coffeeGrams: "30", waterGrams: "500" },
  { id: "chemex", label: "Chemex", brewerName: "Chemex", grindSize: "Medium-Coarse", waterTempC: "94", coffeeGrams: "25", waterGrams: "400" },
  { id: "moka-pot", label: "Moka Pot", brewerName: "Moka Pot", grindSize: "Medium-Fine", waterTempC: "100", coffeeGrams: "18", waterGrams: "90" },
  { id: "espresso", label: "Espresso", brewerName: "Espresso", grindSize: "Fine", waterTempC: "93", coffeeGrams: "18", waterGrams: "36" },
];

// ── Coffee Search Picker ─────────────────────────────────────────────────────
function CoffeeSearchPicker({ value, onChange }) {
  const [query, setQuery] = useState(value ? `${value.name}` : "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Keep input in sync if value cleared externally
  useEffect(() => { if (!value) setQuery(""); }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || value) { if (!value) { setResults([]); setOpen(false); } return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchProducts({ search: query, limit: 8, category: "Coffee" });
        setResults(res.data || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, value]);

  const handleSelect = (product) => {
    onChange(product);
    setQuery(product.name);
    setOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null); }}
          placeholder="Search by name, roaster, origin..."
          className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 pr-8 text-sm focus:outline-none focus:border-luxury-gold bg-white"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-luxury-gold/40 border-t-luxury-gold rounded-full animate-spin" />
        )}
        {(value || query) && !loading && (
          <button type="button" onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-luxury-clay/50 hover:text-luxury-clay text-lg leading-none">
            ×
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-luxury-clay/20 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} type="button"
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3 py-2.5 hover:bg-luxury-gold/5 border-b border-luxury-clay/10 last:border-0 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-luxury-umber truncate">{p.name}</div>
                  <div className="text-[10px] text-luxury-clay mt-0.5">
                    {p.roaster}
                    {p.roastType && <span className="ml-1.5">· {p.roastType}</span>}
                    {p.origin && <span className="ml-1.5">· {p.origin}</span>}
                  </div>
                </div>
                {p.price && <span className="shrink-0 text-[10px] font-bold text-luxury-gold">₹{p.price}</span>}
              </div>
              {p.tastingNotes && (
                <div className="text-[10px] text-luxury-clay/60 mt-0.5 italic truncate">{p.tastingNotes}</div>
              )}
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && query.trim() && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-luxury-clay/20 rounded-xl shadow-xl px-4 py-3 text-sm text-luxury-clay/60">
          No coffees found
        </div>
      )}
    </div>
  );
}

// ── Pure helpers ─────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }
function fmtElapsed(sec) {
  if (sec == null || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${pad(Math.abs(sec) % 60)}`;
}

function isPourover(brewerType) {
  if (!brewerType) return false;
  const lower = brewerType.toLowerCase();
  return POUROVER_METHODS.some(m => lower.includes(m));
}

function derivePourSchedule(steps, totalWater) {
  const pourSteps = (steps || []).filter(s => s.pourGrams > 0);
  if (pourSteps.length === 0) return null;
  const pours = pourSteps.map((step, i) => ({
    pourGrams: step.pourGrams,
    intervalSec: i === 0 ? step.timeSec || 0 : (step.timeSec || 0) - (pourSteps[i - 1].timeSec || 0),
    instruction: step.instruction || `Pour ${step.pourGrams}g`,
    absoluteTimeSec: step.timeSec || 0,
  }));
  return { pours, totalWater: totalWater || pours.reduce((s, p) => s + p.pourGrams, 0) };
}

function buildQuickSchedule(numPours, intervalSec, totalWater) {
  if (!numPours || numPours < 1 || !totalWater) return null;
  const base = Math.round(totalWater / numPours);
  const pours = Array.from({ length: numPours }, (_, i) => ({
    pourGrams: i === numPours - 1 ? totalWater - base * (numPours - 1) : base,
    intervalSec: i === 0 ? 0 : intervalSec,
    instruction: `Pour ${i + 1} of ${numPours}`,
    absoluteTimeSec: i * intervalSec,
  }));
  return { pours, totalWater };
}

function computePourState(elapsed, schedule) {
  if (!schedule || !schedule.pours.length) return null;
  const { pours, totalWater } = schedule;
  let pourIdx = 0;
  for (let i = 0; i < pours.length; i++) {
    if (elapsed >= pours[i].absoluteTimeSec) pourIdx = i;
    else break;
  }
  const current = pours[pourIdx];
  const next = pours[pourIdx + 1];
  const timeSincePour = elapsed - current.absoluteTimeSec;
  const isPouring = timeSincePour < POUR_FLASH_SEC;
  const nextPourIn = next ? next.absoluteTimeSec - elapsed : null;
  const allDone = pourIdx === pours.length - 1 && !isPouring;
  return {
    pourIndex: pourIdx, totalPours: pours.length, isPouring, allDone,
    pourGrams: current.pourGrams, instruction: current.instruction,
    nextPourIn, nextPourGrams: next?.pourGrams ?? null,
    cumulativeGrams: pours.slice(0, pourIdx + 1).reduce((s, p) => s + p.pourGrams, 0),
    totalWater,
  };
}

// ── Timer reducer ────────────────────────────────────────────────────────────
const INITIAL_TIMER = { state: "idle", elapsed: 0 };
function timerReducer(st, action) {
  switch (action.type) {
    case "START":    return { ...st, state: "running" };
    case "PAUSE":    return { ...st, state: "paused" };
    case "RESUME":   return { ...st, state: "running" };
    case "TICK":     return { ...st, elapsed: st.elapsed + 1 };
    case "RESET":    return INITIAL_TIMER;
    case "COMPLETE": return { ...st, state: "complete" };
    default: return st;
  }
}

// ── Rating stars ─────────────────────────────────────────────────────────────
function RatingStars({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`text-xl transition-colors ${n <= value ? "text-luxury-gold" : "text-luxury-clay/30 hover:text-luxury-gold/50"}`}>
          &#9733;
        </button>
      ))}
    </div>
  );
}

// ── Compact circular timer (embedded in brew shelf) ─────────────────────────
function CompactTimer({ elapsed, target, state }) {
  const radius = 58;
  const circ = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(1, elapsed / target) : 0;
  const dash = circ * pct;
  const color = state === "complete" ? "#22c55e" : state === "paused" ? "#d4a853" : "#5c3b1e";
  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f0ebe3" strokeWidth="6" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-luxury-umber">{fmtElapsed(elapsed)}</span>
        {target > 0 && (
          <span className="text-[9px] uppercase tracking-widest text-luxury-clay mt-0.5">
            / {fmtElapsed(target)}
          </span>
        )}
        {state === "complete" && (
          <span className="text-[10px] font-bold text-green-500 mt-0.5">Done!</span>
        )}
      </div>
    </div>
  );
}

// ── Pour status banner ───────────────────────────────────────────────────────
function PourStatusBanner({ pourState }) {
  if (!pourState) return null;
  const { isPouring, allDone, pourIndex, totalPours, pourGrams, instruction, nextPourIn, nextPourGrams } = pourState;

  if (allDone) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
        <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest">All pours complete</div>
        <p className="text-xs text-green-700 mt-0.5">Let it draw down...</p>
      </div>
    );
  }
  if (isPouring) {
    return (
      <div className="bg-luxury-gold/20 border-2 border-luxury-gold rounded-xl p-3 text-center animate-pulse">
        <div className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold mb-0.5">
          Pour {pourIndex + 1} of {totalPours}
        </div>
        <div className="text-xl font-bold text-luxury-umber">POUR NOW</div>
        <div className="text-base font-bold text-luxury-gold">{pourGrams}g</div>
        {instruction && <p className="text-[10px] text-luxury-clay mt-0.5">{instruction}</p>}
      </div>
    );
  }
  return (
    <div className="bg-luxury-umber/5 border border-luxury-umber/20 rounded-xl p-2.5 text-center">
      <div className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold mb-0.5">Next pour in</div>
      <div className="text-xl font-bold tabular-nums text-luxury-umber">
        {nextPourIn != null ? fmtElapsed(nextPourIn) : "\u2014"}
      </div>
      {nextPourGrams != null && (
        <div className="text-[10px] text-luxury-clay mt-0.5">
          Pour {pourIndex + 2} \u2014 {nextPourGrams}g
        </div>
      )}
    </div>
  );
}

// ── Pour progress bar ────────────────────────────────────────────────────────
function PourProgress({ pourState, schedule }) {
  if (!pourState || !schedule) return null;
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {schedule.pours.map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${
            i <= pourState.pourIndex ? "bg-luxury-gold" : "bg-luxury-clay/15"
          }`} />
        ))}
      </div>
      <div className="text-center text-[10px] text-luxury-clay">
        {pourState.pourIndex + 1} of {pourState.totalPours} pours
        <span className="mx-1">&middot;</span>
        {pourState.cumulativeGrams}g / {pourState.totalWater}g
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function BrewNowPage() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState([]);
  const [communityRecipes, setCommunityRecipes] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Setup form
  const [selectedRoastLevel, setSelectedRoastLevel] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedCoffee, setSelectedCoffee] = useState(null); // DB product picked from search
  const [selectedRecipeId, setSelectedRecipeId] = useState(navState?.recipeId ? String(navState.recipeId) : "");
  const defaultPreset = EQUIPMENT_PRESETS[0]; // V60 Standard
  const prefill = navState?.prefill;
  const [selectedPresetId, setSelectedPresetId] = useState(navState?.recipeId ? null : prefill ? null : defaultPreset.id);
  const [setup, setSetup] = useState({
    brewerName: prefill?.brewerName || (navState?.recipeId ? "" : defaultPreset.brewerName),
    grinderName: prefill?.grinderName || "",
    grindSize: prefill?.grindSize || (navState?.recipeId ? "" : defaultPreset.grindSize),
    coffeeGrams: prefill?.coffeeGrams ?? (navState?.recipeId ? "" : defaultPreset.coffeeGrams),
    waterGrams: prefill?.waterGrams ?? (navState?.recipeId ? "" : defaultPreset.waterGrams),
    waterTempC: prefill?.waterTempC ?? (navState?.recipeId ? "" : defaultPreset.waterTempC),
    notes: "",
  });
  const [overridesOpen, setOverridesOpen] = useState(false);

  // Brew phase
  const [brewPhase, setBrewPhase] = useState("setup"); // "setup" | "brewing" | "complete"
  const [prepChecked, setPrepChecked] = useState(new Set());

  // Timer
  const [timer, dispatch] = useReducer(timerReducer, INITIAL_TIMER);
  const intervalRef = useRef(null);

  // Pour schedule (pourover mode)
  const [quickSetup, setQuickSetup] = useState({ numPours: 3, intervalSec: 30 });

  // Post-brew log form
  const [logRating, setLogRating] = useState(0);
  const [logNotes, setLogNotes] = useState("");
  const [logPublic, setLogPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Bean inventory
  const [beanInventory, setBeanInventory] = useState([]);
  const [selectedBeanInventoryId, setSelectedBeanInventoryId] = useState(navState?.beanId ? Number(navState.beanId) : null);

  // Save as recipe
  const [showSaveRecipe, setShowSaveRecipe] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);

  // Load data
  useEffect(() => {
    Promise.all([fetchRecipes(), fetchCommunityRecipes(), fetchInventory().catch(() => [])])
      .then(([r, c, inv]) => {
        setRecipes(r);
        setCommunityRecipes(c);
        setBeanInventory(inv || []);
        // If navigated from BeansPage with a beanId, auto-select that bean
        if (navState?.beanId) {
          const bean = (inv || []).find(b => b.id === Number(navState.beanId));
          if (bean) {
            setSelectedBeanInventoryId(bean.id);
            if (bean.displayName && bean.displayName !== "Unknown Bean") {
              setSelectedCoffee({ id: bean.productId, name: bean.displayName, roaster: bean.displayRoaster, roastType: bean.roastType });
            }
            if (bean.roastType) {
              const match = ROAST_LEVELS.find(rl => bean.roastType.toLowerCase().includes(rl.toLowerCase()));
              if (match) setSelectedRoastLevel(match);
            }
            if (bean.displayRoaster) setSelectedBrand(bean.displayRoaster);
          }
        }
      })
      .finally(() => setLoadingData(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill setup from selected recipe
  const selectedRecipe = recipes.find(r => String(r.id) === String(selectedRecipeId));
  const steps = selectedRecipe?.steps || [];
  const prepSteps = steps.filter(s => s.phase === "prep");
  const brewSteps = steps.filter(s => s.phase !== "prep");

  useEffect(() => {
    if (!selectedRecipeId || !selectedRecipe) return;
    // Don't reset if a brew is already in progress
    if (brewPhase !== "setup") return;
    setSelectedPresetId(null); // Clear preset when recipe is selected
    setSetup(s => ({
      ...s,
      brewerName: selectedRecipe.brewerType || s.brewerName,
      grindSize: selectedRecipe.grindSize || s.grindSize,
      coffeeGrams: selectedRecipe.coffeeGrams ?? s.coffeeGrams,
      waterGrams: selectedRecipe.waterGrams ?? s.waterGrams,
      waterTempC: selectedRecipe.waterTempC ?? s.waterTempC,
    }));
    // Reset brew phase when recipe changes
    setBrewPhase("setup");
    setPrepChecked(new Set());
    dispatch({ type: "RESET" });
  }, [selectedRecipeId, recipes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collapse overrides when recipe selected, expand when not
  useEffect(() => {
    setOverridesOpen(!selectedRecipeId);
  }, [selectedRecipeId]);

  // Tick
  useEffect(() => {
    if (timer.state === "running") {
      intervalRef.current = setInterval(() => dispatch({ type: "TICK" }), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [timer.state]);

  // Check completion
  const target = Number(setup.targetBrewTimeSec) || selectedRecipe?.targetBrewTimeSec || 0;

  // Sync brewPhase with timer state
  useEffect(() => {
    if (timer.state === "complete") setBrewPhase("complete");
    if (timer.state === "idle") setBrewPhase("setup");
  }, [timer.state]);

  // ── Pourover mode ──────────────────────────────────────────────────────────
  const brewerType = setup.brewerName || selectedRecipe?.brewerType || "";
  const pouroverMode = isPourover(brewerType);

  const pourSchedule = useMemo(() => {
    if (!pouroverMode) return null;
    if (brewSteps.length > 0 && brewSteps.some(s => s.pourGrams > 0)) {
      return derivePourSchedule(brewSteps, Number(setup.waterGrams) || 0);
    }
    if (setup.waterGrams) {
      return buildQuickSchedule(quickSetup.numPours, quickSetup.intervalSec, Number(setup.waterGrams));
    }
    return null;
  }, [pouroverMode, brewSteps, setup.waterGrams, quickSetup.numPours, quickSetup.intervalSec]);

  const pourState = pouroverMode && pourSchedule
    ? computePourState(timer.elapsed, pourSchedule)
    : null;

  const effectiveTarget = useMemo(() => {
    if (target > 0) return target;
    if (pourSchedule && pourSchedule.pours.length > 0) {
      const lastPour = pourSchedule.pours[pourSchedule.pours.length - 1];
      return lastPour.absoluteTimeSec + 30;
    }
    // Derive endpoint from last brew step's timeSec
    if (brewSteps.length > 0) {
      const lastStep = brewSteps[brewSteps.length - 1];
      if (lastStep.timeSec > 0) return lastStep.timeSec;
    }
    return 0;
  }, [target, pourSchedule, brewSteps]);

  // Auto-complete when effectiveTarget is reached
  useEffect(() => {
    if (timer.state === "running" && effectiveTarget > 0 && timer.elapsed >= effectiveTarget) {
      dispatch({ type: "COMPLETE" });
      setBrewPhase("complete");
    }
  }, [timer.elapsed, timer.state, effectiveTarget]);

  // ── Step guidance ──────────────────────────────────────────────────────────
  const [manualStepIdx, setManualStepIdx] = useState(null); // for skipping ahead

  const timeBasedStepIdx = useMemo(() => {
    if (!brewSteps?.length) return 0;
    let idx = 0;
    for (let i = 1; i < brewSteps.length; i++) {
      // Only advance to next step if it has a defined time AND elapsed has passed it
      // Use strict > so that steps starting at the same time don't all activate at once
      if (brewSteps[i].timeSec != null && brewSteps[i].timeSec > 0 && timer.elapsed >= brewSteps[i].timeSec) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [brewSteps, timer.elapsed]);

  // Manual skip always wins, but time can catch up and push further
  const stepIdx = manualStepIdx != null ? Math.max(manualStepIdx, timeBasedStepIdx) : timeBasedStepIdx;

  const handleSkipStep = () => {
    if (stepIdx < brewSteps.length - 1) {
      setManualStepIdx(stepIdx + 1);
    }
  };

  // Reset manual step when brew resets
  useEffect(() => {
    if (brewPhase === "setup") setManualStepIdx(null);
  }, [brewPhase]);

  const ratio = setup.coffeeGrams && setup.waterGrams
    ? (Number(setup.waterGrams) / Number(setup.coffeeGrams)).toFixed(1)
    : null;

  // ── Filtered recipes by roast/brand ────────────────────────────────────────
  const filteredRecipes = useMemo(() => {
    if (!selectedRoastLevel && !selectedBrand) return recipes;
    return recipes.slice().sort((a, b) => {
      const aMatch = (selectedRoastLevel && a.roastLevel === selectedRoastLevel ? 2 : 0)
        + (selectedBrand && a.coffeeBrand === selectedBrand ? 2 : 0);
      const bMatch = (selectedRoastLevel && b.roastLevel === selectedRoastLevel ? 2 : 0)
        + (selectedBrand && b.coffeeBrand === selectedBrand ? 2 : 0);
      return bMatch - aMatch;
    });
  }, [recipes, selectedRoastLevel, selectedBrand]);

  // ── Community suggestions for selected brand ───────────────────────────────
  const suggestedRecipes = useMemo(() => {
    if (!selectedBrand && !selectedRoastLevel) return [];
    return communityRecipes.filter(r => {
      if (selectedBrand && r.coffeeBrand === selectedBrand) return true;
      if (selectedRoastLevel && r.roastLevel === selectedRoastLevel) return true;
      return false;
    }).slice(0, 3);
  }, [communityRecipes, selectedBrand, selectedRoastLevel]);

  // ── Prep completeness ──────────────────────────────────────────────────────
  const allPrepDone = prepSteps.length === 0 || prepChecked.size >= prepSteps.length;

  const togglePrep = (i) => {
    setPrepChecked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartBrew = () => {
    setBrewPhase("brewing");
    dispatch({ type: "START" });
  };

  const handleReset = () => {
    dispatch({ type: "RESET" });
    setBrewPhase("setup");
    setPrepChecked(new Set());
  };

  const handleSaveLog = async () => {
    setSaving(true);
    try {
      await createBrewLog({
        recipeId: selectedRecipeId ? Number(selectedRecipeId) : null,
        beanInventoryId: selectedBeanInventoryId || null,
        brewerName: setup.brewerName || selectedRecipe?.brewerType || null,
        grinderName: setup.grinderName || null,
        grindSize: setup.grindSize || null,
        coffeeGrams: setup.coffeeGrams ? Number(setup.coffeeGrams) : null,
        waterGrams: setup.waterGrams ? Number(setup.waterGrams) : null,
        waterTempC: setup.waterTempC ? Number(setup.waterTempC) : null,
        brewTimeSec: timer.elapsed || null,
        rating: logRating || null,
        notes: logNotes || null,
        isPublic: logPublic ? 1 : 0,
      });
      setSaved(true);
    } finally { setSaving(false); }
  };

  const handleSaveAsRecipe = async () => {
    if (!recipeName.trim()) return;
    setSavingRecipe(true);
    try {
      let recipeSteps = [];
      if (pouroverMode && pourSchedule) {
        recipeSteps = [
          ...prepSteps,
          ...pourSchedule.pours.map(p => ({
            phase: "brew", timeSec: p.absoluteTimeSec,
            instruction: p.instruction || `Pour ${p.pourGrams}g`,
            pourGrams: p.pourGrams,
          })),
        ];
      } else if (steps.length > 0) {
        recipeSteps = steps;
      }
      await createRecipe({
        name: recipeName.trim(),
        brewerType: setup.brewerName || selectedRecipe?.brewerType || "Other",
        grindSize: setup.grindSize || null,
        coffeeGrams: setup.coffeeGrams ? Number(setup.coffeeGrams) : null,
        waterGrams: setup.waterGrams ? Number(setup.waterGrams) : null,
        waterTempC: setup.waterTempC ? Number(setup.waterTempC) : null,
        targetBrewTimeSec: effectiveTarget || timer.elapsed || null,
        steps: recipeSteps,
        notes: setup.notes || null,
        roastLevel: selectedRoastLevel || null,
        coffeeBrand: selectedBrand || null,
      });
      setShowSaveRecipe(false);
      setRecipeName("");
      setRecipeSaved(true);
      setTimeout(() => setRecipeSaved(false), 3000);
    } finally { setSavingRecipe(false); }
  };

  const handleTryRecipe = (recipe) => {
    // Import a community recipe into the recipe dropdown
    setSelectedRecipeId(String(recipe.id));
    // If roast/brand info is available, auto-set those too
    if (recipe.roastLevel) setSelectedRoastLevel(recipe.roastLevel);
    if (recipe.coffeeBrand) setSelectedBrand(recipe.coffeeBrand);
  };

  // When a DB coffee is selected from search, sync roast level and auto-link inventory
  const handleCoffeeSelect = (product) => {
    setSelectedCoffee(product);
    if (product?.roastType) {
      // Map DB roastType to ROAST_LEVELS if possible
      const match = ROAST_LEVELS.find(r => product.roastType.toLowerCase().includes(r.toLowerCase()));
      if (match) setSelectedRoastLevel(match);
    }
    if (product?.roaster) setSelectedBrand(product.roaster);
    // Auto-link to bean inventory if this product matches an inventory bean
    if (product?.id) {
      const matchingBean = beanInventory.find(b => b.productId === product.id && b.gramsRemaining > 0);
      if (matchingBean) {
        setSelectedBeanInventoryId(matchingBean.id);
      } else {
        setSelectedBeanInventoryId(null);
      }
    } else {
      setSelectedBeanInventoryId(null);
    }
  };

  // Handle bean inventory selection
  const handleBeanSelect = (beanId) => {
    const id = beanId ? Number(beanId) : null;
    setSelectedBeanInventoryId(id);
    if (id) {
      const bean = beanInventory.find(b => b.id === id);
      if (bean) {
        // Auto-fill coffee info from the selected bean
        if (bean.displayName && bean.displayName !== "Unknown Bean") {
          setSelectedCoffee({ id: bean.productId, name: bean.displayName, roaster: bean.displayRoaster, roastType: bean.roastType });
        }
        if (bean.roastType) {
          const match = ROAST_LEVELS.find(r => bean.roastType.toLowerCase().includes(r.toLowerCase()));
          if (match) setSelectedRoastLevel(match);
        }
        if (bean.displayRoaster) setSelectedBrand(bean.displayRoaster);
      }
    }
  };

  // Handle preset selection
  const handlePresetSelect = (preset) => {
    setSelectedPresetId(preset.id);
    setSetup(s => ({
      ...s,
      brewerName: preset.brewerName,
      grindSize: preset.grindSize,
      waterTempC: preset.waterTempC,
      coffeeGrams: preset.coffeeGrams,
      waterGrams: preset.waterGrams,
    }));
  };

  // Quick pour setup visibility
  const showQuickPourSetup = pouroverMode && (!brewSteps.length || !brewSteps.some(s => s.pourGrams > 0));

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingData) {
    return <div className="py-20 text-center text-luxury-clay text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-luxury-umber">Brew Now</h2>
          <p className="text-sm text-luxury-clay mt-0.5">Pick your coffee, follow the guide, log your brew</p>
        </div>
        {recipeSaved && (
          <div className="text-sm text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-lg">
            Recipe saved!
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ════════════════════ LEFT: SETUP PANEL ════════════════════ */}
        <div className="premium-card p-5 space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">Setup</div>

          {/* Quick Setup Presets */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-2">Quick Setup</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all ${
                    selectedPresetId === preset.id
                      ? "bg-luxury-umber text-white border-luxury-umber shadow-md shadow-luxury-umber/20"
                      : "bg-white text-luxury-umber border-luxury-clay/30 hover:border-luxury-gold hover:text-luxury-gold"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {selectedPresetId && (
              <div className="mt-2 text-[10px] text-luxury-clay/60">
                Preset fills equipment fields below — override any value freely
              </div>
            )}
          </div>

          {/* Coffee Name search — auto-fills Roast Level & Brand below */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Coffee Name</label>
            <CoffeeSearchPicker value={selectedCoffee} onChange={handleCoffeeSelect} />
            {selectedCoffee && (
              <p className="mt-1 text-[10px] text-luxury-clay/60">Roast level and brand auto-filled ↓</p>
            )}
          </div>

          {/* Select from My Beans inventory */}
          {beanInventory.length > 0 && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Or Select from My Beans</label>
              <select
                value={selectedBeanInventoryId || ""}
                onChange={e => handleBeanSelect(e.target.value)}
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white"
              >
                <option value="">-- Select a bean --</option>
                {beanInventory.filter(b => b.gramsRemaining > 0).map(bean => (
                  <option key={bean.id} value={bean.id}>
                    {bean.displayName}{bean.displayRoaster ? ` (${bean.displayRoaster})` : ""} — {bean.gramsRemaining}g left
                  </option>
                ))}
              </select>
              {selectedBeanInventoryId && (
                <p className="mt-1 text-[10px] text-green-600">
                  Bean linked — grams will be deducted from inventory on save
                </p>
              )}
            </div>
          )}

          {/* Roast Level — auto-filled from coffee search, or pick manually */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Roast Level</label>
            <select value={selectedRoastLevel} onChange={e => setSelectedRoastLevel(e.target.value)}
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
              <option value="">-- Any roast --</option>
              {ROAST_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Brand — auto-filled from coffee search, or pick manually */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Brand</label>
            <input
              type="text"
              value={selectedBrand}
              onChange={e => setSelectedBrand(e.target.value)}
              placeholder="e.g. Blue Tokai"
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white"
            />
          </div>

          {/* Recipe */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Recipe</label>
            <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)}
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
              <option value="">-- No recipe --</option>
              {filteredRecipes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.brewerType})
                  {(selectedRoastLevel || selectedBrand) && (r.roastLevel === selectedRoastLevel || r.coffeeBrand === selectedBrand) ? " \u2605" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Community Suggestions */}
          {suggestedRecipes.length > 0 && (
            <div className="border border-luxury-gold/20 rounded-xl p-3 space-y-2 bg-luxury-gold/5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold">
                Suggested{selectedBrand ? ` for ${selectedBrand}` : ""}
              </div>
              {suggestedRecipes.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-luxury-umber truncate">{r.name}</div>
                    <div className="text-[10px] text-luxury-clay">
                      {r.brewerType}
                      {r.coffeeGrams && r.waterGrams ? ` \u00B7 1:${(r.waterGrams / r.coffeeGrams).toFixed(1)}` : ""}
                      {r.roastLevel ? ` \u00B7 ${r.roastLevel}` : ""}
                    </div>
                  </div>
                  <button type="button" onClick={() => handleTryRecipe(r)}
                    className="shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-luxury-gold border border-luxury-gold/40 rounded-lg hover:bg-luxury-gold/10 transition-colors">
                    Try
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recipe Params Summary */}
          {selectedRecipe && (
            <div className="bg-luxury-stone/30 rounded-xl p-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-luxury-umber">
                <span className="font-semibold">{selectedRecipe.brewerType}</span>
                {selectedRecipe.grindSize && <><span className="text-luxury-clay/40">&middot;</span><span>{selectedRecipe.grindSize}</span></>}
                {selectedRecipe.coffeeGrams && selectedRecipe.waterGrams && (
                  <><span className="text-luxury-clay/40">&middot;</span>
                  <span>{selectedRecipe.coffeeGrams}g / {selectedRecipe.waterGrams}g
                    <span className="text-luxury-gold ml-1">1:{(selectedRecipe.waterGrams / selectedRecipe.coffeeGrams).toFixed(1)}</span>
                  </span></>
                )}
                {selectedRecipe.waterTempC && <><span className="text-luxury-clay/40">&middot;</span><span>{selectedRecipe.waterTempC}&deg;C</span></>}
                {selectedRecipe.targetBrewTimeSec && <><span className="text-luxury-clay/40">&middot;</span><span>{fmtElapsed(selectedRecipe.targetBrewTimeSec)}</span></>}
              </div>
              {(selectedRecipe.roastLevel || selectedRecipe.coffeeBrand) && (
                <div className="flex gap-1.5 mt-2">
                  {selectedRecipe.roastLevel && (
                    <span className="px-2 py-0.5 rounded-full bg-luxury-umber/10 text-[10px] font-medium text-luxury-umber">{selectedRecipe.roastLevel}</span>
                  )}
                  {selectedRecipe.coffeeBrand && (
                    <span className="px-2 py-0.5 rounded-full bg-luxury-gold/10 text-[10px] font-medium text-luxury-gold">{selectedRecipe.coffeeBrand}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Overrides (collapsible) */}
          <div className="border-t border-luxury-clay/10 pt-3">
            <button type="button" onClick={() => setOverridesOpen(!overridesOpen)}
              className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-luxury-clay hover:text-luxury-umber transition-colors">
              <span>Equipment &amp; Overrides</span>
              <span className="text-sm">{overridesOpen ? "\u25B2" : "\u25BC"}</span>
            </button>

            {overridesOpen && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {[
                  ["Brewer", "brewerName", "text", "e.g. V60"],
                  ["Grinder", "grinderName", "text", "e.g. Comandante"],
                  ["Grind Size", "grindSize", "text", "e.g. Medium-Fine"],
                  ["Temp (\u00B0C)", "waterTempC", "number", "93"],
                ].map(([label, field, type, ph]) => (
                  <div key={field}>
                    <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">{label}</label>
                    <input type={type} value={setup[field]} placeholder={ph}
                      onChange={e => setSetup(s => ({ ...s, [field]: e.target.value }))}
                      className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                  </div>
                ))}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Coffee (g)</label>
                  <input type="number" min="0" value={setup.coffeeGrams}
                    onChange={e => setSetup(s => ({ ...s, coffeeGrams: e.target.value }))}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">
                    Water (g){ratio && <span className="text-luxury-gold font-normal"> &mdash; 1:{ratio}</span>}
                  </label>
                  <input type="number" min="0" value={setup.waterGrams}
                    onChange={e => setSetup(s => ({ ...s, waterGrams: e.target.value }))}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
              </div>
            )}
          </div>

          {/* Quick Pour Setup (pourover, no recipe steps) */}
          {showQuickPourSetup && (
            <div className="border-t border-luxury-clay/10 pt-3 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">Pour Schedule</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Number of Pours</label>
                  <input type="number" min="1" max="10" value={quickSetup.numPours}
                    onChange={e => setQuickSetup(s => ({ ...s, numPours: Math.max(1, Number(e.target.value) || 1) }))}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Interval (sec)</label>
                  <input type="number" min="5" max="300" value={quickSetup.intervalSec}
                    onChange={e => setQuickSetup(s => ({ ...s, intervalSec: Math.max(5, Number(e.target.value) || 30) }))}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
              </div>
              {pourSchedule && (
                <div className="text-xs text-luxury-clay bg-luxury-stone/30 rounded-lg p-2">
                  {pourSchedule.pours.length} pours &middot; {pourSchedule.pours[0]?.pourGrams}g each &middot; every {quickSetup.intervalSec}s
                  &middot; total {fmtElapsed(pourSchedule.pours[pourSchedule.pours.length - 1]?.absoluteTimeSec || 0)}
                </div>
              )}
            </div>
          )}

          {/* Save Setup as Recipe */}
          {(setup.brewerName || setup.coffeeGrams || setup.waterGrams) && brewPhase === "setup" && (
            <div className="border-t border-luxury-clay/10 pt-3">
              <button type="button" onClick={() => setShowSaveRecipe(true)}
                className="w-full py-2 border border-luxury-gold/50 text-luxury-gold hover:bg-luxury-gold/10 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors">
                Save Setup as Recipe
              </button>
            </div>
          )}
        </div>

        {/* ════════════════════ RIGHT: BREW GUIDE PANEL ════════════════════ */}
        <div className="premium-card p-5 space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">
            Brew Guide
            {pouroverMode && <span className="text-luxury-clay font-normal ml-2">&middot; Pourover Mode</span>}
          </div>

          {/* ── PREP SHELF ── */}
          {prepSteps.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-luxury-clay">Prep</div>
              <div className="space-y-1.5">
                {prepSteps.map((step, i) => {
                  const checked = prepChecked.has(i);
                  return (
                    <div key={i} onClick={() => brewPhase === "setup" && togglePrep(i)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                        brewPhase !== "setup" ? "opacity-60 cursor-default" :
                        "bg-luxury-clay/5 border-luxury-clay/10 cursor-pointer hover:border-luxury-clay/25"
                      }`}>
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${
                        checked ? "bg-luxury-umber border-luxury-umber" : "border-luxury-clay/30"
                      }`} />
                      <span className="text-sm leading-relaxed text-luxury-umber">{step.instruction}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── BREW SHELF ── */}
          {brewSteps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-luxury-clay">Brew Steps</div>
                {brewSteps.length > 0 && brewSteps.some(s => s.pourGrams > 0) && (
                  <div className="text-[10px] text-luxury-clay/60">
                    {brewSteps.filter(s => s.pourGrams > 0).length} pours
                  </div>
                )}
              </div>

              {/* Compact timer (shown during brewing) */}
              {brewPhase === "brewing" && (
                <div className="flex justify-center py-2">
                  <CompactTimer elapsed={timer.elapsed} target={effectiveTarget} state={timer.state} />
                </div>
              )}

              {/* Pourover banners */}
              {pouroverMode && pourState && brewPhase === "brewing" && (
                <div className="space-y-2">
                  <PourStatusBanner pourState={pourState} />
                  <PourProgress pourState={pourState} schedule={pourSchedule} />
                </div>
              )}

              {/* Step timeline */}
              <div className="space-y-1.5">
                {brewSteps.map((step, i) => {
                  const isActive = brewPhase === "brewing" && i === stepIdx;
                  const isDone = brewPhase === "brewing" && i < stepIdx;
                  const isPourStep = step.pourGrams > 0;
                  const isPourActive = isActive && isPourStep && pourState?.isPouring;

                  return (
                    <div key={i} className={`flex gap-3 p-3 rounded-xl transition-all ${
                      isPourActive
                        ? "bg-luxury-gold/15 border-2 border-luxury-gold animate-pulse"
                        : isActive
                          ? "bg-luxury-umber/10 border-2 border-luxury-umber"
                          : isDone
                            ? "bg-luxury-gold/5 border border-luxury-clay/15"
                            : "border border-luxury-clay/10"
                    }`}>
                      {/* Step number circle */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                        isDone
                          ? "bg-luxury-clay/15 text-luxury-clay"
                          : isActive
                            ? "bg-luxury-umber text-white"
                            : "bg-luxury-clay/10 text-luxury-clay/60"
                      }`}>
                        {i + 1}
                      </div>

                      {/* Step content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {step.timeSec != null && (
                            <span className={`text-[10px] font-bold tabular-nums ${
                              isActive ? "text-luxury-umber" : isDone ? "text-luxury-clay" : "text-luxury-clay/60"
                            }`}>
                              {fmtElapsed(step.timeSec)}
                            </span>
                          )}
                          {isPourActive && (
                            <span className="px-1.5 py-0.5 bg-luxury-gold text-white text-[9px] font-bold uppercase tracking-wider rounded">
                              Pour Now
                            </span>
                          )}
                          {isPourStep && !isPourActive && (
                            <span className="px-1.5 py-0.5 bg-luxury-gold/10 text-luxury-gold text-[9px] font-bold rounded">
                              {step.pourGrams}g
                            </span>
                          )}
                        </div>
                        <p className={`text-sm mt-0.5 leading-relaxed ${
                          isActive ? "text-luxury-umber font-medium" : isDone ? "text-luxury-clay" : "text-luxury-umber/80"
                        }`}>{step.instruction}</p>

                        {/* Active step progress */}
                        {isActive && step.timeSec != null && brewSteps[i + 1]?.timeSec != null && (
                          <div className="mt-2 h-1 bg-luxury-clay/10 rounded-full overflow-hidden">
                            <div className="h-full bg-luxury-umber rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, ((timer.elapsed - step.timeSec) / (brewSteps[i + 1].timeSec - step.timeSec)) * 100)}%`
                              }} />
                          </div>
                        )}

                        {/* Skip button for active step */}
                        {isActive && i < brewSteps.length - 1 && (
                          <button type="button" onClick={handleSkipStep}
                            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-luxury-clay/50 hover:text-luxury-umber transition-colors">
                            Skip →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No steps placeholder */}
          {steps.length === 0 && selectedRecipeId && (
            <div className="text-center py-8 text-luxury-clay/60">
              <div className="text-2xl mb-2">&#9749;</div>
              <p className="text-sm">This recipe has no step guide.</p>
              <p className="text-xs mt-1">Start the timer and brew freely.</p>
            </div>
          )}

          {!selectedRecipeId && (
            <div className="text-center py-8 text-luxury-clay/60">
              <div className="text-2xl mb-2">&#9749;</div>
              <p className="text-sm">Select a recipe to see the brew guide.</p>
              <p className="text-xs mt-1">Or start a free-form brew with the timer.</p>
            </div>
          )}

          {/* Non-pourover step display during brew (when no per-step timeline is shown) */}
          {!pouroverMode && brewSteps.length === 0 && brewPhase === "brewing" && (
            <div className="flex justify-center py-2">
              <CompactTimer elapsed={timer.elapsed} target={effectiveTarget} state={timer.state} />
            </div>
          )}

          {/* Timer for pourover with no recipe steps */}
          {pouroverMode && brewSteps.length === 0 && brewPhase === "brewing" && (
            <div className="space-y-3">
              <div className="flex justify-center py-2">
                <CompactTimer elapsed={timer.elapsed} target={effectiveTarget} state={timer.state} />
              </div>
              {pourState && (
                <>
                  <PourStatusBanner pourState={pourState} />
                  <PourProgress pourState={pourState} schedule={pourSchedule} />
                </>
              )}
            </div>
          )}

          {/* ── Controls ── */}
          <div className="pt-2 space-y-3">
            {brewPhase === "setup" && (
              <>
                <button type="button" onClick={handleStartBrew}
                  disabled={!allPrepDone}
                  className={`w-full py-3.5 font-bold uppercase tracking-widest rounded-xl transition-all text-sm ${
                    allPrepDone
                      ? "bg-luxury-umber text-white hover:bg-luxury-dark shadow-lg shadow-luxury-umber/20"
                      : "bg-luxury-clay/20 text-luxury-clay/50 cursor-not-allowed"
                  }`}>
                  {!allPrepDone ? `Complete prep (${prepChecked.size}/${prepSteps.length})` : "Start Brew"}
                </button>
                <button type="button" onClick={() => { dispatch({ type: "COMPLETE" }); setBrewPhase("complete"); }}
                  className="w-full text-[11px] text-luxury-clay/50 hover:text-luxury-clay underline">
                  Log without timer
                </button>
              </>
            )}

            {brewPhase === "brewing" && timer.state === "running" && (
              <div className="flex gap-3">
                <button type="button" onClick={() => { dispatch({ type: "COMPLETE" }); setBrewPhase("complete"); }}
                  className="flex-1 py-3 bg-green-600 text-white font-bold uppercase tracking-widest rounded-xl hover:bg-green-700 transition-colors text-sm">
                  Done
                </button>
                <button type="button" onClick={() => dispatch({ type: "PAUSE" })}
                  className="flex-1 py-3 border border-luxury-clay/40 text-luxury-clay font-bold uppercase tracking-widest rounded-xl hover:border-luxury-umber hover:text-luxury-umber transition-colors text-sm">
                  Pause
                </button>
                <button type="button" onClick={handleReset}
                  className="px-5 py-3 border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 rounded-xl font-bold transition-colors text-sm">
                  Reset
                </button>
              </div>
            )}

            {brewPhase === "brewing" && timer.state === "paused" && (
              <div className="flex gap-3">
                <button type="button" onClick={() => { dispatch({ type: "COMPLETE" }); setBrewPhase("complete"); }}
                  className="flex-1 py-3 bg-green-600 text-white font-bold uppercase tracking-widest rounded-xl hover:bg-green-700 transition-colors text-sm">
                  Done
                </button>
                <button type="button" onClick={() => dispatch({ type: "RESUME" })}
                  className="flex-1 py-3 bg-luxury-umber text-white font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors text-sm">
                  Resume
                </button>
                <button type="button" onClick={handleReset}
                  className="px-5 py-3 border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 rounded-xl font-bold transition-colors text-sm">
                  Reset
                </button>
              </div>
            )}

            {brewPhase === "complete" && (
              <button type="button" onClick={handleReset}
                className="w-full py-3 border border-luxury-clay/40 text-luxury-clay font-bold uppercase tracking-widest rounded-xl hover:border-luxury-umber hover:text-luxury-umber transition-colors text-sm">
                Brew Again
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════ POST-BREW LOG ════════════════════ */}
      {brewPhase === "complete" && !saved && (
        <div className="premium-card p-5 space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">Save Brew Log</div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            {[
              ["Coffee", selectedCoffee?.name || selectedRecipe?.coffeeName || "\u2014"],
              ["Brewer", setup.brewerName || selectedRecipe?.brewerType || "\u2014"],
              ["Ratio", ratio ? `1 : ${ratio}` : "\u2014"],
              ["Time", fmtElapsed(timer.elapsed)],
            ].map(([label, val]) => (
              <div key={label} className="bg-luxury-stone/30 rounded-xl p-3">
                <div className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">{label}</div>
                <div className="font-semibold text-luxury-umber mt-1">{val}</div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-2">Rating</label>
            <RatingStars value={logRating} onChange={setLogRating} />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Notes</label>
            <textarea rows={2} value={logNotes} onChange={e => setLogNotes(e.target.value)}
              placeholder="How did it taste? What would you change?"
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold resize-none" />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={logPublic} onChange={e => setLogPublic(e.target.checked)}
                className="w-4 h-4 rounded accent-luxury-umber" />
              <span className="text-sm text-luxury-clay">Share to community</span>
            </label>

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowSaveRecipe(true)}
                className="px-5 py-2.5 border border-luxury-gold/50 text-luxury-gold text-sm font-bold rounded-xl hover:bg-luxury-gold/10 transition-colors">
                Save as Recipe
              </button>
              <button type="button" onClick={handleSaveLog} disabled={saving}
                className="px-6 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Save Brew Log"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div className="premium-card p-6 text-center space-y-3">
          <div className="text-3xl">&check;</div>
          <div className="font-bold text-luxury-umber">Brew logged!</div>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => { setSaved(false); handleReset(); }}
              className="px-5 py-2 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors">
              Brew Again
            </button>
            <button type="button" onClick={() => navigate("/brew/log")}
              className="px-5 py-2 border border-luxury-clay/40 text-luxury-clay text-sm font-bold rounded-xl hover:border-luxury-umber hover:text-luxury-umber transition-colors">
              View Log
            </button>
          </div>
        </div>
      )}

      {/* ── Save as Recipe Modal ── */}
      {showSaveRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-luxury-umber text-lg">Save as Recipe</h3>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Recipe Name *</label>
              <input type="text" value={recipeName} onChange={e => setRecipeName(e.target.value)}
                placeholder="My V60 Recipe"
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
            </div>

            <div className="text-xs text-luxury-clay bg-luxury-stone/30 rounded-lg p-3 space-y-1">
              <div className="font-bold text-luxury-umber">{setup.brewerName || selectedRecipe?.brewerType || "\u2014"}</div>
              <div>
                {setup.coffeeGrams && `${setup.coffeeGrams}g coffee`}
                {setup.coffeeGrams && setup.waterGrams && " \u00B7 "}
                {setup.waterGrams && `${setup.waterGrams}g water`}
                {ratio && ` \u00B7 1:${ratio}`}
              </div>
              {selectedCoffee && <div>Coffee: {selectedCoffee.name} — {selectedCoffee.roaster}</div>}
              {selectedRoastLevel && !selectedCoffee && <div>Roast: {selectedRoastLevel}</div>}
              {pourSchedule && (
                <div>{pourSchedule.pours.length} pours &middot; {fmtElapsed(pourSchedule.pours[pourSchedule.pours.length - 1]?.absoluteTimeSec || 0)} total</div>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowSaveRecipe(false); setRecipeName(""); }}
                className="flex-1 py-2.5 border border-luxury-clay/40 text-luxury-clay rounded-xl text-sm font-bold hover:border-luxury-umber hover:text-luxury-umber transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSaveAsRecipe} disabled={savingRecipe || !recipeName.trim()}
                className="flex-1 py-2.5 bg-luxury-umber text-white rounded-xl text-sm font-bold hover:bg-luxury-dark transition-colors disabled:opacity-50">
                {savingRecipe ? "Saving..." : "Save Recipe"}
              </button>
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => { setShowSaveRecipe(false); setRecipeName(""); }} />
        </div>
      )}
    </div>
  );
}

export default BrewNowPage;
