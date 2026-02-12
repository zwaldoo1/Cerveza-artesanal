export type Category = {
  id: number;
  name: string;
};

export type ProductDB = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  categoryId?: number | null;
  category?: Category | null;
};
