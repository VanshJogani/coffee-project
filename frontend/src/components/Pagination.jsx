import React from "react";

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 mt-4 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-coffee-400"
      >
        Previous
      </button>
      <span className="text-slate-600">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-coffee-400"
      >
        Next
      </button>
    </div>
  );
}

export default Pagination;

