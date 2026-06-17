import React, { useState } from "react";
import { fetchProducts } from "../api/client";

// Roast options shown in the customize panel — kept static so the UI doesn't
// depend on whatever page happens to be loaded.
const ROAST_OPTIONS = ["Light Roast", "Medium Roast", "Medium-Dark Roast", "Dark Roast"];

function CoffeeRandomizer({ onSelectCoffee }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // null | "customize"
  const [selectedRoasts, setSelectedRoasts] = useState([]);
  const [tastingInput, setTastingInput] = useState("");
  const [picking, setPicking] = useState(false);

  // Fetch a freshly shuffled pool from the API (RANDOM() order each call).
  // _bust is a timestamp param that prevents the browser from returning a cached response.
  const fetchRandomPool = async (roasts, flavourKeywords) => {
    const params = {
      category: "Coffee",
      sort: "discover",
      limit: 200,
      page: 1,
      _bust: Date.now(),
      ...(roasts.length === 1 ? { roastType: roasts[0] } : {}),
      ...(flavourKeywords.length ? { flavour: flavourKeywords.join(",") } : {}),
    };
    const data = await fetchProducts(params);
    return data.data || [];
  };

  const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

  const handleFullyRandom = async () => {
    setPicking(true);
    try {
      const pool = await fetchRandomPool([], []);
      if (pool.length) onSelectCoffee(pickRandom(pool));
    } finally {
      setPicking(false);
      setOpen(false);
      resetState();
    }
  };

  const handleCustomRandom = async () => {
    const keywords = tastingInput.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    setPicking(true);
    try {
      let pool = await fetchRandomPool(selectedRoasts, keywords);
      // Client-side filter for multiple roast types (API only accepts one at a time)
      if (selectedRoasts.length > 1) {
        pool = pool.filter(p => selectedRoasts.includes(p.roastType));
      }
      // Client-side flavour filter when multiple keywords given
      if (keywords.length) {
        pool = pool.filter(p => {
          const text = `${p.tastingNotes || ""} ${p.description || ""}`.toLowerCase();
          return keywords.some(kw => text.includes(kw));
        });
      }
      if (pool.length) onSelectCoffee(pickRandom(pool));
    } finally {
      setPicking(false);
      setOpen(false);
      resetState();
    }
  };

  const resetState = () => {
    setMode(null);
    setSelectedRoasts([]);
    setTastingInput("");
  };

  const toggleRoast = (r) => {
    setSelectedRoasts(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  return (
    <>
      {/* FAB Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 px-5 py-3 rounded-full bg-luxury-umber text-white shadow-lg hover:bg-luxury-gold hover:scale-105 transition-all duration-300 flex items-center gap-2 group"
      >
        <svg className="w-5 h-5 group-hover:animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wider">I'm Feeling Lucky</span>
      </button>

      {/* Randomizer Modal */}
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => { setOpen(false); resetState(); }}
              className="absolute top-4 right-4 p-1 hover:bg-luxury-stone/30 rounded-full transition-colors text-luxury-clay hover:text-luxury-umber"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-2xl mb-1">🎲</div>
              <h3 className="text-lg font-bold text-luxury-umber">I'm Feeling Lucky</h3>
              <p className="text-xs text-luxury-clay mt-1">Discover your next favorite coffee</p>
            </div>

            {mode === null && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleFullyRandom}
                  disabled={picking}
                  className="w-full py-4 px-5 bg-luxury-umber text-white rounded-xl font-bold text-sm hover:bg-luxury-gold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {picking ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  Surprise Me!
                </button>
                <button
                  type="button"
                  onClick={() => setMode("customize")}
                  disabled={picking}
                  className="w-full py-4 px-5 bg-white border-2 border-luxury-clay/20 text-luxury-umber rounded-xl font-bold text-sm hover:border-luxury-gold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  I Know What I Want
                </button>
              </div>
            )}

            {mode === "customize" && (
              <div className="space-y-5">
                {/* Roast Level */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold block mb-2">
                    Roast Level (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ROAST_OPTIONS.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRoast(r)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          selectedRoasts.includes(r)
                            ? "bg-luxury-umber text-white"
                            : "bg-luxury-stone/30 text-luxury-umber hover:bg-luxury-clay/20"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tasting Notes */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold block mb-2">
                    Tasting Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={tastingInput}
                    onChange={(e) => setTastingInput(e.target.value)}
                    placeholder="e.g. chocolate, berry, citrus"
                    className="w-full px-4 py-2.5 rounded-lg border border-luxury-clay/20 text-sm text-luxury-umber placeholder:text-luxury-clay/50 focus:outline-none focus:border-luxury-gold"
                  />
                  <p className="text-[10px] text-luxury-clay mt-1">Comma-separated flavors you like</p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    disabled={picking}
                    className="flex-1 py-3 border border-luxury-clay/20 text-luxury-umber rounded-xl text-xs font-bold hover:bg-luxury-stone/20 transition-colors disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCustomRandom}
                    disabled={picking}
                    className="flex-1 py-3 bg-luxury-umber text-white rounded-xl text-xs font-bold hover:bg-luxury-gold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {picking && (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Find My Coffee
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => { setOpen(false); resetState(); }} />
        </div>
      )}
    </>
  );
}

export default CoffeeRandomizer;
