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

export interface Review {
  id: string;
  product_id: string;
  first_name: string;
  last_name: string;
  email: string;
  rating: number;
  comment: string;
  approved: boolean;
  created_at: string;
}