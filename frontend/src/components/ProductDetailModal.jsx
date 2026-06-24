import React, { useState, useRef } from "react";
import RatingStars from "./RatingStars";
import Reviews from "./Reviews";

function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onCreateReview,
  onDeleteReview,
  fromRandomizer,
  onTryAnother
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const scrollRef = useRef(null);

  if (!isOpen || !product) return null;

  const originQuery = encodeURIComponent(product.origin || product.name);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${originQuery}`;

  const handleTouchStart = (e) => {
    // Only enable swipe-dismiss when scrolled to top
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
    setDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    const diff = e.touches[0].clientY - startYRef.current;
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 120) {
      onClose();
    }
    setDragY(0);
    setDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full h-full md:rounded-2xl md:shadow-2xl md:max-w-3xl md:max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined, opacity: dragY > 80 ? 0.7 : 1 }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-luxury-clay/30" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 md:p-4 border-b border-luxury-clay/10 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] md:text-[8px] uppercase tracking-[0.2em] text-luxury-gold font-bold mb-0.5 truncate">
              {product.roaster}
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <h2 className="text-base md:text-lg font-bold text-luxury-umber leading-tight line-clamp-1">{product.name}</h2>
              <div className="scale-75 origin-left opacity-80 shrink-0 hidden sm:block">
                <RatingStars value={product.avgRating} count={product.reviewCount} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {fromRandomizer && onTryAnother && (
              <button
                type="button"
                onClick={onTryAnother}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-luxury-gold/10 text-luxury-umber text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-luxury-gold/20 transition-colors border border-luxury-gold/30"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Another
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-luxury-stone/30 rounded-full transition-colors text-luxury-clay hover:text-luxury-umber"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile rating row (shown below header on small screens) */}
        <div className="px-4 py-2 border-b border-luxury-clay/5 sm:hidden flex items-center gap-3 shrink-0">
          <RatingStars value={product.avgRating} count={product.reviewCount} />
          {fromRandomizer && onTryAnother && (
            <button
              type="button"
              onClick={onTryAnother}
              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-luxury-gold/10 text-luxury-umber text-[10px] font-bold uppercase tracking-wider rounded-full border border-luxury-gold/30"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Another
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 bg-luxury-light/20" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="grid gap-6 md:gap-8 md:grid-cols-[1.2fr,1.8fr]">
            {/* Left Column: Image & Description */}
            <div className="space-y-4 md:space-y-6">
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-luxury-clay/10 shadow-inner">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-luxury-clay italic text-sm">
                    No image available
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {product.description && (
                  <p className="text-sm leading-relaxed text-luxury-umber/80 whitespace-pre-wrap italic bg-white/50 p-4 rounded-lg border border-luxury-clay/10">
                    "{product.description}"
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {product.roastType && (
                    <div className="bg-white/40 p-3 rounded-lg border border-luxury-clay/10">
                      <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Roast State</div>
                      <div className="text-xs font-semibold text-luxury-umber">{product.roastType}</div>
                    </div>
                  )}
                  {product.origin && (
                    <div className="bg-white/40 p-3 rounded-lg border border-luxury-clay/10">
                      <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold mb-1">Origin</div>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-luxury-umber underline decoration-luxury-gold/30 hover:decoration-luxury-gold"
                      >
                        {product.origin}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Pricing & Reviews */}
            <div className="space-y-6 md:space-y-8">
              {product.tastingNotes && (
                <div className="bg-luxury-umber text-luxury-light p-4 md:p-5 rounded-xl shelf-glow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-luxury-gold/10 rounded-full -mr-8 -mt-8" />
                  <div className="text-[10px] uppercase tracking-[0.2em] text-luxury-gold font-bold mb-2">Tasting Profile</div>
                  <p className="text-sm font-medium leading-relaxed italic">
                    {product.tastingNotes}
                  </p>
                </div>
              )}

              {product.variants && product.variants.length > 0 && (
                <div className="space-y-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-luxury-gold font-bold px-1">Purchase Options</div>
                  <div className="space-y-2">
                    {product.variants.map((v, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-3 md:p-4 rounded-xl border border-luxury-clay/20 shadow-sm hover:border-luxury-gold/50 transition-colors group">
                        <span className="text-sm font-bold text-luxury-umber group-hover:text-black transition-colors">{v.quantity}</span>
                        <span className="text-sm font-black text-luxury-umber bg-luxury-stone/30 px-3 py-1 rounded-md">
                          <span className="text-[10px] font-medium mr-1">₹</span>
                          {Number(v.price).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Desktop CTA - hidden on mobile since we have sticky footer */}
              {product.url && (
                <a
                  href={product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden md:flex items-center justify-center gap-2 w-full py-3 bg-white border border-luxury-umber text-luxury-umber text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-umber hover:text-white transition-all duration-300"
                >
                  View on Roaster's Website
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              <div className="pt-4 border-t border-luxury-clay/20">
                <div className="text-[10px] uppercase tracking-[0.2em] text-luxury-gold font-bold mb-4 px-1">Community Reviews</div>
                <Reviews
                  productId={product.id}
                  reviews={product.reviews || []}
                  onCreate={onCreateReview}
                  onDelete={onDeleteReview}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky bottom CTA for mobile */}
        {product.url && (
          <div className="md:hidden shrink-0 border-t border-luxury-clay/15 px-4 py-3 bg-white pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-luxury-umber text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-luxury-gold transition-all"
            >
              View on Roaster's Website
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductDetailModal;
