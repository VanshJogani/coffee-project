import React, { useState } from "react";

function CoffeeRandomizer({ allProducts, onSelectCoffee }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // null | "customize"
  const [selectedRoasts, setSelectedRoasts] = useState([]);
  const [tastingInput, setTastingInput] = useState("");

  const coffeeProducts = allProducts.filter(p => p.category === "Coffee");

  const roastOptions = Array.from(
    new Set(coffeeProducts.map(p => p.roastType).filter(Boolean))
  ).sort();

  const getFilteredPool = () => {
    let pool = coffeeProducts;
    if (selectedRoasts.length) {
      pool = pool.filter(p => selectedRoasts.includes(p.roastType));
    }
    if (tastingInput.trim()) {
      const keywords = tastingInput.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
      pool = pool.filter(p => {
        const notes = `${p.tastingNotes || ""} ${p.description || ""}`.toLowerCase();
        return keywords.some(kw => notes.includes(kw));
      });
    }
    return pool;
  };

  const pickRandom = (pool) => {
    if (!pool || !pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const handleFullyRandom = () => {
    const coffee = pickRandom(coffeeProducts);
    if (coffee) onSelectCoffee(coffee);
    setOpen(false);
    resetState();
  };

  const handleCustomRandom = () => {
    const pool = getFilteredPool();
    if (!pool.length) return;
    const coffee = pickRandom(pool);
    if (coffee) onSelectCoffee(coffee);
    setOpen(false);
    resetState();
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

  if (!coffeeProducts.length) return null;

  return (
    <>
      {/* FAB Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-full bg-luxury-umber text-white shadow-lg hover:bg-luxury-gold hover:scale-105 transition-all duration-300 flex items-center gap-2 group"
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
                  className="w-full py-4 px-5 bg-luxury-umber text-white rounded-xl font-bold text-sm hover:bg-luxury-gold transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Surprise Me!
                </button>
                <button
                  type="button"
                  onClick={() => setMode("customize")}
                  className="w-full py-4 px-5 bg-white border-2 border-luxury-clay/20 text-luxury-umber rounded-xl font-bold text-sm hover:border-luxury-gold transition-colors flex items-center justify-center gap-2"
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
                    {roastOptions.map(r => (
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

                {/* Result count + Action */}
                <div className="pt-2 space-y-3">
                  <p className="text-xs text-center text-luxury-clay">
                    {getFilteredPool().length} coffees match your preferences
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setMode(null)}
                      className="flex-1 py-3 border border-luxury-clay/20 text-luxury-umber rounded-xl text-xs font-bold hover:bg-luxury-stone/20 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCustomRandom}
                      disabled={getFilteredPool().length === 0}
                      className="flex-1 py-3 bg-luxury-umber text-white rounded-xl text-xs font-bold hover:bg-luxury-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Find My Coffee
                    </button>
                  </div>
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
