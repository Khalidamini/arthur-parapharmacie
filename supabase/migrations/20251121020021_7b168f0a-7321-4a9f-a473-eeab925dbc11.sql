-- Add is_featured column to pharmacy_products table
ALTER TABLE public.pharmacy_products
ADD COLUMN is_featured boolean DEFAULT false;

-- Add index for better query performance
CREATE INDEX idx_pharmacy_products_featured ON public.pharmacy_products(pharmacy_id, is_featured) WHERE is_featured = true;