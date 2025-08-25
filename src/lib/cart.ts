import { create } from "zustand";

export type CartItem = { id: string; name: string; price: number; qty: number; image?: string };

type CartState = {
  items: CartItem[];
  add: (item: CartItem, qty?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: () => number;
};

export const useCart = create<CartState>((set, get) => ({
  items: [],
  add: (item, qty = 1) => {
    const items = [...get().items];
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = { ...items[i], qty: items[i].qty + qty };
    else items.push({ ...item, qty });
    set({ items });
    if (typeof window !== "undefined") localStorage.setItem("cart", JSON.stringify(items));
  },
  remove: (id) => {
    const items = get().items.filter((x) => x.id !== id);
    set({ items });
    if (typeof window !== "undefined") localStorage.setItem("cart", JSON.stringify(items));
  },
  clear: () => {
    set({ items: [] });
    if (typeof window !== "undefined") localStorage.removeItem("cart");
  },
  total: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
}));
