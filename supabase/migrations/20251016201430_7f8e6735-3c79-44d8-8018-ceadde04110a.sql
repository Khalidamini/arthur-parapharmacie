-- Replace user-view policy to avoid referencing auth.users (causing 403)

DROP POLICY IF EXISTS "Users can view own registrations" ON public.pharmacy_registrations;

-- Use JWT claim for email instead of querying auth.users
CREATE POLICY "Users can view own registrations"
ON public.pharmacy_registrations
FOR SELECT
USING (owner_email = (auth.jwt() ->> 'email'));
