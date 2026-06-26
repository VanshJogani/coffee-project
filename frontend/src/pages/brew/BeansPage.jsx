import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem,
  fetchProducts
} from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";

const GRAM_WARNING = 50;

function GramBar({ grams, max }) {
  const pct = max > 0 ? Math.min(100, (grams / max) * 100) : 0;
  const color = grams < GRAM_WARNING ? "bg-red-400" : grams < max * 0.3 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="w-full bg-luxury-clay/20 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function BeanCard({ bean, onEdit, onDelete, onBrewNow }) {
  const isLow = bean.gramsRemaining < GRAM_WARNING;
  return (
    <div className="premium-card p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {bean.imageUrl ? (
          <img src={bean.imageUrl} alt={bean.displayName} className="w-14 h-14 rounded-lg object-cover shrink-0 bg-luxury-clay/20" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-luxury-gold/10 border border-luxury-gold/20 flex items-center justify-center text-2xl shrink-0">☕</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold truncate">{bean.displayRoaster || "Custom"}</div>
          <div className="font-semibold text-sm text-luxury-umber leading-snug line-clamp-2">{bean.displayName}</div>
          {bean.roastType && <div className="text-[11px] text-luxury-clay mt-0.5">{bean.roastType}</div>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-luxury-clay">Remaining</span>
          <span className={`text-xs font-bold ${isLow ? "text-red-500" : "text-luxury-umber"}`}>
            {isLow && "⚠ "}{bean.gramsRemaining != null ? `${Math.round(bean.gramsRemaining)}g` : "—"}
          </span>
        </div>
        <GramBar grams={bean.gramsRemaining || 0} max={250} />
      </div>

      {bean.purchaseDate && (
        <div className="text-[10px] text-luxury-clay/70">Bought {bean.purchaseDate}</div>
      )}

      <div className="flex gap-2 pt-1 border-t border-luxury-clay/10">
        <button type="button" onClick={() => onBrewNow(bean)}
          className="flex-1 py-1.5 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-luxury-dark transition-colors">
          Brew
        </button>
        <button type="button" onClick={() => onEdit(bean)}
          className="px-3 py-1.5 border border-luxury-clay/40 text-luxury-clay hover:border-luxury-gold hover:text-luxury-umber rounded-lg text-[11px] transition-colors">
          Edit
        </button>
        <button type="button" onClick={() => onDelete(bean.id)}
          className="px-3 py-1.5 border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 rounded-lg text-[11px] transition-colors">
          ×
        </button>
      </div>
    </div>
  );
}

function AddBeanModal({ onClose, onSave, editBean }) {
  const [tab, setTab] = useState(editBean?.productId ? "catalog" : (editBean ? "custom" : "catalog"));
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({
    customName: editBean?.customName || "",
    customRoaster: editBean?.customRoaster || "",
    gramsRemaining: editBean?.gramsRemaining ?? 250,
    purchaseDate: editBean?.purchaseDate || "",
    openedDate: editBean?.openedDate || "",
    notes: editBean?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!catalogSearch.trim()) { setCatalogResults([]); return; }
    setCatalogLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await fetchProducts({ search: catalogSearch, limit: 20, category: "Coffee" });
        const seen = new Set();
        const unique = (data.data || []).filter(p => {
          const k = `${p.name}::${p.roaster}`;
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
        setCatalogResults(unique);
      } finally { setCatalogLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [catalogSearch]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === "catalog") {
        if (!selectedProduct && !editBean?.productId) return;
        await onSave({
          productId: selectedProduct?.id ?? editBean?.productId,
          gramsRemaining: Number(form.gramsRemaining),
          purchaseDate: form.purchaseDate || null,
          openedDate: form.openedDate || null,
          notes: form.notes || null,
        });
      } else {
        if (!form.customName.trim()) return;
        await onSave({
          customName: form.customName.trim(),
          customRoaster: form.customRoaster.trim() || null,
          gramsRemaining: Number(form.gramsRemaining),
          purchaseDate: form.purchaseDate || null,
          openedDate: form.openedDate || null,
          notes: form.notes || null,
        });
      }
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-luxury-clay/10 flex items-center justify-between">
          <h3 className="font-bold text-luxury-umber">{editBean ? "Edit Bean" : "Add Bean to Inventory"}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-luxury-stone/30 text-luxury-clay">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!editBean && (
          <div className="flex border-b border-luxury-clay/10">
            {["catalog", "custom"].map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors border-b-2 ${
                  tab === t ? "border-luxury-gold text-luxury-umber" : "border-transparent text-luxury-clay hover:text-luxury-umber"
                }`}>
                {t === "catalog" ? "From Catalog" : "Custom Bean"}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "catalog" && !editBean && (
            <div>
              <input type="search" placeholder="Search catalog (Blue Tokai, Araku…)"
                value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
              {catalogLoading && <div className="text-xs text-luxury-clay mt-2">Searching…</div>}
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {catalogResults.map(p => (
                  <button key={p.id} type="button" onClick={() => setSelectedProduct(p)}
                    className={`w-full text-left flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      selectedProduct?.id === p.id ? "bg-luxury-gold/20 border border-luxury-gold/40" : "hover:bg-luxury-stone/30"
                    }`}>
                    {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded object-cover" />}
                    <div>
                      <div className="text-xs font-semibold text-luxury-umber">{p.name}</div>
                      <div className="text-[10px] text-luxury-clay">{p.roaster}</div>
                    </div>
                    {selectedProduct?.id === p.id && <span className="ml-auto text-luxury-gold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "custom" && (
            <div className="space-y-3">
              <input type="text" placeholder="Bean name *" value={form.customName}
                onChange={e => setForm(f => ({ ...f, customName: e.target.value }))}
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
              <input type="text" placeholder="Roaster (optional)" value={form.customRoaster}
                onChange={e => setForm(f => ({ ...f, customRoaster: e.target.value }))}
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Grams Remaining</label>
              <input type="number" min="0" value={form.gramsRemaining}
                onChange={e => setForm(f => ({ ...f, gramsRemaining: e.target.value }))}
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Purchase Date</label>
              <input type="date" value={form.purchaseDate}
                onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Opened Date</label>
            <input type="date" value={form.openedDate}
              onChange={e => setForm(f => ({ ...f, openedDate: e.target.value }))}
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Notes</label>
            <textarea rows={2} value={form.notes} placeholder="Any notes about this bag…"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold resize-none" />
          </div>
        </div>

        <div className="p-4 border-t border-luxury-clay/10 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-luxury-clay/40 text-luxury-clay rounded-xl text-sm font-bold hover:border-luxury-umber hover:text-luxury-umber transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-luxury-umber text-white rounded-xl text-sm font-bold hover:bg-luxury-dark transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save Bean"}
          </button>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

function BeansPage() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const [beans, setBeans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBean, setEditBean] = useState(null);

  const load = async () => {
    if (!user) {
      setBeans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try { setBeans(await fetchInventory()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user]);

  const handleSave = async (payload) => {
    if (editBean) await updateInventoryItem(editBean.id, payload);
    else await createInventoryItem(payload);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this bean from your inventory?")) return;
    await deleteInventoryItem(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-luxury-umber">My Beans</h2>
          <p className="text-sm text-luxury-clay mt-0.5">{beans.length} {beans.length === 1 ? "bag" : "bags"} in your stash</p>
        </div>
        {user && (
          <button type="button" onClick={() => { setEditBean(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors">
            <span className="text-base leading-none">+</span> Add Bean
          </button>
        )}
      </div>

      {loading && <div className="py-20 text-center text-luxury-clay text-sm">Loading your beans…</div>}

      {!loading && !user && (
        <div className="py-20 text-center">
          <div className="text-5xl mb-4">☕</div>
          <div className="font-bold text-luxury-umber mb-1">Sign in to track your beans</div>
          <div className="text-sm text-luxury-clay mb-4">Your bean inventory is private. Sign in to add and manage your stash.</div>
          <button onClick={openAuthModal}
            className="px-5 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors">
            Sign In
          </button>
        </div>
      )}

      {!loading && user && beans.length === 0 && (
        <div className="py-20 text-center">
          <div className="text-5xl mb-4">☕</div>
          <div className="font-bold text-luxury-umber mb-1">No beans yet</div>
          <div className="text-sm text-luxury-clay mb-4">Add your first bag from the catalog or enter a custom bean.</div>
          <button onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors">
            Add Your First Bean
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {beans.map(bean => (
          <BeanCard key={bean.id} bean={bean}
            onEdit={b => { setEditBean(b); setModalOpen(true); }}
            onDelete={handleDelete}
            onBrewNow={bean => navigate("/brew/now", { state: { beanId: bean.id } })}
          />
        ))}
      </div>

      {modalOpen && (
        <AddBeanModal editBean={editBean}
          onClose={() => { setModalOpen(false); setEditBean(null); }}
          onSave={handleSave} />
      )}
    </div>
  );
}

export default BeansPage;
