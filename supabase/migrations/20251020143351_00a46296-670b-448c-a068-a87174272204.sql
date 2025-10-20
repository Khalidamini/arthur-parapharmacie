-- Add Stripe account ID to pharmacies table for connected accounts
ALTER TABLE public.pharmacies 
ADD COLUMN stripe_account_id text;

-- Add payment status to carts
ALTER TABLE public.carts 
ADD COLUMN payment_status text DEFAULT 'pending',
ADD COLUMN payment_intent_id text,
ADD COLUMN amount_total numeric DEFAULT 0;