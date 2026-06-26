import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function UserMenu() {
  const { user, loading, openAuthModal, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading || user === undefined) return null;

  // Not logged in — show sign in button
  if (!user) {
    return (
      <button
        onClick={openAuthModal}
        className="px-4 py-1.5 text-sm font-medium rounded-lg border border-white/30 text-white hover:bg-white/10 transition-colors"
      >
        Sign In
      </button>
    );
  }

  // Logged in — show avatar + dropdown
  const initials = user.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-8 h-8 rounded-full bg-luxury-gold/80 text-luxury-umber font-bold text-xs flex items-center justify-center hover:bg-luxury-gold transition-colors"
        title={user.displayName || user.email}
      >
        {initials}
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-luxury-clay/20 py-2 z-50">
          <div className="px-4 py-2 border-b border-luxury-clay/10">
            <p className="text-sm font-medium text-luxury-umber truncate">
              {user.displayName}
            </p>
            <p className="text-xs text-luxury-clay truncate">{user.email}</p>
          </div>
          <button
            onClick={async () => {
              setDropdownOpen(false);
              await logout();
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
