import React from "react";

function SortSelect({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 overflow-hidden min-h-[44px]">
      <span className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold whitespace-nowrap hidden sm:inline">
        Sort:
      </span>
      <select
        className="bg-transparent text-white text-[10px] font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-luxury-gold transition-colors appearance-none pr-4 min-h-[44px]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23C4A484\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '12px' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="discover" className="text-luxury-umber">Discover</option>
        <option value="newest" className="text-luxury-umber">Newest</option>
        <option value="rating" className="text-luxury-umber">Rating</option>
        <option value="roastType" className="text-luxury-umber">Roast</option>
        <option value="priceAsc" className="text-luxury-umber">Price ↑</option>
        <option value="priceDesc" className="text-luxury-umber">Price ↓</option>
      </select>
    </div>
  );
}

export default SortSelect;
