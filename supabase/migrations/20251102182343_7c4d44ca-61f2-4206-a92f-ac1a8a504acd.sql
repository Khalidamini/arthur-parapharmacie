-- Add delivery method and notification fields to carts table
ALTER TABLE public.carts 
ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'delivery')),
ADD COLUMN IF NOT EXISTS delivery_address jsonb,
ADD COLUMN IF NOT EXISTS notification_email text,
ADD COLUMN IF NOT EXISTS colissimo_tracking_number text,
ADD COLUMN IF NOT EXISTS colissimo_label_url text;

COMMENT ON COLUMN public.carts.delivery_method IS 'Method of delivery: pickup (collect at pharmacy) or delivery (home delivery)';
COMMENT ON COLUMN public.carts.delivery_address IS 'Delivery address for home delivery orders (JSON with street, city, postal_code, country)';
COMMENT ON COLUMN public.carts.notification_email IS 'Email for order notifications (can be different from user account email)';
COMMENT ON COLUMN public.carts.colissimo_tracking_number IS 'Colissimo tracking number for deliveries';
COMMENT ON COLUMN public.carts.colissimo_label_url IS 'URL to Colissimo shipping label PDF';