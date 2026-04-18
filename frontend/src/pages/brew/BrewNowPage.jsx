import React, { useEffect, useReducer, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchRecipes, fetchInventory, createBrewLog } from "../../api/client";

// ── Timer reducer ─────────────────────────────────────────────────────────────
const INITIAL_TIMER = { state: "idle", elapsed: 0 }; // idle|running|paused|complete

function timerReducer(st, action) {
  switch (action.type) {
    case "START":   return { ...st, state: "running" };
    case "PAUSE":   return { ...st, state: "paused" };
    case "RESUME":  return { ...st, state: "running" };
    case "TICK":    return { ...st, elapsed: st.elapsed + 1 };
    case "RESET":   return INITIAL_TIMER;
    case "COMPLETE":return { ...st, state: "complete" };
    default: return st;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }
function fmtElapsed(sec) { return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; }

function currentStepIdx(steps, elapsed) {
  if (!steps?.length) return 0;
  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (elapsed >= steps[i].timeSec) idx = i;
    else break;
  }
  return idx;
}

// ── Rating stars ──────────────────────────────────────────────────────────────
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

// ── Circular timer display ────────────────────────────────────────────────────
function CircleTimer({ elapsed, target, state }) {
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(1, elapsed / target) : 0;
  const dash = circ * pct;

  const color = state === "complete" ? "#22c55e"
    : state === "paused" ? "#d4a853"
    : "#5c3b1e";

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

// ── Main page ─────────────────────────────────────────────────────────────────
function BrewNowPage() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState([]);
  const [beans, setBeans] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Setup form
  const [selectedBeanId, setSelectedBeanId] = useState(navState?.beanId ?? "");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [setup, setSetup] = useState({
    brewerName: "", grinderName: "", grindSize: "", coffeeGrams: "", waterGrams: "",
    waterTempC: "", notes: "",
  });

  // Timer
  const [timer, dispatch] = useReducer(timerReducer, INITIAL_TIMER);
  const intervalRef = useRef(null);

  // Post-brew log form
  const [logRating, setLogRating] = useState(0);
  const [logNotes, setLogNotes] = useState("");
  const [logPublic, setLogPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load data
  useEffect(() => {
    Promise.all([fetchRecipes(), fetchInventory()])
      .then(([r, b]) => { setRecipes(r); setBeans(b); })
      .finally(() => setLoadingData(false));
  }, []);

  // Auto-fill setup from selected recipe
  useEffect(() => {
    if (!selectedRecipeId) return;
    const r = recipes.find(r => String(r.id) === String(selectedRecipeId));
    if (!r) return;
    setSetup(s => ({
      ...s,
      grindSize: r.grindSize || s.grindSize,
      coffeeGrams: r.coffeeGrams ?? s.coffeeGrams,
      waterGrams: r.waterGrams ?? s.waterGrams,
      waterTempC: r.waterTempC ?? s.waterTempC,
    }));
  }, [selectedRecipeId, recipes]);

  // Tick
  useEffect(() => {
    if (timer.state === "running") {
      intervalRef.current = setInterval(() => {
        dispatch({ type: "TICK" });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [timer.state]);

  // Check completion
  const selectedRecipe = recipes.find(r => String(r.id) === String(selectedRecipeId));
  const steps = selectedRecipe?.steps || [];
  const target = setup.targetBrewTimeSec || selectedRecipe?.targetBrewTimeSec || 0;

  useEffect(() => {
    if (timer.state === "running" && target > 0 && timer.elapsed >= target) {
      dispatch({ type: "COMPLETE" });
    }
  }, [timer.elapsed, timer.state, target]);

  const ratio = setup.coffeeGrams && setup.waterGrams
    ? (Number(setup.waterGrams) / Number(setup.coffeeGrams)).toFixed(1)
    : null;

  const stepIdx = currentStepIdx(steps, timer.elapsed);
  const currentStep = steps[stepIdx];
  const nextStep = steps[stepIdx + 1];

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

  if (loadingData) {
    return <div className="py-20 text-center text-luxury-clay text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-luxury-umber">Brew Now</h2>
        <p className="text-sm text-luxury-clay mt-0.5">Set up your brew and start the timer</p>
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
                <option key={r.id} value={r.id}>{r.name}</option>
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
        </div>

        {/* ── Timer Panel ── */}
        <div className="premium-card p-5 flex flex-col items-center gap-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold self-start">Timer</div>

          <CircleTimer elapsed={timer.elapsed} target={target} state={timer.state} />

          {/* Current step */}
          {steps.length > 0 && timer.state !== "idle" && (
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
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-luxury-clay/10 rounded-full overflow-hidden">
                <div className="h-full bg-luxury-gold rounded-full transition-all"
                  style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
              </div>
            </div>
          )}

          {steps.length === 0 && timer.state !== "idle" && (
            <div className="text-sm text-luxury-clay text-center">
              Brewing — no step guide for this recipe.
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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={logPublic} onChange={e => setLogPublic(e.target.checked)}
                className="w-4 h-4 rounded accent-luxury-umber" />
              <span className="text-sm text-luxury-clay">Share to community</span>
            </label>

            <button type="button" onClick={handleSaveLog} disabled={saving}
              className="px-6 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save Brew Log"}
            </button>
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
    </div>
  );
}

export default BrewNowPage;
