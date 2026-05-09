import React from "react";
import RatingStars from "./RatingStars";

function ProductCard({ product, onClick }) {
  const {
    imageUrl,
    name,
    roaster,
    roastType,
    origin,
    tastingNotes,
    price,
    quantity,
    avgRating,
    reviewCount,
    variants
  } = product;

  return (
    <button
      type="button"
      onClick={onClick}
      className="premium-card flex flex-col p-5 text-left group bg-luxury-stone/20"
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-luxury-clay/20 mb-5 relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-luxury-clay text-sm italic">
            No image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-widest text-luxury-gold font-bold">
          {roaster}
        </div>
        <div className="font-semibold text-sm line-clamp-2 text-luxury-umber leading-snug">{name}</div>
        
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {origin && (
            <div className="text-[11px] text-luxury-umber/60 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-luxury-clay" />
              {origin}
            </div>
          )}
          {roastType && (
            <div className="text-[11px] text-luxury-umber/60 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-luxury-clay" />
              {roastType}
            </div>
          )}
        </div>

        {tastingNotes && (
          <div className="mt-2 text-[11px] leading-relaxed text-luxury-umber/50 line-clamp-2 italic">
            "{tastingNotes}"
          </div>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-luxury-clay/10">
          <RatingStars value={avgRating} count={reviewCount} />
          {(variants && variants.length > 0) ? (
            <div className="text-right">
              <div className="text-xs text-luxury-umber/70 font-medium mb-1">Available options:</div>
              <div className="flex flex-col gap-0.5">
                {variants.map((v, i) => (
                  <div key={i} className="text-sm font-bold text-luxury-umber">
                    <span className="text-[10px] font-medium mr-0.5">₹</span>
                    {Number(v.price).toLocaleString('en-IN')}
                    {v.quantity && v.quantity !== "Standard" && (
                      <span className="text-[11px] text-luxury-umber/50 font-medium ml-1">/ {v.quantity}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : price != null && (
            <div className="text-right">
              <div className="text-sm font-bold text-luxury-umber">
                <span className="text-[10px] font-medium mr-0.5">₹</span>
                {Number(price).toLocaleString('en-IN')}
                {quantity && quantity !== "Standard" && (
                  <span className="text-[11px] text-luxury-umber/50 font-medium ml-1">/ {quantity}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default ProductCard;

