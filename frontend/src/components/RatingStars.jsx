import React from "react";

export function RatingStars({ value, count }) {
  const rating = Number(value) || 0;
  const fullStars = Math.round(rating);
  const stars = Array.from({ length: 5 }).map((_, i) => (
    <span key={i} className={i < fullStars ? "text-amber-500" : "text-slate-300"}>
      ★
    </span>
  ));

  return (
    <div className="flex items-center gap-1 text-sm">
      <span>{stars}</span>
      <span className="ml-1 text-xs text-slate-600">
        {rating.toFixed(1)} {typeof count === "number" && `(${count})`}
      </span>
    </div>
  );
}

export default RatingStars;

