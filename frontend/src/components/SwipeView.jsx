import React, { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY = "coffee-swipe-preferences";

function getPreferences() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { liked: [], disliked: [] };
  } catch { return { liked: [], disliked: [] }; }
}

function savePreferences(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function SwipeView({ products, onProductClick }) {
  const [queue, setQueue] = useState([]);
  const [prefs, setPrefs] = useState(getPreferences);
  const [swipeDir, setSwipeDir] = useState(null); // "left" | "right" | null
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [tab, setTab] = useState("swipe"); // "swipe" | "liked" | "passed"
  const startX = useRef(0);
  const cardRef = useRef(null);

  useEffect(() => {
    const seen = new Set([...prefs.liked, ...prefs.disliked]);
    const unseen = products.filter(p => !seen.has(p.id));
    setQueue(unseen);
  }, [products, prefs]);

  const likedProducts = products.filter(p => prefs.liked.includes(p.id));
  const dislikedProducts = products.filter(p => prefs.disliked.includes(p.id));

  const currentCard = queue[0];
  const nextCard = queue[1];

  const handleSwipe = useCallback((direction) => {
    if (!currentCard) return;
    setSwipeDir(direction);

    setTimeout(() => {
      const newPrefs = { ...prefs };
      if (direction === "right") {
        newPrefs.liked = [...newPrefs.liked, currentCard.id];
      } else {
        newPrefs.disliked = [...newPrefs.disliked, currentCard.id];
      }
      savePreferences(newPrefs);
      setPrefs(newPrefs);
      setSwipeDir(null);
      setDragX(0);
    }, 300);
  }, [currentCard, prefs]);

  const handlePointerDown = (e) => {
    startX.current = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    setDragX(x - startX.current);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragX) > 100) {
      handleSwipe(dragX > 0 ? "right" : "left");
    } else {
      setDragX(0);
    }
  };

  const handleReset = () => {
    const emptyPrefs = { liked: [], disliked: [] };
    savePreferences(emptyPrefs);
    setPrefs(emptyPrefs);
    setTab("swipe");
  };

  const handleRemove = (id, from) => {
    const newPrefs = { ...prefs };
    newPrefs[from] = newPrefs[from].filter(x => x !== id);
    savePreferences(newPrefs);
    setPrefs(newPrefs);
  };

  const handleMove = (id, from, to) => {
    const newPrefs = { ...prefs };
    newPrefs[from] = newPrefs[from].filter(x => x !== id);
    newPrefs[to] = [...newPrefs[to], id];
    savePreferences(newPrefs);
    setPrefs(newPrefs);
  };

  const rotation = dragX * 0.1;
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 400);

  const getCardStyle = () => {
    if (swipeDir === "right") return { transform: "translateX(120%) rotate(20deg)", opacity: 0, transition: "all 0.3s ease-out" };
    if (swipeDir === "left") return { transform: "translateX(-120%) rotate(-20deg)", opacity: 0, transition: "all 0.3s ease-out" };
    if (isDragging || dragX !== 0) return { transform: `translateX(${dragX}px) rotate(${rotation}deg)`, transition: "none" };
    return { transform: "translateX(0) rotate(0)", transition: "all 0.2s ease-out" };
  };

  const renderList = (items, listType) => {
    if (!items.length) {
      return (
        <div className="py-16 text-center text-sm text-luxury-clay">
          No coffees {listType === "liked" ? "liked" : "passed"} yet.
        </div>
      );
    }
    return (
      <div className="space-y-3 py-4 max-w-lg mx-auto w-full">
        {items.map(p => (
          <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-luxury-clay/10">
            <button type="button" onClick={() => onProductClick(p)} className="shrink-0">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-luxury-clay/10 flex items-center justify-center text-[10px] text-luxury-clay">No img</div>
              )}
            </button>
            <button type="button" onClick={() => onProductClick(p)} className="flex-1 text-left min-w-0">
              <div className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold">{p.roaster}</div>
              <div className="text-sm font-semibold text-luxury-umber truncate">{p.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                {p.roastType && <span className="text-[10px] text-luxury-clay">{p.roastType}</span>}
                {p.price != null && <span className="text-[10px] font-bold text-luxury-umber">₹{Number(p.price).toLocaleString("en-IN")}</span>}
              </div>
            </button>
            <div className="flex flex-col gap-1 shrink-0">
              {listType === "liked" ? (
                <button
                  type="button"
                  onClick={() => handleMove(p.id, "liked", "disliked")}
                  className="w-7 h-7 rounded-full border border-red-200 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors"
                  title="Move to passed"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleMove(p.id, "disliked", "liked")}
                  className="w-7 h-7 rounded-full border border-green-200 flex items-center justify-center text-green-500 hover:bg-green-50 transition-colors"
                  title="Move to liked"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(p.id, listType)}
                className="w-7 h-7 rounded-full border border-luxury-clay/20 flex items-center justify-center text-luxury-clay hover:bg-luxury-stone/20 transition-colors"
                title="Remove (re-swipe later)"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Tabs */}
      <div className="flex items-center bg-white rounded-xl shadow-sm border border-luxury-clay/10 overflow-hidden">
        {[
          { key: "swipe", label: "Swipe", count: queue.length },
          { key: "liked", label: "Liked", count: prefs.liked.length },
          { key: "passed", label: "Passed", count: prefs.disliked.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              tab === key
                ? "bg-luxury-umber text-white"
                : "text-luxury-clay hover:text-luxury-umber hover:bg-luxury-stone/20"
            }`}
          >
            {label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              tab === key ? "bg-white/20" : "bg-luxury-stone/40"
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "liked" && renderList(likedProducts, "liked")}
      {tab === "passed" && renderList(dislikedProducts, "disliked")}

      {tab === "swipe" && (
        <>
          {!currentCard ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="text-4xl">☕</div>
              <p className="text-sm text-luxury-umber font-medium">You've seen all the coffees!</p>
              <p className="text-xs text-luxury-clay">
                {prefs.liked.length} liked, {prefs.disliked.length} passed
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setTab("liked")}
                  className="px-5 py-2 bg-luxury-umber text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-luxury-gold transition-colors"
                >
                  View Liked
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2 border border-luxury-clay/20 text-luxury-umber rounded-full text-xs font-bold uppercase tracking-widest hover:bg-luxury-stone/20 transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-luxury-clay">
                <span>{queue.length} remaining</span>
              </div>

              {/* Card Stack */}
              <div className="relative w-full max-w-sm h-[480px]">
                {nextCard && (
                  <div className="absolute inset-0 mx-auto w-[95%] top-2 rounded-2xl bg-white shadow-md overflow-hidden opacity-60 scale-[0.97]">
                    <div className="aspect-[4/3] w-full bg-luxury-clay/10">
                      {nextCard.imageUrl && (
                        <img src={nextCard.imageUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  </div>
                )}

                <div
                  ref={cardRef}
                  className="absolute inset-0 rounded-2xl bg-white shadow-xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
                  style={getCardStyle()}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={() => { if (isDragging) handlePointerUp(); }}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                >
                  {dragX > 50 && (
                    <div className="absolute top-6 left-6 z-20 px-4 py-2 border-3 border-green-500 rounded-lg rotate-[-15deg]">
                      <span className="text-green-500 text-2xl font-black">LIKE</span>
                    </div>
                  )}
                  {dragX < -50 && (
                    <div className="absolute top-6 right-6 z-20 px-4 py-2 border-3 border-red-400 rounded-lg rotate-[15deg]">
                      <span className="text-red-400 text-2xl font-black">NOPE</span>
                    </div>
                  )}

                  <div className="aspect-[4/3] w-full overflow-hidden bg-luxury-clay/10 relative">
                    {currentCard.imageUrl ? (
                      <img src={currentCard.imageUrl} alt={currentCard.name} className="h-full w-full object-cover" draggable="false" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-luxury-clay italic">No image</div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
                    {currentCard.price != null && (
                      <div className="absolute bottom-3 right-4 text-white text-right">
                        <div className="text-lg font-black drop-shadow">
                          <span className="text-xs mr-0.5">₹</span>
                          {Number(currentCard.price).toLocaleString("en-IN")}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="text-[9px] uppercase tracking-widest text-luxury-gold font-bold">{currentCard.roaster}</div>
                    <div className="text-base font-bold text-luxury-umber leading-tight line-clamp-1">{currentCard.name}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentCard.roastType && (
                        <span className="px-2 py-0.5 rounded-full bg-luxury-stone/30 text-[10px] text-luxury-umber font-medium">{currentCard.roastType}</span>
                      )}
                      {currentCard.origin && (
                        <span className="px-2 py-0.5 rounded-full bg-luxury-stone/30 text-[10px] text-luxury-umber font-medium">{currentCard.origin}</span>
                      )}
                    </div>
                    {currentCard.tastingNotes && (
                      <p className="text-xs text-luxury-umber/50 italic line-clamp-2">"{currentCard.tastingNotes}"</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => handleSwipe("left")}
                  className="w-14 h-14 rounded-full bg-white border-2 border-red-300 flex items-center justify-center text-red-400 shadow-md hover:bg-red-50 hover:scale-110 transition-all"
                  aria-label="Pass"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => onProductClick(currentCard)}
                  className="w-10 h-10 rounded-full bg-white border border-luxury-clay/20 flex items-center justify-center text-luxury-umber shadow-sm hover:bg-luxury-stone/20 transition-all"
                  aria-label="View details"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwipe("right")}
                  className="w-14 h-14 rounded-full bg-white border-2 border-green-400 flex items-center justify-center text-green-500 shadow-md hover:bg-green-50 hover:scale-110 transition-all"
                  aria-label="Like"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>

              <p className="text-[10px] text-luxury-clay">Swipe right to like, left to pass</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default SwipeView;
