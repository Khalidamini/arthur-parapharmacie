-- Add delivery options to carts table
ALTER TABLE public.carts
ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS delivery_location_type TEXT DEFAULT 'home',
ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS relay_point_id TEXT,
ADD COLUMN IF NOT EXISTS relay_point_name TEXT,
ADD COLUMN IF NOT EXISTS relay_point_address TEXT;

COMMENT ON COLUMN public.carts.delivery_type IS 'Type de livraison: standard ou express';
COMMENT ON COLUMN public.carts.delivery_location_type IS 'Lieu de livraison: home (domicile) ou relay (point relais)';
COMMENT ON COLUMN public.carts.relay_point_id IS 'ID du point relais Sendcloud si applicable';
COMMENT ON COLUMN public.carts.relay_point_name IS 'Nom du point relais si applicable';
COMMENT ON COLUMN public.carts.relay_point_address IS 'Adresse du point relais si applicable';