-- Ensure preparation_notified_at exists for carts
ALTER TABLE public.carts
ADD COLUMN IF NOT EXISTS preparation_notified_at TIMESTAMP WITH TIME ZONE;