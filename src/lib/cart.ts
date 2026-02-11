"use client";
import { create } from "zustand";

export type CartItem = { id: string; name: string; price: number; qty: number; image?: string };

type CartState = {
  items: CartItem[];
  hydrate: () => void;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: () => number;
};

const LS_KEY = "cart";

function loadFromLS(): CartItem[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveToLS(items: CartItem[]) {
  if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  hydrate: () => set({ items: loadFromLS() }),
  add: (item, qty = 1) => {
    const items = [...get().items];
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = { ...items[i], qty: items[i].qty + qty };
    else items.push({ ...item, qty });
    set({ items });
  },
  setQty: (id, qty) => {
    const items = [...get().items];
    const i = items.findIndex((x) => x.id === id);
    if (i >= 0) { if (qty <= 0) items.splice(i, 1); else items[i] = { ...items[i], qty }; set({ items }); }
  },
  remove: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
  clear: () => set({ items: [] }),
  total: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
}));

if (typeof window !== "undefined") {
  useCart.getState().hydrate();
  useCart.subscribe((state) => {
    saveToLS(state.items);
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: state.items }));
  });
}
