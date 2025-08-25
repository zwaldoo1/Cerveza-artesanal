import { useEffect, useState } from "react";
import { useCart } from "../lib/cart";

export default function CartDrawer() {
  const { items, remove, total, clear } = useCart();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // rehidratar carrito desde localStorage
    const raw = localStorage.getItem("cart");
    if (raw) {
      const parsed = JSON.parse(raw);
      // pequeña reconciliación
      if (Array.isArray(parsed)) {
        // @ts-ignore
        useCart.setState({ items: parsed });
      }
    }
  }, []);

  const checkout = async () => {
    const res = await fetch("/api/checkout.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    const data = await res.json();
    if (data.init_point) {
      window.location.href = data.init_point; // redirigir a Mercado Pago Checkout Pro
    } else {
      alert("No se pudo iniciar el pago");
    }
  };

  return (
    <>
      <button
        className="relative inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="cart-drawer"
      >
        🛒 Carrito
        <span className="text-xs bg-brand text-white rounded px-1">{items.length}</span>
      </button>

      {open && (
        <div id="cart-drawer" className="fixed right-0 top-16 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 p-4 overflow-auto shadow-xl z-50">
          <h2 className="text-lg font-semibold mb-4">Tu carrito</h2>
          <ul className="space-y-3">
            {items.map(({ product, qty }) => (
              <li key={product.id} className="flex items-center gap-3">
                <img src={product.image} alt={product.name} className="w-16 h-16 object-cover rounded" />
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm opacity-80">x{qty} — ${(product.price * qty).toLocaleString("es-CL")}</p>
                </div>
                <button className="text-sm opacity-80 hover:opacity-100" onClick={() => remove(product.id)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-base font-semibold">Total</span>
            <span className="text-base font-semibold">${total().toLocaleString("es-CL")}</span>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50" onClick={clear}>
              Vaciar
            </button>
            <button className="flex-1 px-3 py-2 rounded-md bg-brand text-white hover:bg-brand-dark" onClick={checkout}>
              Pagar con Mercado Pago
            </button>
          </div>
        </div>
      )}
    </>
  );
}
