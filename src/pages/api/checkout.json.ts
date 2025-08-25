async function createPreference(
  items: { title: string; quantity: number; unit_price: number; currency_id: string }[]
) {
  const token = import.meta.env.MP_ACCESS_TOKEN as string | undefined;
  if (!token) throw new Error("Falta MP_ACCESS_TOKEN");

  const base = (import.meta.env.PUBLIC_BASE_URL as string | undefined) ?? "http://localhost:4321";

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items,
      back_urls: {
        success: `${base}/?pago=ok`,
        failure: `${base}/?pago=fail`,
        pending: `${base}/?pago=pending`,
      },
      auto_return: "approved",
      statement_descriptor: "CervezaArtesana",
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Mercado Pago error: ${t}`);
  }

  const data = await res.json();
  return { id: data.id, init_point: data.init_point };
}
