-- Add notification_email column to pharmacies table
ALTER TABLE public.pharmacies
ADD COLUMN IF NOT EXISTS notification_email TEXT;