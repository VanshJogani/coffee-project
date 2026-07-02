import { create } from "zustand";
import type { BeanInventoryItem, BrewLog, Recipe } from "../types";

interface BrewState {
  inventory: BeanInventoryItem[];
  brewLogs: BrewLog[];
  recipes: Recipe[];
  likedRecipeIds: number[];

  // Actions
  setInventory: (items: BeanInventoryItem[]) => void;
  setBrewLogs: (logs: BrewLog[]) => void;
  setRecipes: (recipes: Recipe[]) => void;
  setLikedRecipeIds: (ids: number[]) => void;
  addBrewLog: (log: BrewLog) => void;
  addInventoryItem: (item: BeanInventoryItem) => void;
  removeInventoryItem: (id: number) => void;
  updateInventoryItem: (item: BeanInventoryItem) => void;
}

export const useBrewStore = create<BrewState>((set) => ({
  inventory: [],
  brewLogs: [],
  recipes: [],
  likedRecipeIds: [],

  setInventory: (inventory) => set({ inventory }),
  setBrewLogs: (brewLogs) => set({ brewLogs }),
  setRecipes: (recipes) => set({ recipes }),
  setLikedRecipeIds: (likedRecipeIds) => set({ likedRecipeIds }),
  addBrewLog: (log) => set((state) => ({ brewLogs: [log, ...state.brewLogs] })),
  addInventoryItem: (item) => set((state) => ({ inventory: [item, ...state.inventory] })),
  removeInventoryItem: (id) =>
    set((state) => ({ inventory: state.inventory.filter((i) => i.id !== id) })),
  updateInventoryItem: (item) =>
    set((state) => ({
      inventory: state.inventory.map((i) => (i.id === item.id ? item : i)),
    })),
}));
