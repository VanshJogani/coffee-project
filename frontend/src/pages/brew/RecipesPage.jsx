import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchRecipes, createRecipe, updateRecipe, deleteRecipe, forkRecipe,
  fetchPosts, createPost, likePost, deletePost,
} from "../../api/client";

const BREWER_TYPES = ["V60", "AeroPress", "French Press", "Moka Pot", "Chemex", "Clever", "Kalita", "Other"];
const GRIND_SIZES  = ["Extra Fine", "Fine", "Medium-Fine", "Medium", "Medium-Coarse", "Coarse"];

const BREWER_ICONS = {
  "V60": "▽", "AeroPress": "⊙", "French Press": "⬛", "Moka Pot": "△",
  "Chemex": "⌗", "Clever": "◻", "Kalita": "◇", "Other": "☕",
};

function formatTime(sec) {
  if (!sec && sec !== 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s > 0 ? s + "s" : ""}`.trim() : `${s}s`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function RatioDisplay({ coffeeGrams, waterGrams }) {
  if (!coffeeGrams || !waterGrams) return null;
  return <span>1 : {(waterGrams / coffeeGrams).toFixed(1)}</span>;
}

// ── Compact recipe card (used inside community posts) ─────────────────────────
function AttachedRecipeCard({ recipe, onBrew, onImport, importing }) {
  const icon = BREWER_ICONS[recipe.brewerType] || "☕";
  return (
    <div className="border border-luxury-gold/30 bg-luxury-gold/5 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-luxury-gold/10 border border-luxury-gold/20 flex items-center justify-center text-lg text-luxury-gold shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-luxury-gold">{recipe.brewerType}</div>
          <div className="font-semibold text-sm text-luxury-umber leading-snug truncate">{recipe.name}</div>
        </div>
      </div>

      <div className="flex gap-3 text-center text-[10px]">
        {recipe.coffeeGrams && recipe.waterGrams && (
          <div>
            <div className="text-luxury-clay font-bold uppercase tracking-widest">Ratio</div>
            <div className="font-bold text-luxury-umber"><RatioDisplay coffeeGrams={recipe.coffeeGrams} waterGrams={recipe.waterGrams} /></div>
          </div>
        )}
        {recipe.targetBrewTimeSec && (
          <div>
            <div className="text-luxury-clay font-bold uppercase tracking-widest">Time</div>
            <div className="font-bold text-luxury-umber">{formatTime(recipe.targetBrewTimeSec)}</div>
          </div>
        )}
        {recipe.grindSize && (
          <div>
            <div className="text-luxury-clay font-bold uppercase tracking-widest">Grind</div>
            <div className="font-bold text-luxury-umber">{recipe.grindSize}</div>
          </div>
        )}
        {recipe.steps?.length > 0 && (
          <div>
            <div className="text-luxury-clay font-bold uppercase tracking-widest">Pours</div>
            <div className="font-bold text-luxury-umber">{recipe.steps.filter(s => s.pourGrams > 0).length}</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => onBrew(recipe)}
          className="flex-1 py-1.5 bg-luxury-gold/90 text-luxury-umber text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-luxury-gold transition-colors">
          Try
        </button>
        <button type="button" onClick={onImport} disabled={importing}
          className="flex-1 py-1.5 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-luxury-dark transition-colors disabled:opacity-50">
          {importing ? "Importing…" : "Add to My Recipes"}
        </button>
      </div>
    </div>
  );
}

// ── Community Post Card ───────────────────────────────────────────────────────
function PostCard({ post, onBrew, onImportRecipe, onLike, onDelete }) {
  const [importing, setImporting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [imported, setImported] = useState(false);

  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setLikesCount(c => c + 1);
    try { await onLike(post.id); } catch { setLiked(false); setLikesCount(c => c - 1); }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImportRecipe(post.attachedRecipe);
      setImported(true);
    } finally { setImporting(false); }
  };

  return (
    <div className="premium-card p-5 space-y-4">
      {/* Post header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-luxury-umber/10 flex items-center justify-center text-sm font-bold text-luxury-umber shrink-0">
          {initials(post.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-luxury-umber">{post.authorName || "Anonymous"}</span>
            <span className="text-[10px] text-luxury-clay/60">{timeAgo(post.createdAt)}</span>
          </div>
          <h3 className="font-semibold text-luxury-umber mt-0.5 leading-snug">{post.title}</h3>
        </div>
      </div>

      {/* Post body */}
      {post.body && (
        <p className="text-sm text-luxury-clay leading-relaxed">{post.body}</p>
      )}

      {/* Attached recipe */}
      {post.attachedRecipe && (
        <AttachedRecipeCard
          recipe={post.attachedRecipe}
          onBrew={onBrew}
          onImport={imported ? undefined : handleImport}
          importing={importing}
        />
      )}
      {imported && (
        <div className="text-xs text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-lg text-center">
          Added to My Recipes!
        </div>
      )}

      {/* Post footer */}
      <div className="flex items-center gap-4 pt-1 border-t border-luxury-clay/10">
        <button type="button" onClick={handleLike}
          className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
            liked ? "text-luxury-gold" : "text-luxury-clay/60 hover:text-luxury-gold"
          }`}>
          <span className="text-base">{liked ? "♥" : "♡"}</span>
          <span>{likesCount}</span>
        </button>
        <div className="flex-1" />
        {onDelete && (
          <button type="button" onClick={() => onDelete(post.id)}
            className="text-[10px] text-luxury-clay/40 hover:text-red-400 transition-colors">
            delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Compose Post Modal ────────────────────────────────────────────────────────
function ComposeModal({ myRecipes, preAttachedRecipe, onClose, onPost }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [attachedRecipeId, setAttachedRecipeId] = useState(preAttachedRecipe ? String(preAttachedRecipe.id) : "");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!title.trim()) return;
    setPosting(true);
    try {
      await onPost({
        title: title.trim(),
        body: body.trim() || null,
        authorName: authorName.trim() || null,
        recipeId: attachedRecipeId ? Number(attachedRecipeId) : null,
      });
      onClose();
    } finally { setPosting(false); }
  };

  const customRecipes = myRecipes.filter(r => !r.isBuiltIn);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-luxury-clay/10 flex items-center justify-between">
          <h3 className="font-bold text-luxury-umber">New Community Post</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-luxury-stone/30 text-luxury-clay">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Your Name</label>
            <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)}
              placeholder="e.g. Vansh"
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="What are you sharing?"
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Body</label>
            <textarea rows={4} value={body} onChange={e => setBody(e.target.value)}
              placeholder="Share your experience, tips, thoughts on this recipe…"
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold resize-none" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Attach a Recipe (optional)</label>
            <select value={attachedRecipeId} onChange={e => setAttachedRecipeId(e.target.value)}
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
              <option value="">— No recipe —</option>
              {customRecipes.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.brewerType})</option>
              ))}
            </select>
            {customRecipes.length === 0 && (
              <p className="text-[10px] text-luxury-clay mt-1">
                Create a recipe in My Recipes to attach it to a post.
              </p>
            )}
            {attachedRecipeId && (() => {
              const r = customRecipes.find(r => String(r.id) === attachedRecipeId);
              if (!r) return null;
              return (
                <div className="mt-2 text-[11px] text-luxury-clay bg-luxury-stone/30 rounded-lg px-3 py-2">
                  {r.name} · {r.brewerType}
                  {r.coffeeGrams && r.waterGrams && ` · 1:${(r.waterGrams / r.coffeeGrams).toFixed(1)}`}
                  {r.steps?.length > 0 && ` · ${r.steps.filter(s => s.pourGrams > 0).length} pours`}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="p-4 border-t border-luxury-clay/10 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-luxury-clay/40 text-luxury-clay rounded-xl text-sm font-bold hover:border-luxury-umber transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handlePost} disabled={posting || !title.trim()}
            className="flex-1 py-2.5 bg-luxury-umber text-white rounded-xl text-sm font-bold hover:bg-luxury-dark transition-colors disabled:opacity-50">
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

// ── Recipe Card (My Recipes tab) ───────────────────────────────────────────────
function RecipeCard({ recipe, onView, onEdit, onFork, onDelete, onBrew, onShare }) {
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

      {recipe.steps?.length > 0 && (
        <div className="text-[10px] text-luxury-clay/70">
          {recipe.steps.length} steps · {recipe.steps.filter(s => s.pourGrams > 0).length} pours
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-luxury-clay/10">
        <button type="button" onClick={() => onBrew(recipe)}
          className="flex-1 py-1.5 bg-luxury-gold/90 text-luxury-umber text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-luxury-gold transition-colors">
          Brew
        </button>
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
            <button type="button" onClick={() => onShare(recipe)}
              className="flex-1 py-1.5 border border-luxury-gold/50 text-luxury-gold text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-luxury-gold/10 transition-colors">
              Post
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

// ── Step Editor ───────────────────────────────────────────────────────────────
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

// ── Recipe Modal ──────────────────────────────────────────────────────────────
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
  const [mode, setMode] = useState(initMode);
  const [form, setForm] = useState(initMode === "new" ? EMPTY_FORM : recipeToForm(recipe));
  const [saving, setSaving] = useState(false);
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const ratio = form.coffeeGrams && form.waterGrams
    ? (Number(form.waterGrams) / Number(form.coffeeGrams)).toFixed(1) : null;

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
              {recipe?.authorName && (
                <div className="text-xs text-luxury-clay">Shared by <span className="font-semibold">{recipe.authorName}</span></div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Coffee", recipe?.coffeeGrams ? `${recipe.coffeeGrams}g` : "—"],
                  ["Water", recipe?.waterGrams ? `${recipe.waterGrams}g` : "—"],
                  ["Ratio", recipe?.coffeeGrams && recipe?.waterGrams ? `1 : ${(recipe.waterGrams / recipe.coffeeGrams).toFixed(1)}` : "—"],
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
                        <div className="w-8 h-8 rounded-full bg-luxury-umber/10 flex items-center justify-center text-xs font-bold text-luxury-umber shrink-0">{i + 1}</div>
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

// ── Main RecipesPage ──────────────────────────────────────────────────────────
function RecipesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("my"); // "my" | "community"

  // My recipes state
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [composeModal, setComposeModal] = useState(null); // { preAttachedRecipe? }

  // Community feed state
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  const loadRecipes = async () => {
    setLoading(true);
    try { setRecipes(await fetchRecipes()); } finally { setLoading(false); }
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    try { setPosts(await fetchPosts()); setPostsLoaded(true); } finally { setPostsLoading(false); }
  };

  useEffect(() => { loadRecipes(); }, []);

  useEffect(() => {
    if (tab === "community" && !postsLoaded) loadPosts();
  }, [tab]);

  const handleSaveRecipe = async (payload, id) => {
    if (id) await updateRecipe(id, payload);
    else await createRecipe(payload);
    await loadRecipes();
  };

  const handleForkRecipe = async (recipe) => {
    await forkRecipe(recipe);
    await loadRecipes();
  };

  const handleDeleteRecipe = async (id) => {
    if (!confirm("Delete this recipe?")) return;
    await deleteRecipe(id);
    await loadRecipes();
  };

  const handlePost = async (payload) => {
    await createPost(payload);
    await loadPosts();
  };

  const handleLike = async (postId) => {
    await likePost(postId);
    // optimistic update already done in PostCard
  };

  const handleDeletePost = async (postId) => {
    if (!confirm("Delete this post?")) return;
    await deletePost(postId);
    setPosts(p => p.filter(x => x.id !== postId));
  };

  const handleBrew = (recipe) => navigate("/brew/now", { state: { recipeId: recipe.id } });

  const builtIn = recipes.filter(r => r.isBuiltIn);
  const mine = recipes.filter(r => !r.isBuiltIn);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-luxury-umber">Recipes</h2>
          <p className="text-sm text-luxury-clay mt-0.5">
            {tab === "my"
              ? `${mine.length} custom recipe${mine.length !== 1 ? "s" : ""}`
              : `${posts.length} post${posts.length !== 1 ? "s" : ""} from the community`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "my" && (
            <button type="button" onClick={() => setModal({ mode: "new" })}
              className="flex items-center gap-2 px-4 py-2 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors">
              <span className="text-base leading-none">+</span> New Recipe
            </button>
          )}
          {tab === "community" && (
            <button type="button" onClick={() => setComposeModal({})}
              className="flex items-center gap-2 px-4 py-2 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors">
              <span className="text-base leading-none">+</span> New Post
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-luxury-clay/20">
        {[["my", "My Recipes"], ["community", "Community"]].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all -mb-px ${
              tab === key ? "border-luxury-gold text-luxury-umber" : "border-transparent text-luxury-clay hover:text-luxury-umber"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── My Recipes Tab ── */}
      {tab === "my" && (
        <>
          {loading ? (
            <div className="py-20 text-center text-luxury-clay text-sm">Loading recipes…</div>
          ) : (
            <>
              {builtIn.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold mb-3">Built-in</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {builtIn.map(r => (
                      <RecipeCard key={r.id} recipe={r}
                        onView={r => setModal({ mode: "view", recipe: r })}
                        onEdit={r => setModal({ mode: "edit", recipe: r })}
                        onFork={handleForkRecipe}
                        onDelete={handleDeleteRecipe}
                        onBrew={handleBrew}
                        onShare={() => {}} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold mb-3">My Recipes</h3>
                {mine.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-luxury-clay/20 rounded-2xl">
                    <div className="text-3xl mb-3">📋</div>
                    <div className="font-bold text-luxury-umber mb-1">No custom recipes yet</div>
                    <div className="text-sm text-luxury-clay mb-4">Create your own or import one from the community.</div>
                    <div className="flex justify-center gap-2">
                      <button type="button" onClick={() => setModal({ mode: "new" })}
                        className="px-5 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors">
                        Create Recipe
                      </button>
                      <button type="button" onClick={() => setTab("community")}
                        className="px-5 py-2.5 border border-luxury-clay/40 text-luxury-clay text-sm font-bold rounded-xl hover:border-luxury-umber hover:text-luxury-umber transition-colors">
                        Browse Community
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mine.map(r => (
                      <RecipeCard key={r.id} recipe={r}
                        onView={r => setModal({ mode: "view", recipe: r })}
                        onEdit={r => setModal({ mode: "edit", recipe: r })}
                        onFork={handleForkRecipe}
                        onDelete={handleDeleteRecipe}
                        onBrew={handleBrew}
                        onShare={r => setComposeModal({ preAttachedRecipe: r })} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {/* ── Community Tab ── */}
      {tab === "community" && (
        <>
          {postsLoading ? (
            <div className="py-20 text-center text-luxury-clay text-sm">Loading community…</div>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-luxury-clay/20 rounded-2xl">
              <div className="text-3xl mb-3">☕</div>
              <div className="font-bold text-luxury-umber mb-1">No posts yet</div>
              <div className="text-sm text-luxury-clay mb-4">
                Share a brew, a recipe, or a tip with the community.
              </div>
              <button type="button" onClick={() => setComposeModal({})}
                className="px-5 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors">
                Write a Post
              </button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {posts.map(post => (
                <PostCard key={post.id} post={post}
                  onBrew={handleBrew}
                  onImportRecipe={handleForkRecipe}
                  onLike={handleLike}
                  onDelete={handleDeletePost} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {modal && (
        <RecipeModal recipe={modal.recipe} mode={modal.mode}
          onClose={() => setModal(null)} onSave={handleSaveRecipe} />
      )}
      {composeModal && (
        <ComposeModal
          myRecipes={mine}
          preAttachedRecipe={composeModal.preAttachedRecipe}
          onClose={() => setComposeModal(null)}
          onPost={handlePost} />
      )}
    </div>
  );
}

export default RecipesPage;
