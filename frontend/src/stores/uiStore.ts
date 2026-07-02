import { create } from "zustand";

interface UIState {
  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;

  // Product detail modal
  detailModalProductId: number | null;
  openDetailModal: (productId: number) => void;
  closeDetailModal: () => void;

  // View mode
  viewMode: "grid" | "cards" | "swipe";
  setViewMode: (mode: "grid" | "cards" | "swipe") => void;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

let toastCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Auto-remove after duration
    const duration = toast.duration ?? 4000;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  detailModalProductId: null,
  openDetailModal: (productId) => set({ detailModalProductId: productId }),
  closeDetailModal: () => set({ detailModalProductId: null }),

  viewMode: "grid",
  setViewMode: (mode) => set({ viewMode: mode }),
}));
