import React from "react";

function SearchBar({ value, onChange }) {
  return (
    <input
      type="search"
      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-coffee-400"
      placeholder="Search by name, roaster, tasting notes..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default SearchBar;

