const API_BASE = import.meta.env.PUBLIC_API_BASE ?? "http://localhost:4000";

export async function fetchProducts() {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error("Error cargando productos");
  return res.json();
}

export async function fetchProductById(id: number | string) {
  const res = await fetch(`${API_BASE}/api/products/${id}`);
  if (!res.ok) throw new Error("Producto no encontrado");
  return res.json();
}
