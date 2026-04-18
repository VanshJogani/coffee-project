import React, { useEffect, useReducer, useRef, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchRecipes, fetchInventory, createBrewLog, createRecipe } from "../../api/client";

// ── Constants ────────────────────────────────────────────────────────────────
const POUROVER_METHODS = ["v60", "chemex", "kalita", "clever", "origami", "pourover", "pour over", "dripper"];
const POUR_FLASH_SEC = 5; // seconds the "POUR NOW" banner stays visible

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
  return {
    pours,
    totalWater: totalWater || pours.reduce((s, p) => s + p.pourGrams, 0),
  };
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
    pourIndex: pourIdx,
    totalPours: pours.length,
    isPouring,
    allDone,
    pourGrams: current.pourGrams,
    instruction: current.instruction,
    nextPourIn,
    nextPourGrams: next?.pourGrams ?? null,
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
          ★
        </button>
      ))}
    </div>
  );
}

// ── Circular timer ───────────────────────────────────────────────────────────
function CircleTimer({ elapsed, target, state }) {
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(1, elapsed / target) : 0;
  const dash = circ * pct;
  const color = state === "complete" ? "#22c55e" : state === "paused" ? "#d4a853" : "#5c3b1e";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="200" height="200" className="-rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#f0ebe3" strokeWidth="8" />
        <circle cx="100" cy="100" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-luxury-umber">{fmtElapsed(elapsed)}</span>
        {target > 0 && (
          <span className="text-[10px] uppercase tracking-widest text-luxury-clay mt-0.5">
            / {fmtElapsed(target)}
          </span>
        )}
        {state === "complete" && (
          <span className="text-xs font-bold text-green-500 mt-1">Done!</span>
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
      <div className="w-full">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-xs font-bold text-green-600 uppercase tracking-widest">All pours complete</div>
          <p className="text-sm text-green-700 mt-1">Let it draw down...</p>
        </div>
      </div>
    );
  }

  if (isPouring) {
    return (
      <div className="w-full">
        <div className="bg-luxury-gold/20 border-2 border-luxury-gold rounded-xl p-4 text-center animate-pulse">
          <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">
            Pour {pourIndex + 1} of {totalPours}
          </div>
          <div className="text-2xl font-bold text-luxury-umber">POUR NOW</div>
          <div className="text-lg font-bold text-luxury-gold">{pourGrams}g</div>
          {instruction && <p className="text-xs text-luxury-clay mt-1">{instruction}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-luxury-umber/5 border border-luxury-umber/20 rounded-xl p-3 text-center">
        <div className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold mb-1">
          Next pour in
        </div>
        <div className="text-2xl font-bold tabular-nums text-luxury-umber">
          {nextPourIn != null ? fmtElapsed(nextPourIn) : "—"}
        </div>
        {nextPourGrams != null && (
          <div className="text-xs text-luxury-clay mt-1">
            Pour {pourIndex + 2} — {nextPourGrams}g
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pour progress bar ────────────────────────────────────────────────────────
function PourProgress({ pourState, schedule }) {
  if (!pourState || !schedule) return null;
  return (
    <div className="w-full space-y-1">
      <div className="flex gap-1">
        {schedule.pours.map((_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-full transition-colors ${
            i <= pourState.pourIndex ? "bg-luxury-gold" : "bg-luxury-clay/15"
          }`} />
        ))}
      </div>
      <div className="text-center text-xs text-luxury-clay">
        {pourState.pourIndex + 1} of {pourState.totalPours} pours
        <span className="mx-1">·</span>
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
  const [beans, setBeans] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Setup form
  const [selectedBeanId, setSelectedBeanId] = useState(navState?.beanId ? String(navState.beanId) : "");
  const [selectedRecipeId, setSelectedRecipeId] = useState(navState?.recipeId ? String(navState.recipeId) : "");
  const [setup, setSetup] = useState({
    brewerName: "", grinderName: "", grindSize: "", coffeeGrams: "", waterGrams: "",
    waterTempC: "", notes: "",
  });

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

  // Save as recipe
  const [showSaveRecipe, setShowSaveRecipe] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);

  // Load data
  useEffect(() => {
    Promise.all([fetchRecipes(), fetchInventory()])
      .then(([r, b]) => { setRecipes(r); setBeans(b); })
      .finally(() => setLoadingData(false));
  }, []);

  // Auto-fill setup from selected recipe
  const selectedRecipe = recipes.find(r => String(r.id) === String(selectedRecipeId));
  const steps = selectedRecipe?.steps || [];

  useEffect(() => {
    if (!selectedRecipeId || !selectedRecipe) return;
    setSetup(s => ({
      ...s,
      brewerName: selectedRecipe.brewerType || s.brewerName,
      grindSize: selectedRecipe.grindSize || s.grindSize,
      coffeeGrams: selectedRecipe.coffeeGrams ?? s.coffeeGrams,
      waterGrams: selectedRecipe.waterGrams ?? s.waterGrams,
      waterTempC: selectedRecipe.waterTempC ?? s.waterTempC,
    }));
  }, [selectedRecipeId, recipes]);

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

  useEffect(() => {
    if (timer.state === "running" && target > 0 && timer.elapsed >= target) {
      dispatch({ type: "COMPLETE" });
    }
  }, [timer.elapsed, timer.state, target]);

  // ── Pourover mode ──────────────────────────────────────────────────────────
  const brewerType = setup.brewerName || selectedRecipe?.brewerType || "";
  const pouroverMode = isPourover(brewerType);

  const pourSchedule = useMemo(() => {
    if (!pouroverMode) return null;
    // If recipe has pour steps, derive from them
    if (steps.length > 0 && steps.some(s => s.pourGrams > 0)) {
      return derivePourSchedule(steps, Number(setup.waterGrams) || 0);
    }
    // Otherwise use quick setup
    if (setup.waterGrams) {
      return buildQuickSchedule(quickSetup.numPours, quickSetup.intervalSec, Number(setup.waterGrams));
    }
    return null;
  }, [pouroverMode, steps, setup.waterGrams, quickSetup.numPours, quickSetup.intervalSec]);

  const pourState = pouroverMode && pourSchedule
    ? computePourState(timer.elapsed, pourSchedule)
    : null;

  // For pourover, compute target from last pour + 30s drawdown if no explicit target
  const effectiveTarget = useMemo(() => {
    if (target > 0) return target;
    if (pourSchedule && pourSchedule.pours.length > 0) {
      const lastPour = pourSchedule.pours[pourSchedule.pours.length - 1];
      return lastPour.absoluteTimeSec + 30; // 30s drawdown
    }
    return 0;
  }, [target, pourSchedule]);

  // ── Step guidance for non-pourover ─────────────────────────────────────────
  const stepIdx = useMemo(() => {
    if (!steps?.length) return 0;
    let idx = 0;
    for (let i = 0; i < steps.length; i++) {
      if (timer.elapsed >= steps[i].timeSec) idx = i;
      else break;
    }
    return idx;
  }, [steps, timer.elapsed]);
  const currentStep = steps[stepIdx];
  const nextStep = steps[stepIdx + 1];

  const ratio = setup.coffeeGrams && setup.waterGrams
    ? (Number(setup.waterGrams) / Number(setup.coffeeGrams)).toFixed(1)
    : null;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveLog = async () => {
    setSaving(true);
    try {
      await createBrewLog({
        recipeId: selectedRecipeId ? Number(selectedRecipeId) : null,
        beanInventoryId: selectedBeanId ? Number(selectedBeanId) : null,
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
        recipeSteps = pourSchedule.pours.map(p => ({
          timeSec: p.absoluteTimeSec,
          instruction: p.instruction || `Pour ${p.pourGrams}g`,
          pourGrams: p.pourGrams,
        }));
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
      });

      setShowSaveRecipe(false);
      setRecipeName("");
      setRecipeSaved(true);
      setTimeout(() => setRecipeSaved(false), 3000);
    } finally { setSavingRecipe(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingData) {
    return <div className="py-20 text-center text-luxury-clay text-sm">Loading...</div>;
  }

  // Determine if quick pour setup should be shown
  const showQuickPourSetup = pouroverMode && (!steps.length || !steps.some(s => s.pourGrams > 0));
  const hasRecipePourSteps = pouroverMode && steps.length > 0 && steps.some(s => s.pourGrams > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-luxury-umber">Brew Now</h2>
          <p className="text-sm text-luxury-clay mt-0.5">Set up your brew and start the timer</p>
        </div>
        {recipeSaved && (
          <div className="text-sm text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-lg">
            Recipe saved!
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Setup Panel ── */}
        <div className="premium-card p-5 space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">Setup</div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Bean</label>
            <select value={selectedBeanId} onChange={e => setSelectedBeanId(e.target.value)}
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
              <option value="">— No bean selected —</option>
              {beans.map(b => (
                <option key={b.id} value={b.id}>
                  {b.displayName}{b.gramsRemaining != null ? ` (${Math.round(b.gramsRemaining)}g)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-clay font-bold mb-1">Recipe</label>
            <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)}
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
              <option value="">— No recipe —</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.brewerType})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Brewer", "brewerName", "text", "e.g. V60"],
              ["Grinder", "grinderName", "text", "e.g. Comandante"],
              ["Grind Size", "grindSize", "text", "e.g. Medium-Fine"],
              ["Temp (°C)", "waterTempC", "number", "93"],
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
                Water (g){ratio && <span className="text-luxury-gold font-normal"> — 1:{ratio}</span>}
              </label>
              <input type="number" min="0" value={setup.waterGrams}
                onChange={e => setSetup(s => ({ ...s, waterGrams: e.target.value }))}
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
            </div>
          </div>

          {/* ── Quick Pour Setup (pourover, no recipe steps) ── */}
          {showQuickPourSetup && (
            <div className="border-t border-luxury-clay/10 pt-4 space-y-3">
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
                  {pourSchedule.pours.length} pours · {pourSchedule.pours[0]?.pourGrams}g each · every {quickSetup.intervalSec}s
                  · total {fmtElapsed(pourSchedule.pours[pourSchedule.pours.length - 1]?.absoluteTimeSec || 0)}
                </div>
              )}
            </div>
          )}

          {/* Indicator that recipe has pour steps */}
          {hasRecipePourSteps && pourSchedule && (
            <div className="border-t border-luxury-clay/10 pt-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold mb-2">Pour Schedule (from recipe)</div>
              <div className="space-y-1">
                {pourSchedule.pours.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-luxury-clay">
                    <span className="w-5 h-5 rounded-full bg-luxury-gold/10 flex items-center justify-center text-[10px] font-bold text-luxury-gold shrink-0">{i + 1}</span>
                    <span className="font-medium">{p.pourGrams}g</span>
                    <span className="text-luxury-clay/50">at {fmtElapsed(p.absoluteTimeSec)}</span>
                    {p.instruction && <span className="text-luxury-clay/70 truncate">— {p.instruction}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Save as Recipe button ── */}
          {(setup.brewerName || setup.coffeeGrams || setup.waterGrams) && timer.state === "idle" && (
            <div className="border-t border-luxury-clay/10 pt-3">
              <button type="button" onClick={() => setShowSaveRecipe(true)}
                className="w-full py-2 border border-luxury-gold/50 text-luxury-gold hover:bg-luxury-gold/10 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors">
                Save Setup as Recipe
              </button>
            </div>
          )}
        </div>

        {/* ── Timer Panel ── */}
        <div className="premium-card p-5 flex flex-col items-center gap-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold self-start">
            Timer
            {pouroverMode && <span className="text-luxury-clay font-normal ml-2">· Pourover Mode</span>}
          </div>

          <CircleTimer elapsed={timer.elapsed} target={effectiveTarget} state={timer.state} />

          {/* Pour timer display for pourover methods */}
          {pouroverMode && pourState && timer.state !== "idle" && (
            <>
              <PourStatusBanner pourState={pourState} />
              <PourProgress pourState={pourState} schedule={pourSchedule} />
            </>
          )}

          {/* Original step display for non-pourover methods */}
          {!pouroverMode && steps.length > 0 && timer.state !== "idle" && (
            <div className="w-full space-y-2">
              {currentStep && (
                <div className="bg-luxury-umber/5 border border-luxury-umber/20 rounded-xl p-3 text-center">
                  <div className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold mb-1">
                    Step {stepIdx + 1} of {steps.length}
                    {currentStep.pourGrams > 0 && <span className="ml-2 text-luxury-gold">— {currentStep.pourGrams}g</span>}
                  </div>
                  <p className="text-sm font-semibold text-luxury-umber">{currentStep.instruction}</p>
                </div>
              )}
              {nextStep && (
                <div className="text-center text-xs text-luxury-clay/70">
                  <span className="font-bold">Next:</span> {nextStep.instruction}
                </div>
              )}
              <div className="w-full h-1.5 bg-luxury-clay/10 rounded-full overflow-hidden">
                <div className="h-full bg-luxury-gold rounded-full transition-all"
                  style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
              </div>
            </div>
          )}

          {/* No steps hint */}
          {!pouroverMode && steps.length === 0 && timer.state !== "idle" && (
            <div className="text-sm text-luxury-clay text-center">
              Brewing — no step guide for this recipe.
            </div>
          )}

          {pouroverMode && !pourSchedule && timer.state !== "idle" && (
            <div className="text-sm text-luxury-clay text-center">
              Set water amount and pour schedule to get pour guidance.
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 w-full">
            {timer.state === "idle" && (
              <button type="button" onClick={() => dispatch({ type: "START" })}
                className="flex-1 py-3 bg-luxury-umber text-white font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors">
                Start
              </button>
            )}
            {timer.state === "running" && (
              <>
                <button type="button" onClick={() => dispatch({ type: "PAUSE" })}
                  className="flex-1 py-3 border border-luxury-clay/40 text-luxury-clay font-bold uppercase tracking-widest rounded-xl hover:border-luxury-umber hover:text-luxury-umber transition-colors">
                  Pause
                </button>
                <button type="button" onClick={() => dispatch({ type: "RESET" })}
                  className="px-5 py-3 border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 rounded-xl font-bold transition-colors">
                  Reset
                </button>
              </>
            )}
            {timer.state === "paused" && (
              <>
                <button type="button" onClick={() => dispatch({ type: "RESUME" })}
                  className="flex-1 py-3 bg-luxury-umber text-white font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors">
                  Resume
                </button>
                <button type="button" onClick={() => dispatch({ type: "RESET" })}
                  className="px-5 py-3 border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 rounded-xl font-bold transition-colors">
                  Reset
                </button>
              </>
            )}
            {timer.state === "complete" && (
              <button type="button" onClick={() => dispatch({ type: "RESET" })}
                className="flex-1 py-3 border border-luxury-clay/40 text-luxury-clay font-bold uppercase tracking-widest rounded-xl hover:border-luxury-umber hover:text-luxury-umber transition-colors">
                Brew Again
              </button>
            )}
          </div>

          {timer.state === "idle" && (
            <button type="button" onClick={() => dispatch({ type: "COMPLETE" })}
              className="text-[11px] text-luxury-clay/60 hover:text-luxury-clay underline">
              Log without timer
            </button>
          )}
        </div>
      </div>

      {/* ── Post-brew log form ── */}
      {(timer.state === "complete" || timer.state === "paused") && !saved && (
        <div className="premium-card p-5 space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">Save Brew Log</div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            {[
              ["Bean", beans.find(b => String(b.id) === String(selectedBeanId))?.displayName || "—"],
              ["Recipe", selectedRecipe?.name || "—"],
              ["Ratio", ratio ? `1 : ${ratio}` : "—"],
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

      {saved && (
        <div className="premium-card p-6 text-center space-y-3">
          <div className="text-3xl">✓</div>
          <div className="font-bold text-luxury-umber">Brew logged!</div>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => { setSaved(false); dispatch({ type: "RESET" }); }}
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
              <div className="font-bold text-luxury-umber">{setup.brewerName || selectedRecipe?.brewerType || "—"}</div>
              <div>
                {setup.coffeeGrams && `${setup.coffeeGrams}g coffee`}
                {setup.coffeeGrams && setup.waterGrams && " · "}
                {setup.waterGrams && `${setup.waterGrams}g water`}
                {ratio && ` · 1:${ratio}`}
              </div>
              {pourSchedule && (
                <div>{pourSchedule.pours.length} pours · {fmtElapsed(pourSchedule.pours[pourSchedule.pours.length - 1]?.absoluteTimeSec || 0)} total</div>
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
