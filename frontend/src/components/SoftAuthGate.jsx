import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

/**
 * A small, non-intrusive banner that reminds anonymous users they can sign in.
 * Auto-dismisses after 5 seconds with a progress bar. Never blocks content.
 */
export default function SoftAuthGate({ children, featureName = "your data" }) {
  const { user, loading, openAuthModal } = useAuth();
  const alreadyShown = sessionStorage.getItem("auth-banner-shown");
  const [visible, setVisible] = useState(!alreadyShown);

  useEffect(() => {
    if (loading || user || !visible) return;
    sessionStorage.setItem("auth-banner-shown", "1");
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [loading, user, visible]);

  if (loading || user === undefined || user || !visible) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="mx-4 mb-4 overflow-hidden rounded-xl border border-luxury-gold/20 bg-luxury-gold/10">
        <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="text-base">🔑</span>
          <p className="flex-1 text-luxury-umber/80">
            <button onClick={openAuthModal} className="font-semibold text-luxury-umber hover:underline">
              Sign in
            </button>
            {" "}to save {featureName} to your account
          </p>
          <button
            onClick={() => setVisible(false)}
            className="text-luxury-clay/60 hover:text-luxury-clay text-lg leading-none px-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        {/* Auto-dismiss progress bar */}
        <div className="h-0.5 w-full bg-luxury-gold/20">
          <div
            className="h-full bg-luxury-gold/60 origin-left"
            style={{ animation: "shrink-bar 3s linear forwards" }}
          />
        </div>
      </div>
      <style>{`
        @keyframes shrink-bar {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
      {children}
    </>
  );
}
