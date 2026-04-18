import React, { useState, useRef } from "react";
import RatingStars from "./RatingStars";

function CardCarousel({ products, onProductClick }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);

  if (!products.length) {
    return <div className="py-20 text-center text-sm text-luxury-clay">No coffees to show.</div>;
  }

  const p = products[index];
  const hasPrev = index > 0;
  const hasNext = index < products.length - 1;

  const goTo = (i) => setIndex(Math.max(0, Math.min(i, products.length - 1)));

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0 && hasNext) goTo(index + 1);
      if (dx > 0 && hasPrev) goTo(index - 1);
    }
    touchStartX.current = null;
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Counter */}
      <div className="text-xs text-luxury-clay font-medium">
        {index + 1} / {products.length}
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-md"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={() => onProductClick(p)}
          className="w-full bg-white rounded-2xl shadow-xl overflow-hidden text-left transition-all duration-300 hover:shadow-2xl group"
        >
          {/* Image */}
          <div className="aspect-[4/3] w-full overflow-hidden bg-luxury-clay/10 relative">
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt={p.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-luxury-clay text-sm italic">
                No image
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
            {p.price != null && (
              <div className="absolute bottom-3 right-4 text-white text-right">
                <div className="text-xl font-black drop-shadow-md">
                  <span className="text-sm font-medium mr-0.5">₹</span>
                  {Number(p.price).toLocaleString("en-IN")}
                </div>
                {p.quantity && p.quantity !== "Standard" && (
                  <div className="text-xs opacity-80 font-medium">{p.quantity}</div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold">
              {p.roaster}
            </div>
            <div className="text-lg font-bold text-luxury-umber leading-snug">{p.name}</div>

            <div className="flex flex-wrap gap-2">
              {p.origin && (
                <span className="px-2.5 py-1 rounded-full bg-luxury-stone/30 text-[11px] text-luxury-umber font-medium">
                  {p.origin}
                </span>
              )}
              {p.roastType && (
                <span className="px-2.5 py-1 rounded-full bg-luxury-stone/30 text-[11px] text-luxury-umber font-medium">
                  {p.roastType}
                </span>
              )}
            </div>

            {p.tastingNotes && (
              <p className="text-sm leading-relaxed text-luxury-umber/60 italic line-clamp-2">
                "{p.tastingNotes}"
              </p>
            )}

            <div className="pt-2 border-t border-luxury-clay/10">
              <RatingStars value={p.avgRating} count={p.reviewCount} />
            </div>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={!hasPrev}
          className="w-10 h-10 rounded-full bg-white border border-luxury-clay/20 flex items-center justify-center text-luxury-umber shadow-sm hover:bg-luxury-stone/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onProductClick(p)}
          className="px-6 py-2.5 bg-luxury-umber text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-luxury-gold transition-colors"
        >
          View Details
        </button>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={!hasNext}
          className="w-10 h-10 rounded-full bg-white border border-luxury-clay/20 flex items-center justify-center text-luxury-umber shadow-sm hover:bg-luxury-stone/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <p className="text-[10px] text-luxury-clay">Swipe or use arrows to browse</p>
    </div>
  );
}

export default CardCarousel;
