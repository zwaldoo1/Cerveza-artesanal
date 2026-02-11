"use client";
import { useCart } from "../lib/cart";


export type AddItem = { id: string; name: string; price: number; image?: string };

export function addToCart(item: AddItem, qty = 1) {
  useCart.getState().add(item, qty);
}
