-- Rename Colissimo-specific columns to generic shipping columns
ALTER TABLE public.carts 
RENAME COLUMN colissimo_tracking_number TO shipping_tracking_number;

ALTER TABLE public.carts 
RENAME COLUMN colissimo_label_url TO shipping_label_url;

COMMENT ON COLUMN public.carts.shipping_tracking_number IS 'Tracking number for delivery shipments';
COMMENT ON COLUMN public.carts.shipping_label_url IS 'URL to shipping label PDF';