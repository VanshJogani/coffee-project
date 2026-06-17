import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const MODES = [
  {
    id: "explore",
    label: "Explore",
    path: "/explore",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
    ),
  },
  {
    id: "brew",
    label: "Brew",
    path: "/brew",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
    ),
  },
];

function ModeDropdown() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentMode = location.pathname.startsWith("/brew") ? "brew" : "explore";
  const active = MODES.find((m) => m.id === currentMode);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-luxury-gold/15 border border-luxury-gold/30 text-luxury-gold hover:bg-luxury-gold/25 transition-all"
      >
        {active.icon}
        <span className="text-[11px] font-bold uppercase tracking-widest">{active.label}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-36 bg-luxury-dark border border-luxury-gold/20 rounded-xl shadow-2xl overflow-hidden z-[200]">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => { navigate(mode.path); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                currentMode === mode.id
                  ? "bg-luxury-gold/20 text-luxury-gold"
                  : "text-luxury-clay hover:bg-luxury-gold/10 hover:text-luxury-gold"
              }`}
            >
              {mode.icon}
              {mode.label}
              {currentMode === mode.id && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-luxury-gold" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModeDropdown;
