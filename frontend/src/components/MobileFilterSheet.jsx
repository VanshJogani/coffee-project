import React, { useRef, useEffect, useState } from "react";
import FiltersPanel from "./FiltersPanel";

function MobileFilterSheet({ isOpen, onClose, filterProps, activeFilterCount }) {
  const sheetRef = useRef(null);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
    setDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      setCurrentY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 120) {
      onClose();
    }
    setCurrentY(0);
    setDragging(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 inset-x-0 max-h-[85vh] bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out"
        style={{ transform: `translateY(${currentY}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-luxury-clay/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-luxury-clay/15 shrink-0">
          <h2 className="text-base font-bold text-luxury-umber">Filters</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={filterProps.onClear}
              className="text-xs font-semibold text-luxury-clay hover:text-luxury-gold transition-colors"
            >
              Reset All
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-2 rounded-full hover:bg-luxury-stone/30 transition-colors"
              aria-label="Close filters"
            >
              <svg className="w-5 h-5 text-luxury-umber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <FiltersPanel {...filterProps} />
        </div>

        {/* Sticky footer CTA */}
        <div className="shrink-0 border-t border-luxury-clay/15 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-luxury-umber text-white rounded-xl font-bold text-sm hover:bg-luxury-gold transition-colors flex items-center justify-center gap-2"
          >
            Show Results
            {activeFilterCount > 0 && (
              <span className="bg-luxury-gold text-luxury-umber text-[10px] font-bold px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileFilterSheet;
