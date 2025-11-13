-- Add column to track preparation notification
ALTER TABLE public.carts
ADD COLUMN IF NOT EXISTS preparation_notified_at TIMESTAMP WITH TIME ZONE;