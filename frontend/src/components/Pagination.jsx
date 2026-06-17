import React from "react";

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mt-6 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => { onPageChange(page - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className="px-4 py-2.5 min-h-[44px] rounded-xl border border-luxury-clay/20 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:border-luxury-gold hover:text-luxury-gold transition-all text-luxury-umber font-semibold text-xs"
      >
        ← Prev
      </button>
      <span className="text-xs text-luxury-umber/60 font-medium px-2">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => { onPageChange(page + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className="px-4 py-2.5 min-h-[44px] rounded-xl border border-luxury-clay/20 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:border-luxury-gold hover:text-luxury-gold transition-all text-luxury-umber font-semibold text-xs"
      >
        Next →
      </button>
    </div>
  );
}

export default Pagination;
