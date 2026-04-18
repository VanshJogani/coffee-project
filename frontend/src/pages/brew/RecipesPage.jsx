import React, { useEffect, useState } from "react";
import { fetchRecipes, createRecipe, updateRecipe, deleteRecipe, forkRecipe } from "../../api/client";

const BREWER_TYPES = ["V60", "AeroPress", "French Press", "Moka Pot", "Chemex", "Clever", "Other"];
const GRIND_SIZES  = ["Extra Fine", "Fine", "Medium-Fine", "Medium", "Medium-Coarse", "Coarse"];

function formatTime(sec) {
  if (!sec && sec !== 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s > 0 ? s + "s" : ""}`.trim() : `${s}s`;
}

function RatioDisplay({ coffeeGrams, waterGrams }) {
  if (!coffeeGrams || !waterGrams) return null;
  const ratio = (waterGrams / coffeeGrams).toFixed(1);
  return <span>1 : {ratio}</span>;
}

const BREWER_ICONS = {
  "V60": "▽",
  "AeroPress": "⊙",
  "French Press": "⬛",
  "Moka Pot": "△",
  "Chemex": "⌗",
  "Clever": "◻",
  "Other": "☕",
};

function RecipeCard({ recipe, onView, onEdit, onFork, onDelete }) {
  const icon = BREWER_ICONS[recipe.brewerType] || "☕";
  return (
    <div className="premium-card p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-luxury-gold/10 border border-luxury-gold/20 flex items-center justify-center text-xl shrink-0 text-luxury-gold">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold">{recipe.brewerType}</span>
            {recipe.isBuiltIn ? (
              <span className="text-[9px] font-bold uppercase tracking-widest bg-luxury-umber/10 text-luxury-umber px-1.5 py-0.5 rounded-full">Built-in</span>
            ) : recipe.sourceRecipe ? (
              <span className="text-[9px] text-luxury-clay/70 italic">forked from {recipe.sourceRecipe}</span>
            ) : null}
          </div>
          <div className="font-semibold text-sm text-luxury-umber leading-snug mt-0.5">{recipe.name}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-luxury-stone/30 rounded-lg py-1.5">
          <div className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">Ratio</div>
          <div className="text-xs font-bold text-luxury-umber mt-0.5">
            <RatioDisplay coffeeGrams={recipe.coffeeGrams} waterGrams={recipe.waterGrams} />
          </div>
        </div>
        <div className="bg-luxury-stone/30 rounded-lg py-1.5">
          <div className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">Time</div>
          <div className="text-xs font-bold text-luxury-umber mt-0.5">{formatTime(recipe.targetBrewTimeSec)}</div>
        </div>
        <div className="bg-luxury-stone/30 rounded-lg py-1.5">
          <div className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">Grind</div>
          <div className="text-xs font-bold text-luxury-umber mt-0.5">{recipe.grindSize || "—"}</div>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-luxury-clay/10">
        <button type="button" onClick={() => onView(recipe)}
          className="flex-1 py-1.5 border border-luxury-clay/30 text-luxury-clay hover:border-luxury-gold hover:text-luxury-umber rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors">
          View
        </button>
        {recipe.isBuiltIn ? (
          <button type="button" onClick={() => onFork(recipe)}
            className="flex-1 py-1.5 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-luxury-dark transition-colors">
            Fork
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onEdit(recipe)}
              className="flex-1 py-1.5 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-luxury-dark transition-colors">
              Edit
            </button>
            <button type="button" onClick={() => onDelete(recipe.id)}
              className="px-3 py-1.5 border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 rounded-lg text-[11px] transition-colors">
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StepEditor({ steps, onChange }) {
  const add = () => onChange([...steps, { timeSec: "", instruction: "", pourGrams: "" }]);
  const remove = (i) => onChange(steps.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(steps.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  const move = (i, dir) => {
    const next = [...steps];
    const swap = i + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-2 items-start bg-luxury-stone/20 rounded-xl p-3">
          <div className="flex flex-col gap-1 shrink-0">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              className="text-luxury-clay hover:text-luxury-umber disabled:opacity-30 text-xs leading-none">▲</button>
            <span className="text-[10px] font-bold text-luxury-gold text-center">{i + 1}</span>
            <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1}
              className="text-luxury-clay hover:text-luxury-umber disabled:opacity-30 text-xs leading-none">▼</button>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">Time (sec)</label>
              <input type="number" min="0" value={step.timeSec}
                onChange={e => update(i, "timeSec", e.target.value)}
                className="w-full rounded-lg border border-luxury-clay/40 px-2 py-1.5 text-xs focus:outline-none focus:border-luxury-gold" />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">Pour (g)</label>
              <input type="number" min="0" value={step.pourGrams}
                onChange={e => update(i, "pourGrams", e.target.value)}
                className="w-full rounded-lg border border-luxury-clay/40 px-2 py-1.5 text-xs focus:outline-none focus:border-luxury-gold" />
            </div>
            <div className="col-span-2">
              <label className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">Instruction</label>
              <input type="text" value={step.instruction}
                onChange={e => update(i, "instruction", e.target.value)}
                placeholder="What to do at this step…"
                className="w-full rounded-lg border border-luxury-clay/40 px-2 py-1.5 text-xs focus:outline-none focus:border-luxury-gold" />
            </div>
          </div>
          <button type="button" onClick={() => remove(i)}
            className="shrink-0 text-red-300 hover:text-red-500 text-xs mt-1 transition-colors">✕</button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full py-2 border-2 border-dashed border-luxury-clay/30 rounded-xl text-[11px] text-luxury-clay hover:border-luxury-gold hover:text-luxury-umber transition-colors font-bold uppercase tracking-widest">
        + Add Step
      </button>
    </div>
  );
}

const EMPTY_FORM = {
  name: "", brewerType: "V60", grindSize: "Medium", coffeeGrams: "", waterGrams: "",
  waterTempC: "", bloomTimeSec: "", targetBrewTimeSec: "", notes: "",
  steps: [{ timeSec: "", instruction: "", pourGrams: "" }],
};

function recipeToForm(r) {
  return {
    name: r.name || "",
    brewerType: r.brewerType || "V60",
    grindSize: r.grindSize || "Medium",
    coffeeGrams: r.coffeeGrams ?? "",
    waterGrams: r.waterGrams ?? "",
    waterTempC: r.waterTempC ?? "",
    bloomTimeSec: r.bloomTimeSec ?? "",
    targetBrewTimeSec: r.targetBrewTimeSec ?? "",
    notes: r.notes || "",
    steps: (r.steps || [{ timeSec: "", instruction: "", pourGrams: "" }]).map(s => ({
      timeSec: s.timeSec ?? "",
      instruction: s.instruction || "",
      pourGrams: s.pourGrams ?? "",
    })),
  };
}

function RecipeModal({ recipe, mode: initMode, onClose, onSave }) {
  // mode: "view" | "edit" | "new"
  const [mode, setMode] = useState(initMode);
  const [form, setForm] = useState(initMode === "new" ? EMPTY_FORM : recipeToForm(recipe));
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const ratio = form.coffeeGrams && form.waterGrams
    ? (Number(form.waterGrams) / Number(form.coffeeGrams)).toFixed(1)
    : null;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        coffeeGrams: form.coffeeGrams !== "" ? Number(form.coffeeGrams) : null,
        waterGrams: form.waterGrams !== "" ? Number(form.waterGrams) : null,
        waterTempC: form.waterTempC !== "" ? Number(form.waterTempC) : null,
        bloomTimeSec: form.bloomTimeSec !== "" ? Number(form.bloomTimeSec) : null,
        targetBrewTimeSec: form.targetBrewTimeSec !== "" ? Number(form.targetBrewTimeSec) : null,
        steps: form.steps.map(s => ({
          timeSec: s.timeSec !== "" ? Number(s.timeSec) : 0,
          instruction: s.instruction,
          pourGrams: s.pourGrams !== "" ? Number(s.pourGrams) : 0,
        })),
      };
      await onSave(payload, recipe?.id);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-luxury-clay/10 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-luxury-umber">
              {mode === "new" ? "New Recipe" : mode === "edit" ? "Edit Recipe" : recipe?.name}
            </h3>
            {mode === "view" && recipe?.brewerType && (
              <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold mt-0.5">{recipe.brewerType}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === "view" && !recipe?.isBuiltIn && (
              <button type="button" onClick={() => setMode("edit")}
                className="px-3 py-1.5 border border-luxury-clay/40 text-luxury-clay hover:border-luxury-gold hover:text-luxury-umber rounded-lg text-[11px] font-bold transition-colors">
                Edit
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-full hover:bg-luxury-stone/30 text-luxury-clay">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {mode === "view" ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Coffee", recipe?.coffeeGrams ? `${recipe.coffeeGrams}g` : "—"],
                  ["Water", recipe?.waterGrams ? `${recipe.waterGrams}g` : "—"],
                  ["Ratio", ratio ? `1 : ${(recipe.waterGrams / recipe.coffeeGrams).toFixed(1)}` : "—"],
                  ["Temp", recipe?.waterTempC ? `${recipe.waterTempC}°C` : "—"],
                  ["Target Time", recipe?.targetBrewTimeSec ? formatTime(recipe.targetBrewTimeSec) : "—"],
                  ["Grind", recipe?.grindSize || "—"],
                ].map(([label, val]) => (
                  <div key={label} className="bg-luxury-stone/30 rounded-xl p-3 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">{label}</div>
                    <div className="text-sm font-bold text-luxury-umber mt-1">{val}</div>
                  </div>
                ))}
              </div>
              {recipe?.notes && (
                <div className="bg-luxury-gold/5 border border-luxury-gold/20 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Notes</div>
                  <p className="text-sm text-luxury-clay leading-relaxed">{recipe.notes}</p>
                </div>
              )}
              {recipe?.steps?.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-2">Steps</div>
                  <div className="space-y-2">
                    {recipe.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 bg-luxury-stone/20 rounded-xl p-3">
                        <div className="w-8 h-8 rounded-full bg-luxury-umber/10 flex items-center justify-center text-xs font-bold text-luxury-umber shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-[10px] text-luxury-clay">{formatTime(step.timeSec)}</span>
                            {step.pourGrams > 0 && (
                              <span className="text-[10px] font-bold text-luxury-gold bg-luxury-gold/10 px-1.5 py-0.5 rounded-full">
                                {step.pourGrams}g
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-luxury-umber leading-relaxed">{step.instruction}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Recipe Name *</label>
                  <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
                    placeholder="My V60 Recipe"
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Brewer</label>
                  <select value={form.brewerType} onChange={e => set("brewerType", e.target.value)}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
                    {BREWER_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Grind Size</label>
                  <select value={form.grindSize} onChange={e => set("grindSize", e.target.value)}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
                    {GRIND_SIZES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Coffee (g)</label>
                  <input type="number" min="0" value={form.coffeeGrams} onChange={e => set("coffeeGrams", e.target.value)}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">
                    Water (g) {ratio && <span className="text-luxury-clay font-normal normal-case tracking-normal">— 1:{ratio}</span>}
                  </label>
                  <input type="number" min="0" value={form.waterGrams} onChange={e => set("waterGrams", e.target.value)}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Temp (°C)</label>
                  <input type="number" min="0" max="100" value={form.waterTempC} onChange={e => set("waterTempC", e.target.value)}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Target Time (sec)</label>
                  <input type="number" min="0" value={form.targetBrewTimeSec} onChange={e => set("targetBrewTimeSec", e.target.value)}
                    className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)}
                  placeholder="Tips, technique notes…"
                  className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold resize-none" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-2">Steps</div>
                <StepEditor steps={form.steps} onChange={steps => set("steps", steps)} />
              </div>
            </>
          )}
        </div>

        {mode !== "view" && (
          <div className="p-4 border-t border-luxury-clay/10 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-luxury-clay/40 text-luxury-clay rounded-xl text-sm font-bold hover:border-luxury-umber hover:text-luxury-umber transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-luxury-umber text-white rounded-xl text-sm font-bold hover:bg-luxury-dark transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save Recipe"}
            </button>
          </div>
        )}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode: "view"|"edit"|"new", recipe? }
  const [forking, setForking] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setRecipes(await fetchRecipes()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (payload, id) => {
    if (id) await updateRecipe(id, payload);
    else await createRecipe(payload);
    await load();
  };

  const handleFork = async (recipe) => {
    setForking(recipe.id);
    try {
      await forkRecipe(recipe);
      await load();
    } finally { setForking(null); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this recipe?")) return;
    await deleteRecipe(id);
    await load();
  };

  const builtIn = recipes.filter(r => r.isBuiltIn);
  const mine = recipes.filter(r => !r.isBuiltIn);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-luxury-umber">Recipes</h2>
          <p className="text-sm text-luxury-clay mt-0.5">{mine.length} custom {mine.length === 1 ? "recipe" : "recipes"}</p>
        </div>
        <button type="button" onClick={() => setModal({ mode: "new" })}
          className="flex items-center gap-2 px-4 py-2 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors">
          <span className="text-base leading-none">+</span> New Recipe
        </button>
      </div>

      {loading && <div className="py-20 text-center text-luxury-clay text-sm">Loading recipes…</div>}

      {!loading && (
        <>
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold mb-3">Built-in Recipes</h3>
            {builtIn.length === 0 ? (
              <p className="text-sm text-luxury-clay">No built-in recipes found. Run <code className="bg-luxury-stone/40 px-1 rounded">node backend/seedRecipes.js</code> to seed them.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {builtIn.map(r => (
                  <RecipeCard key={r.id} recipe={r}
                    onView={r => setModal({ mode: "view", recipe: r })}
                    onEdit={r => setModal({ mode: "edit", recipe: r })}
                    onFork={handleFork}
                    onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold mb-3">My Recipes</h3>
            {mine.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-luxury-clay/20 rounded-2xl">
                <div className="text-3xl mb-3">📋</div>
                <div className="font-bold text-luxury-umber mb-1">No custom recipes yet</div>
                <div className="text-sm text-luxury-clay mb-4">Fork a built-in recipe to customise it, or create one from scratch.</div>
                <button type="button" onClick={() => setModal({ mode: "new" })}
                  className="px-5 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors">
                  Create Recipe
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mine.map(r => (
                  <RecipeCard key={r.id} recipe={r}
                    onView={r => setModal({ mode: "view", recipe: r })}
                    onEdit={r => setModal({ mode: "edit", recipe: r })}
                    onFork={handleFork}
                    onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {modal && (
        <RecipeModal
          recipe={modal.recipe}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={handleSave} />
      )}
    </div>
  );
}

export default RecipesPage;
