import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=loading, null=anonymous, object=logged in
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  // Check session on mount
  useEffect(() => {
    api.get("/auth/me")
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const res = await api.post("/auth/register", { email, password, displayName });
    setUser(res.data.user);
    // After registration, check for claimable records
    try {
      const preview = await api.post("/auth/claim/preview", { displayName });
      const { claimable } = preview.data;
      const total = Object.values(claimable).reduce((sum, n) => sum + n, 0);
      if (total > 0) {
        setClaimModalOpen(true);
      }
    } catch (_) { /* ignore claim preview errors */ }
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);
  const openClaimModal = useCallback(() => setClaimModalOpen(true), []);
  const closeClaimModal = useCallback(() => setClaimModalOpen(false), []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      claimModalOpen,
      openClaimModal,
      closeClaimModal,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
