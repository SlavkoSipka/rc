export interface Product {
  id: string;
  title: string;
  price: number;
  image: string;
  images?: string[];
  color?: string;
  description?: string;
  condition?: string;
  shipping?: string;
  location?: string;
  stock: number;
}