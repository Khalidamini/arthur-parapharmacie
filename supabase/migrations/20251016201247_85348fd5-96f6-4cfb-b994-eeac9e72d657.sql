-- Fix pharmacy_registrations RLS policies to avoid recursion

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all registrations" ON public.pharmacy_registrations;
DROP POLICY IF EXISTS "Admins can update registrations" ON public.pharmacy_registrations;

-- Recreate with proper security definer function
CREATE POLICY "Admins can view all registrations"
ON public.pharmacy_registrations
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update registrations"
ON public.pharmacy_registrations
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));