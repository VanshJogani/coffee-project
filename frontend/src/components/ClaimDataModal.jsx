import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/client";

export default function ClaimDataModal() {
  const { user, claimModalOpen, closeClaimModal } = useAuth();
  const [claimable, setClaimable] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(null);

  useEffect(() => {
    if (claimModalOpen && user) {
      api.post("/auth/claim/preview", { displayName: user.displayName })
        .then(res => setClaimable(res.data.claimable))
        .catch(() => setClaimable(null));
    }
  }, [claimModalOpen, user]);

  if (!claimModalOpen || !user) return null;

  const total = claimable ? Object.values(claimable).reduce((sum, n) => sum + n, 0) : 0;

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await api.post("/auth/claim", { displayName: user.displayName });
      setClaimed(res.data.claimed);
    } catch (_) {
      setClaimed(null);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && closeClaimModal()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-luxury-gold/10 to-transparent border-b border-luxury-clay/20">
          <h2 className="text-lg font-bold text-luxury-umber">
            {claimed ? "Records Claimed! 🎉" : "Claim Your Data"}
          </h2>
        </div>

        <div className="p-6">
          {claimed ? (
            <>
              <p className="text-sm text-luxury-clay mb-4">
                The following records are now linked to your account:
              </p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {claimed.recipes > 0 && (
                  <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                    <span className="text-lg font-bold text-green-700">{claimed.recipes}</span>
                    <p className="text-xs text-green-600">Recipes</p>
                  </div>
                )}
                {claimed.brewNotes > 0 && (
                  <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                    <span className="text-lg font-bold text-green-700">{claimed.brewNotes}</span>
                    <p className="text-xs text-green-600">Brew Notes</p>
                  </div>
                )}
                {claimed.posts > 0 && (
                  <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                    <span className="text-lg font-bold text-green-700">{claimed.posts}</span>
                    <p className="text-xs text-green-600">Posts</p>
                  </div>
                )}
                {claimed.reviews > 0 && (
                  <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                    <span className="text-lg font-bold text-green-700">{claimed.reviews}</span>
                    <p className="text-xs text-green-600">Reviews</p>
                  </div>
                )}
              </div>
              <button
                onClick={closeClaimModal}
                className="w-full py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-umber/90 transition-all"
              >
                Done
              </button>
            </>
          ) : (
            <>
              {!claimable ? (
                <p className="text-sm text-luxury-clay">Checking for existing records...</p>
              ) : total === 0 ? (
                <>
                  <p className="text-sm text-luxury-clay mb-4">
                    No existing records found matching "{user.displayName}".
                  </p>
                  <button
                    onClick={closeClaimModal}
                    className="w-full py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-umber/90 transition-all"
                  >
                    Got it
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-luxury-clay mb-4">
                    We found existing records under the name <strong>"{user.displayName}"</strong>.
                    Would you like to claim them as yours?
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {claimable.recipes > 0 && (
                      <div className="bg-luxury-gold/10 rounded-xl px-3 py-2 text-center">
                        <span className="text-lg font-bold text-luxury-umber">{claimable.recipes}</span>
                        <p className="text-xs text-luxury-clay">Recipes</p>
                      </div>
                    )}
                    {claimable.brewNotes > 0 && (
                      <div className="bg-luxury-gold/10 rounded-xl px-3 py-2 text-center">
                        <span className="text-lg font-bold text-luxury-umber">{claimable.brewNotes}</span>
                        <p className="text-xs text-luxury-clay">Brew Notes</p>
                      </div>
                    )}
                    {claimable.posts > 0 && (
                      <div className="bg-luxury-gold/10 rounded-xl px-3 py-2 text-center">
                        <span className="text-lg font-bold text-luxury-umber">{claimable.posts}</span>
                        <p className="text-xs text-luxury-clay">Posts</p>
                      </div>
                    )}
                    {claimable.reviews > 0 && (
                      <div className="bg-luxury-gold/10 rounded-xl px-3 py-2 text-center">
                        <span className="text-lg font-bold text-luxury-umber">{claimable.reviews}</span>
                        <p className="text-xs text-luxury-clay">Reviews</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={closeClaimModal}
                      className="flex-1 py-2.5 border border-luxury-clay/30 text-luxury-clay text-sm font-medium rounded-xl hover:bg-luxury-clay/5 transition-all"
                    >
                      Skip
                    </button>
                    <button
                      onClick={handleClaim}
                      disabled={claiming}
                      className="flex-1 py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-umber/90 disabled:opacity-50 transition-all"
                    >
                      {claiming ? "Claiming..." : "Claim All"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
