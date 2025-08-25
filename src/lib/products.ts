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
  }
];

// Utilidad para buscar por slug
export const findBySlug = (slug: string) => products.find(p => p.slug === slug);
