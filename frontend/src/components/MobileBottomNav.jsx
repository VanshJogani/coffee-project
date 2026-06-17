import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const TABS = [
  {
    id: "explore",
    label: "Explore",
    path: "/explore",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zm4-5c.5 1 .5 2 0 3m4-3c.5 1 .5 2 0 3m4-3c.5 1 .5 2 0 3" />
      </svg>
    ),
  },
  {
    id: "map",
    label: "Map",
    path: "/map",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
];

function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    if (location.pathname.startsWith("/brew")) return "brew";
    if (location.pathname.startsWith("/map")) return "map";
    return "explore";
  };

  const activeTab = getActiveTab();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-luxury-umber border-t border-luxury-gold/20 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] px-3 py-1 rounded-lg transition-all ${
                isActive
                  ? "text-luxury-gold"
                  : "text-luxury-clay hover:text-luxury-light"
              }`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={isActive ? "scale-110 transition-transform" : "transition-transform"}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                isActive ? "text-luxury-gold" : "text-luxury-clay"
              }`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-luxury-gold rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
