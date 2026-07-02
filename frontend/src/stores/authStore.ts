import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null | undefined; // undefined = loading, null = anonymous, User = logged in
  loading: boolean;
  authModalOpen: boolean;
  claimModalOpen: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openClaimModal: () => void;
  closeClaimModal: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: undefined,
  loading: true,
  authModalOpen: false,
  claimModalOpen: false,

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  openAuthModal: () => set({ authModalOpen: true }),
  closeAuthModal: () => set({ authModalOpen: false }),
  openClaimModal: () => set({ claimModalOpen: true }),
  closeClaimModal: () => set({ claimModalOpen: false }),
  logout: () => set({ user: null }),
}));
