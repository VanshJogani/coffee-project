import React from "react";
import { NavLink, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import ModeDropdown from "../components/ModeDropdown";
import UserMenu from "../components/UserMenu";
import DashboardPage from "./brew/DashboardPage";
import BrewNowPage from "./brew/BrewNowPage";
import RecipesPage from "./brew/RecipesPage";
import BeansPage from "./brew/BeansPage";
import BrewLogPage from "./brew/BrewLogPage";
import StatsPage from "./brew/StatsPage";
import CommunityPage from "./brew/CommunityPage";

const BREW_TABS = [
  { path: "/brew", label: "Dashboard", end: true },
  { path: "/brew/now", label: "Brew Now" },
  { path: "/brew/recipes", label: "Recipes" },
  { path: "/brew/beans", label: "My Beans" },
  { path: "/brew/log", label: "Log" },
  { path: "/brew/stats", label: "Stats" },
  { path: "/brew/community", label: "Community" },
];

function BrewPage() {
  return (
    <div className="min-h-screen stone-gradient">
      <header className="border-b border-luxury-clay/20 bg-luxury-umber text-white shelf-glow sticky top-0 z-50">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-luxury-gold/50 via-luxury-gold to-luxury-gold/50 opacity-30" />
        <div className="container-page py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <ModeDropdown />
            <div className="w-px h-8 bg-luxury-gold/20" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-luxury-gold/10 flex items-center justify-center border border-luxury-gold/20">
                <span className="text-lg">☕</span>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-luxury-light">Caffè Elegante</h1>
                <p className="text-xs text-luxury-clay opacity-80 font-medium uppercase tracking-[0.2em] mt-0.5">
                  Brew Journal
                </p>
              </div>
            </div>
          </div>
          <UserMenu />
        </div>

        {/* Sub-tab nav */}
        <div className="container-page relative py-0">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide scroll-smooth" style={{ scrollSnapType: "x mandatory" }}>
            {BREW_TABS.map(tab => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  `min-h-[44px] flex items-center pb-3 pt-3 px-4 text-xs md:text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? "border-luxury-gold text-luxury-light"
                      : "border-transparent text-luxury-clay hover:text-luxury-light hover:border-luxury-clay/30"
                  }`
                }
                style={{ scrollSnapAlign: "start" }}
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
          {/* Scroll fade indicators */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-luxury-umber to-transparent pointer-events-none md:hidden" />
        </div>
      </header>

      <main className="container-page py-10">
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="now" element={<BrewNowPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="beans" element={<BeansPage />} />
          <Route path="log" element={<BrewLogPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="community/:productId" element={<CommunityPage />} />
          <Route path="*" element={<Navigate to="/brew" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default BrewPage;
