// src/lib/cart.ts
import { create } from "zustand";
import { db } from "./firebase"; // ← asegúrate de tener src/lib/firebase.ts configurado
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
};

type CartState = {
  items: CartItem[];
  uid?: string | null;

  // acciones básicas
  hydrate: () => void;
  add: (item: CartItem, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;

  // auth / sync
  attach: (uid: string | null) => void;        // setea el UID actual (o null en logout)
  mergeRemote: () => Promise<void>;            // trae carrito de Firestore y fusiona con el local
  sync: () => Promise<void>;                   // guarda el carrito actual en Firestore

  // helpers
  total: () => number;
};

const LS_KEY = "cart";

function loadFromLocalStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function mergeById(a: CartItem[], b: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const i of [...a, ...b]) {
    const prev = map.get(i.id);
    map.set(i.id, prev ? { ...i, qty: prev.qty + i.qty } : { ...i });
  }
  return [...map.values()];
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  uid: null,

  hydrate: () => {
    const items = loadFromLocalStorage();
    set({ items });
  },

  add: (item, qty = 1) => {
    const items = [...get().items];
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = { ...items[i], qty: items[i].qty + qty };
    else items.push({ ...item, qty });
    set({ items });
    saveToLocalStorage(items);
    // no forzamos sync aquí para no chatear Firestore en cada click
  },

  setQty: (id, qty) => {
    const items = [...get().items];
    const i = items.findIndex((x) => x.id === id);
    if (i >= 0) {
      if (qty <= 0) items.splice(i, 1);
      else items[i] = { ...items[i], qty };
      set({ items });
      saveToLocalStorage(items);
    }
  },

  remove: (id) => {
    const items = get().items.filter((x) => x.id !== id);
    set({ items });
    saveToLocalStorage(items);
  },

  clear: () => {
    set({ items: [] });
    saveToLocalStorage([]);
  },

  attach: (uid) => {
    set({ uid });
  },

  mergeRemote: async () => {
    const uid = get().uid;
    if (!uid) return;

    const ref = doc(db, "carts", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const remote = (snap.data().items ?? []) as CartItem[];
      const local = get().items.length ? get().items : loadFromLocalStorage();
      const merged = mergeById(local, remote);
      set({ items: merged });
      saveToLocalStorage(merged);
    }
  },

  sync: async () => {
    const uid = get().uid;
    if (!uid) return;

    const items = get().items;
    const ref = doc(db, "carts", uid);
    await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
  },

  total: () => {
    return get().items.reduce((s, i) => s + i.price * i.qty, 0);
  },
}));

// Hidratamos automáticamente en el cliente
if (typeof window !== "undefined") {
  // Hidrata al cargar
  useCart.getState().hydrate();

  // Persiste cada cambio en localStorage
  useCart.subscribe((state) => {
    saveToLocalStorage(state.items);
  });
}
