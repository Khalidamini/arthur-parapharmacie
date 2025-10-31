export interface ProductData {
  name: string;
  brand: string;
  price: number;
  category: string;
  description?: string;
  image_url?: string;
  stock_quantity: number;
  is_available: boolean;
}
