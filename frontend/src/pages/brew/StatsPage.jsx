import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { fetchBrewLogs, fetchInventory } from "../../api/client";

const COLORS = ["#5c3b1e", "#d4a853", "#b87333", "#a0522d", "#8b6914", "#c0813a"];

function StatCard({ title, children }) {
  return (
    <div className="premium-card p-5">
      <div className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold mb-4">{title}</div>
      {children}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="h-48 flex items-center justify-center text-luxury-clay/60 text-sm">{message}</div>
  );
}

function groupByWeek(logs) {
  const weeks = {};
  logs.forEach(l => {
    const d = new Date(l.createdAt);
    // Get ISO week start (Monday)
    const day = d.getDay() || 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - day + 1);
    const key = mon.toISOString().slice(0, 10);
    weeks[key] = (weeks[key] || 0) + 1;
  });
  // Last 8 weeks
  const result = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1 - i * 7);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    result.push({ week: label, brews: weeks[key] || 0 });
  }
  return result;
}

function StatsPage() {
  const [logs, setLogs] = useState([]);
  const [beans, setBeans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBeanId, setSelectedBeanId] = useState("");

  useEffect(() => {
    Promise.all([fetchBrewLogs(), fetchInventory()])
      .then(([l, b]) => { setLogs(l); setBeans(b); if (b.length > 0) setSelectedBeanId(String(b[0].id)); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-luxury-clay text-sm">Loading stats…</div>;

  if (logs.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-5xl mb-4">📊</div>
        <div className="font-bold text-luxury-umber mb-1">No data yet</div>
        <div className="text-sm text-luxury-clay">Log at least one brew session to see your stats.</div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  // 1. Frequency — brews per week (last 8 weeks)
  const weekData = groupByWeek(logs);
  const totalThisWeek = weekData[weekData.length - 1]?.brews || 0;

  // Most-used bean
  const beanCounts = {};
  logs.forEach(l => { if (l.beanInventoryId) beanCounts[l.beanInventoryId] = (beanCounts[l.beanInventoryId] || 0) + 1; });
  const topBeanId = Object.entries(beanCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topBean = beans.find(b => String(b.id) === String(topBeanId));

  // Most-used brewer
  const brewerCounts = {};
  logs.forEach(l => { if (l.brewerName) brewerCounts[l.brewerName] = (brewerCounts[l.brewerName] || 0) + 1; });
  const topBrewer = Object.entries(brewerCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // 2. Bean progression — rating over time for selected bean
  const beanLogs = selectedBeanId
    ? logs.filter(l => String(l.beanInventoryId) === selectedBeanId && l.rating > 0)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((l, i) => ({
          brew: i + 1,
          rating: l.rating,
          date: new Date(l.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        }))
    : [];

  // 3. Consumption — grams per bean
  const gramsByBean = {};
  logs.forEach(l => {
    if (l.beanInventoryId && l.coffeeGrams) {
      gramsByBean[l.beanInventoryId] = (gramsByBean[l.beanInventoryId] || 0) + l.coffeeGrams;
    }
  });
  const pieData = Object.entries(gramsByBean).map(([id, grams]) => {
    const bean = beans.find(b => String(b.id) === id);
    return { name: bean?.displayName || `Bean #${id}`, value: Math.round(grams) };
  }).sort((a, b) => b.value - a.value);
  const totalGrams = pieData.reduce((s, d) => s + d.value, 0);

  // 4. Brew time vs rating scatter
  const scatterData = logs
    .filter(l => l.brewTimeSec && l.rating)
    .map(l => ({ time: Math.round(l.brewTimeSec / 10) * 10, rating: l.rating }));

  // Average rating
  const rated = logs.filter(l => l.rating > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, l) => s + l.rating, 0) / rated.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-luxury-umber">Stats</h2>
        <p className="text-sm text-luxury-clay mt-0.5">{logs.length} total brews logged</p>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["This week", `${totalThisWeek} brew${totalThisWeek !== 1 ? "s" : ""}`],
          ["Total brews", logs.length],
          ["Avg rating", avgRating ? `${avgRating} / 5` : "—"],
          ["Fav brewer", topBrewer || "—"],
        ].map(([label, val]) => (
          <div key={label} className="premium-card p-4 text-center">
            <div className="text-[9px] uppercase tracking-widest text-luxury-clay font-bold">{label}</div>
            <div className="text-lg font-bold text-luxury-umber mt-1">{val}</div>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Usage Frequency */}
        <StatCard title="Brews per Week">
          {weekData.every(d => d.brews === 0) ? (
            <EmptyState message="No brews in the last 8 weeks." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9c7c6b" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9c7c6b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e8e0d4" }} />
                <Bar dataKey="brews" fill="#5c3b1e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {topBean && (
            <div className="mt-3 flex items-center gap-2 text-xs text-luxury-clay">
              <span className="font-bold text-luxury-umber">Fav bean:</span> {topBean.displayName}
            </div>
          )}
        </StatCard>

        {/* 2. Bean Progression */}
        <StatCard title="Rating Over Time">
          <div className="mb-3">
            <select value={selectedBeanId} onChange={e => setSelectedBeanId(e.target.value)}
              className="rounded-lg border border-luxury-clay/40 px-3 py-1.5 text-xs focus:outline-none focus:border-luxury-gold bg-white">
              <option value="">— Pick a bean —</option>
              {beans.map(b => <option key={b.id} value={b.id}>{b.displayName}</option>)}
            </select>
          </div>
          {beanLogs.length < 2 ? (
            <EmptyState message="Log at least 2 rated brews with this bean." />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={beanLogs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9c7c6b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: "#9c7c6b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e8e0d4" }} />
                <Line type="monotone" dataKey="rating" stroke="#d4a853" strokeWidth={2} dot={{ fill: "#d4a853", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </StatCard>

        {/* 3. Consumption */}
        <StatCard title="Grams Used per Bean">
          {pieData.length === 0 ? (
            <EmptyState message="Log brews with coffeeGrams to see consumption." />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v) => [`${v}g`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {pieData.slice(0, 5).map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate text-luxury-clay">{d.name}</span>
                    <span className="font-bold text-luxury-umber">{d.value}g</span>
                  </div>
                ))}
                <div className="text-[10px] text-luxury-clay/70 pt-1">Total: {totalGrams}g</div>
              </div>
            </div>
          )}
        </StatCard>

        {/* 4. Brew Time vs Rating */}
        <StatCard title="Brew Time vs Rating">
          {scatterData.length < 3 ? (
            <EmptyState message="Log at least 3 rated brews with brew times." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
                <XAxis type="number" dataKey="time" name="Brew Time (s)"
                  tick={{ fontSize: 10, fill: "#9c7c6b" }} axisLine={false} tickLine={false}
                  label={{ value: "seconds", position: "insideBottom", offset: -2, fontSize: 10, fill: "#9c7c6b" }} />
                <YAxis type="number" dataKey="rating" name="Rating" domain={[0, 5]}
                  tick={{ fontSize: 10, fill: "#9c7c6b" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e8e0d4" }}
                  formatter={(v, name) => [name === "time" ? `${v}s` : `${v} ★`, name === "time" ? "Time" : "Rating"]} />
                <Scatter data={scatterData} fill="#b87333" opacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </StatCard>

      </div>
    </div>
  );
}

export default StatsPage;
