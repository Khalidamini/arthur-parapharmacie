-- Fix recursive admin_roles policies and grant admin to the provided email

-- Ensure RLS is enabled
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Super admins can manage admin roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Admins can manage admin roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Users can view own admin role or admins see all" ON public.admin_roles;

-- Recreate safe policies using SECURITY DEFINER helper
CREATE POLICY "Users can view own admin role or admins see all"
ON public.admin_roles
FOR SELECT
USING ((user_id = auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage admin roles"
ON public.admin_roles
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Ensure the given user is an admin (idempotent)
INSERT INTO public.admin_roles (user_id, role)
SELECT u.id, 'admin'::admin_role
FROM auth.users u
WHERE u.email = 'aminikhalid@app.local'
AND NOT EXISTS (
  SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = u.id
);
