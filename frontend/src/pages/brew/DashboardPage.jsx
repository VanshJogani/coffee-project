import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchBrewLogs, fetchInventory } from "../../api/client";
import SoftAuthGate from "../../components/SoftAuthGate";

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function GramBar({ grams, max = 250 }) {
  const pct = max > 0 ? Math.min(100, (grams / max) * 100) : 0;
  const color = grams < 50 ? "bg-red-400" : grams < max * 0.3 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="w-full bg-luxury-clay/10 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stars({ value }) {
  return (
    <span className="text-xs">
      {[1,2,3,4,5].map(n => (
        <span key={n} className={n <= value ? "text-luxury-gold" : "text-luxury-clay/20"}>★</span>
      ))}
    </span>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [beans, setBeans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchBrewLogs(), fetchInventory()])
      .then(([l, b]) => { setLogs(l); setBeans(b); })
      .finally(() => setLoading(false));
  }, []);

  const recentLogs = logs.slice(0, 5);
  const topBeans = [...beans].sort((a, b) => (b.gramsRemaining || 0) - (a.gramsRemaining || 0)).slice(0, 3);

  // Stats
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const thisWeek = logs.filter(l => new Date(l.createdAt) > weekAgo).length;
  const rated = logs.filter(l => l.rating > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, l) => s + l.rating, 0) / rated.length).toFixed(1)
    : null;
  const brewerCounts = {};
  logs.forEach(l => { if (l.brewerName) brewerCounts[l.brewerName] = (brewerCounts[l.brewerName] || 0) + 1; });
  const topBrewer = Object.entries(brewerCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const lastLog = logs[0];

  if (loading) {
    return <div className="py-20 text-center text-luxury-clay text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-luxury-umber">Dashboard</h2>
        <p className="text-sm text-luxury-clay mt-0.5">Your brew hub at a glance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Quick Brew ── */}
        <div className="premium-card p-5 flex flex-col gap-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">Quick Brew</div>
          <button type="button" onClick={() => navigate("/brew/now")}
            className="w-full py-4 bg-luxury-umber text-white font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-dark transition-colors text-sm">
            ⏱  Start Brewing
          </button>
          {lastLog && (
            <div className="text-xs text-luxury-clay">
              <span className="font-bold text-luxury-umber">Last brew:</span>{" "}
              {lastLog.beanName || lastLog.brewerName || "Unnamed"} — {fmtDate(lastLog.createdAt)}
              <button type="button"
                onClick={() => navigate("/brew/now", {
                  state: {
                    beanId: lastLog.beanInventoryId,
                    recipeId: lastLog.recipeId,
                    prefill: {
                      brewerName: lastLog.brewerName,
                      grinderName: lastLog.grinderName,
                      grindSize: lastLog.grindSize,
                      coffeeGrams: lastLog.coffeeGrams,
                      waterGrams: lastLog.waterGrams,
                      waterTempC: lastLog.waterTempC,
                    },
                  },
                })}
                className="ml-2 underline hover:text-luxury-umber transition-colors">
                Brew again
              </button>
            </div>
          )}
          {!lastLog && (
            <p className="text-xs text-luxury-clay/60 text-center">No brews logged yet.</p>
          )}
        </div>

        {/* ── My Beans snapshot ── */}
        <div className="premium-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">My Beans</div>
            <Link to="/brew/beans" className="text-[10px] text-luxury-clay hover:text-luxury-umber underline">Manage</Link>
          </div>
          {beans.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-4 gap-2">
              <div className="text-3xl">☕</div>
              <p className="text-xs text-luxury-clay text-center">No beans yet.</p>
              <Link to="/brew/beans"
                className="text-xs underline text-luxury-clay hover:text-luxury-umber">Add your first bean</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {topBeans.map(bean => (
                <div key={bean.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-luxury-umber truncate">{bean.displayName}</span>
                    <span className={`text-xs font-bold shrink-0 ml-2 ${bean.gramsRemaining < 50 ? "text-red-500" : "text-luxury-clay"}`}>
                      {bean.gramsRemaining != null ? `${Math.round(bean.gramsRemaining)}g` : "—"}
                    </span>
                  </div>
                  <GramBar grams={bean.gramsRemaining || 0} />
                </div>
              ))}
              {beans.length > 3 && (
                <Link to="/brew/beans" className="text-[10px] text-luxury-clay hover:text-luxury-umber underline">
                  +{beans.length - 3} more beans
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Stats summary ── */}
        <div className="premium-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">Stats</div>
            <Link to="/brew/stats" className="text-[10px] text-luxury-clay hover:text-luxury-umber underline">Full stats</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["This week", thisWeek],
              ["Total", logs.length],
              ["Avg ★", avgRating || "—"],
            ].map(([label, val]) => (
              <div key={label} className="bg-luxury-stone/30 rounded-xl py-3">
                <div className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">{label}</div>
                <div className="text-lg font-bold text-luxury-umber mt-0.5">{val}</div>
              </div>
            ))}
          </div>
          {topBrewer && (
            <div className="text-xs text-luxury-clay">
              <span className="font-bold text-luxury-umber">Fav brewer:</span> {topBrewer}
            </div>
          )}
        </div>

      </div>

      {/* ── Recent Brews ── */}
      <div className="premium-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold">Recent Brews</div>
          <Link to="/brew/log" className="text-[10px] text-luxury-clay hover:text-luxury-umber underline">View all</Link>
        </div>

        {recentLogs.length === 0 ? (
          <div className="py-8 text-center text-luxury-clay/60 text-sm">
            No brews yet.{" "}
            <Link to="/brew/now" className="underline hover:text-luxury-umber">Start your first session.</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentLogs.map(log => {
              const ratio = log.coffeeGrams && log.waterGrams
                ? (log.waterGrams / log.coffeeGrams).toFixed(1) : null;
              return (
                <div key={log.id} className="flex items-center gap-4 py-2.5 border-b border-luxury-clay/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-luxury-umber truncate">
                      {log.beanName || log.brewerName || "Brew session"}
                    </div>
                    <div className="text-[11px] text-luxury-clay flex items-center gap-2 flex-wrap mt-0.5">
                      <span>{fmtDate(log.createdAt)}</span>
                      {log.brewerName && <span>{log.brewerName}</span>}
                      {ratio && <span>1:{ratio}</span>}
                    </div>
                  </div>
                  {log.rating > 0 && <Stars value={log.rating} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

export default function DashboardPageWithGate() {
  return (
    <SoftAuthGate featureName="your dashboard">
      <DashboardPage />
    </SoftAuthGate>
  );
}
