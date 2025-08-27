export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: "cerveza" | "vaso" | "merch" | "pack";
};

export const products: Product[] = [
  // === Originales ===
  {
    id: "cz-ipa-001",
    slug: "ipa-patagonia-473",
    name: "IPA Patagonia 473ml",
    description: "IPA cítrica con lúpulos patagónicos. Cuerpo medio y final seco.",
    price: 3490,
    image: "/images/ipa474.jpg.png",
    category: "cerveza"
  },
  {
    id: "cz-stout-002",
    slug: "stout-andina-330",
    name: "Stout Andina 330ml",
    description: "Notas de cacao y café, cremosa y tostada.",
    price: 3290,
    image: "/images/scout330.jpg.jpg",
    category: "cerveza"
  },
  {
    id: "ac-vaso-001",
    slug: "vaso-craft-400",
    name: "Vaso Craft 400ml",
    description: "Vaso cervecero templado, realza aromas y espuma.",
    price: 5990,
    image: "/images/1200.jpg",
    category: "vaso"
  },

  // === Nuevos (9) — reutilizando tus imágenes existentes ===

  // Reusa imagen IPA
  {
    id: "cz-ipa-002",
    slug: "ipa-patagonia-330",
    name: "IPA Patagonia 330ml",
    description: "Versión 330ml, fresca y aromática, amargor medio.",
    price: 2990,
    image: "/images/ipa474.jpg.png",
    category: "cerveza"
  },
  {
    id: "cz-ipa-003",
    slug: "ipa-doble-473",
    name: "IPA Doble 473ml",
    description: "Más intensidad de lúpulo y alcohol, final resinoso.",
    price: 3990,
    image: "/images/ipa474.jpg.png",
    category: "cerveza"
  },
  {
    id: "cz-ipa-004",
    slug: "ipa-session-355",
    name: "Session IPA 355ml",
    description: "Aromática y ligera, para beber fácil.",
    price: 2890,
    image: "/images/ipa474.jpg.png",
    category: "cerveza"
  },

  // Reusa imagen STOUT
  {
    id: "cz-stout-003",
    slug: "stout-nitro-473",
    name: "Stout Nitro 473ml",
    description: "Textura cremosa con nitrógeno, notas de café y cacao.",
    price: 3790,
    image: "/images/scout330.jpg.jpg",
    category: "cerveza"
  },
  {
    id: "cz-porter-001",
    slug: "porter-330",
    name: "Porter 330ml",
    description: "Tostada y suave, toques de chocolate amargo.",
    price: 3190,
    image: "/images/scout330.jpg.jpg",
    category: "cerveza"
  },

  // Reusa imagen VASO
  {
    id: "ac-vaso-002",
    slug: "vaso-teku-425",
    name: "Vaso Teku 425ml",
    description: "Copa ideal para potenciar aroma en cervezas especiales.",
    price: 7990,
    image: "/images/1200.jpg",
    category: "vaso"
  },
  {
    id: "ac-vaso-003",
    slug: "vaso-pint-568",
    name: "Vaso Pint 568ml",
    description: "Formato inglés para pintas generosas.",
    price: 6990,
    image: "/images/1200.jpg",
    category: "vaso"
  },

  // Packs (reutilizando imágenes IPA/STOUT)
  {
    id: "pk-ipa-001",
    slug: "pack-ipa-6",
    name: "Pack IPA (6×473ml)",
    description: "Seis latas de IPA para compartir.",
    price: 19990,
    image: "/images/ipa474.jpg.png",
    category: "pack"
  },
  {
    id: "pk-stout-001",
    slug: "pack-stout-12",
    name: "Pack Stout (12×330ml)",
    description: "Doce botellas oscuras y cremosas.",
    price: 32990,
    image: "/images/scout330.jpg.jpg",
    category: "pack"
  }
];

// Utilidad para buscar por slug
export const findBySlug = (slug: string) => products.find((p) => p.slug === slug);
