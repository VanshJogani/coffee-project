import React from "react";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen stone-gradient overflow-y-auto flex flex-col">
      <div className="flex flex-col items-center justify-center flex-1 py-12">
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="w-14 h-14 rounded-full bg-luxury-umber flex items-center justify-center shadow-lg">
            <span className="text-3xl">☕</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-luxury-umber">Caffè Elegante</h1>
          <p className="text-xs text-luxury-clay font-medium uppercase tracking-[0.25em]">
            Curated Indian Specialty Coffee
          </p>
        </div>

        <p className="text-sm text-luxury-clay/80 uppercase tracking-widest font-semibold mb-8">
          Where would you like to go?
        </p>

        <div className="flex flex-col sm:flex-row gap-5">
          <button
            onClick={() => navigate("/explore")}
            className="group flex flex-col items-center gap-3 px-10 py-6 rounded-2xl bg-luxury-umber text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 border border-luxury-gold/20 hover:border-luxury-gold/50 min-w-[180px]"
          >
            <span className="text-3xl">🔍</span>
            <span className="text-lg font-bold tracking-wide">Explore</span>
            <span className="text-[11px] text-luxury-clay/70 uppercase tracking-widest text-center">
              Browse &amp; discover coffees
            </span>
          </button>

          <button
            onClick={() => navigate("/brew")}
            className="group flex flex-col items-center gap-3 px-10 py-6 rounded-2xl bg-white text-luxury-umber shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 border border-luxury-clay/30 hover:border-luxury-gold/50 min-w-[180px]"
          >
            <span className="text-3xl">🫖</span>
            <span className="text-lg font-bold tracking-wide">Brew</span>
            <span className="text-[11px] text-luxury-clay/60 uppercase tracking-widest text-center">
              Journal &amp; recipes
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
