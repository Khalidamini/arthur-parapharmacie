-- Enable realtime for products and pharmacy_products tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pharmacy_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;