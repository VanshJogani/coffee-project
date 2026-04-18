import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchBrewLogs, deleteBrewLog, fetchInventory } from "../../api/client";

function pad(n) { return String(n).padStart(2, "0"); }
function fmtTime(sec) {
  if (!sec && sec !== 0) return "—";
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function Stars({ value }) {
  return (
    <span className="text-xs">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= value ? "text-luxury-gold" : "text-luxury-clay/20"}>★</span>
      ))}
    </span>
  );
}

function BrewLogCard({ log, onDelete, onBrewAgain }) {
  const [expanded, setExpanded] = useState(false);

  const ratio = log.coffeeGrams && log.waterGrams
    ? (log.waterGrams / log.coffeeGrams).toFixed(1)
    : null;

  return (
    <div className="premium-card overflow-hidden">
      <button type="button" onClick={() => setExpanded(e => !e)}
        className="w-full p-4 text-left flex items-center gap-4 hover:bg-luxury-stone/10 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-luxury-umber truncate">{log.beanName || log.brewerName || "Brew"}</span>
            {log.rating > 0 && <Stars value={log.rating} />}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-luxury-clay flex-wrap">
            <span>{fmtDate(log.createdAt)}</span>
            {log.brewerName && <span>{log.brewerName}</span>}
            {ratio && <span>1:{ratio}</span>}
            {log.brewTimeSec && <span>{fmtTime(log.brewTimeSec)}</span>}
          </div>
        </div>
        <svg className={`w-4 h-4 text-luxury-clay/60 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-luxury-clay/10 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            {[
              ["Coffee", log.coffeeGrams ? `${log.coffeeGrams}g` : "—"],
              ["Water", log.waterGrams ? `${log.waterGrams}g` : "—"],
              ["Temp", log.waterTempC ? `${log.waterTempC}°C` : "—"],
              ["Time", fmtTime(log.brewTimeSec)],
              ["Grind", log.grindSize || "—"],
              ["Grinder", log.grinderName || "—"],
              ["Brewer", log.brewerName || "—"],
              ["Ratio", ratio ? `1 : ${ratio}` : "—"],
            ].map(([label, val]) => (
              <div key={label} className="bg-luxury-stone/30 rounded-lg p-2">
                <div className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">{label}</div>
                <div className="font-semibold text-luxury-umber mt-0.5">{val}</div>
              </div>
            ))}
          </div>

          {log.notes && (
            <div className="bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg p-3">
              <div className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Notes</div>
              <p className="text-xs text-luxury-clay leading-relaxed">{log.notes}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => onBrewAgain(log)}
              className="flex-1 py-2 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-luxury-dark transition-colors">
              Brew Again
            </button>
            <button type="button" onClick={() => onDelete(log.id)}
              className="px-4 py-2 border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 rounded-lg text-[11px] transition-colors">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BrewLogPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [beans, setBeans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterBean, setFilterBean] = useState("");
  const [filterBrewer, setFilterBrewer] = useState("");
  const [filterRating, setFilterRating] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [l, b] = await Promise.all([fetchBrewLogs(), fetchInventory()]);
      setLogs(l);
      setBeans(b);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this brew log?")) return;
    await deleteBrewLog(id);
    await load();
  };

  const handleBrewAgain = (log) => {
    navigate("/brew/now", {
      state: {
        beanId: log.beanInventoryId,
        prefill: {
          brewerName: log.brewerName,
          grinderName: log.grinderName,
          grindSize: log.grindSize,
          coffeeGrams: log.coffeeGrams,
          waterGrams: log.waterGrams,
          waterTempC: log.waterTempC,
        },
      },
    });
  };

  // Unique brewers for filter dropdown
  const brewers = [...new Set(logs.map(l => l.brewerName).filter(Boolean))];

  const filtered = logs.filter(l => {
    if (filterBean && String(l.beanInventoryId) !== filterBean) return false;
    if (filterBrewer && l.brewerName !== filterBrewer) return false;
    if (filterRating && l.rating !== Number(filterRating)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-luxury-umber">Brew Log</h2>
          <p className="text-sm text-luxury-clay mt-0.5">{logs.length} {logs.length === 1 ? "session" : "sessions"} recorded</p>
        </div>
        <button type="button" onClick={() => navigate("/brew/now")}
          className="flex items-center gap-2 px-4 py-2 bg-luxury-umber text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors">
          + Brew Now
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterBean} onChange={e => setFilterBean(e.target.value)}
          className="rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
          <option value="">All beans</option>
          {beans.map(b => <option key={b.id} value={b.id}>{b.displayName}</option>)}
        </select>
        <select value={filterBrewer} onChange={e => setFilterBrewer(e.target.value)}
          className="rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
          <option value="">All brewers</option>
          {brewers.map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={filterRating} onChange={e => setFilterRating(e.target.value)}
          className="rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold bg-white">
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
        </select>
        {(filterBean || filterBrewer || filterRating) && (
          <button type="button" onClick={() => { setFilterBean(""); setFilterBrewer(""); setFilterRating(""); }}
            className="text-sm text-luxury-clay hover:text-luxury-umber underline">
            Clear filters
          </button>
        )}
      </div>

      {loading && <div className="py-20 text-center text-luxury-clay text-sm">Loading brew log…</div>}

      {!loading && logs.length === 0 && (
        <div className="py-20 text-center">
          <div className="text-5xl mb-4">☕</div>
          <div className="font-bold text-luxury-umber mb-1">No brews logged yet</div>
          <div className="text-sm text-luxury-clay mb-4">Head to Brew Now to log your first session.</div>
          <button type="button" onClick={() => navigate("/brew/now")}
            className="px-5 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors">
            Start Brewing
          </button>
        </div>
      )}

      {!loading && logs.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-luxury-clay text-sm">No logs match your filters.</div>
      )}

      <div className="space-y-3">
        {filtered.map(log => (
          <BrewLogCard key={log.id} log={log} onDelete={handleDelete} onBrewAgain={handleBrewAgain} />
        ))}
      </div>
    </div>
  );
}

export default BrewLogPage;
