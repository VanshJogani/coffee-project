import React from "react";

function SkeletonCard() {
  return (
    <div className="premium-card flex flex-row sm:flex-col p-3 sm:p-5 bg-luxury-stone/20 animate-pulse">
      {/* Image placeholder */}
      <div className="w-[110px] h-[110px] sm:w-full sm:h-auto sm:aspect-[4/3] rounded-xl bg-luxury-clay/15 sm:mb-5 shrink-0" />

      {/* Content placeholder */}
      <div className="flex-1 flex flex-col gap-2 sm:gap-3 ml-3 sm:ml-0">
        {/* Roaster */}
        <div className="h-3 w-20 bg-luxury-clay/15 rounded" />
        {/* Name */}
        <div className="h-4 w-full bg-luxury-clay/15 rounded" />
        <div className="h-4 w-3/4 bg-luxury-clay/15 rounded hidden sm:block" />
        {/* Tasting notes */}
        <div className="h-3 w-full bg-luxury-clay/10 rounded mt-1" />
        {/* Price row */}
        <div className="mt-auto pt-2 sm:pt-4 border-t border-luxury-clay/10 flex items-center justify-between">
          <div className="h-3 w-16 bg-luxury-clay/15 rounded" />
          <div className="h-4 w-14 bg-luxury-clay/15 rounded" />
        </div>
      </div>
    </div>
  );
}

export default SkeletonCard;
