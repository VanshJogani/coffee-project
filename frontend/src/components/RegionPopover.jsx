import React, { useEffect, useRef } from "react";

/**
 * Disambiguation popover shown when a user clicks a state that has multiple
 * coffee regions (e.g., Karnataka → Coorg, Chikkamagaluru, Bababudan Giri).
 */
export default function RegionPopover({ regions, position, onSelect, onClose }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onCloseRef.current();
      }
    };
    // Small delay to avoid immediately triggering from the same click
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handler);
    };
  }, []);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (!regions || regions.length === 0) return null;

  return (
    <div
      ref={ref}
      data-popover
      className="absolute z-40 bg-[#1A1410]/95 border border-luxury-gold/30 rounded-xl p-2 backdrop-blur-md shadow-2xl animate-in fade-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -110%)",
        minWidth: "200px",
      }}
    >
      {/* Arrow pointing down */}
      <div
        className="absolute left-1/2 -bottom-2 w-4 h-4 bg-[#1A1410]/95 border-r border-b border-luxury-gold/30 rotate-45"
        style={{ transform: "translateX(-50%) rotate(45deg)" }}
      />

      {/* Header */}
      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-luxury-clay/50 px-2 pt-1 pb-2">
        Select a region
      </p>

      {/* Region options */}
      <div className="flex flex-col gap-0.5">
        {regions.map((r) => (
          <button
            key={r.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(r.id);
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-luxury-gold/15 transition-all text-left group"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border"
              style={{ background: r.color + "44", borderColor: r.accent + "55" }}
            >
              {r.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-luxury-light group-hover:text-luxury-gold transition-colors leading-tight">
                {r.name.split(" (")[0]}
              </p>
              <div className="flex gap-1 mt-0.5">
                {r.flavourNotes.slice(0, 2).map((n) => (
                  <span
                    key={n}
                    className="text-[8px] font-semibold uppercase tracking-wide"
                    style={{ color: r.accent + "CC" }}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <svg
              className="w-3 h-3 text-luxury-clay/30 group-hover:text-luxury-gold shrink-0 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
