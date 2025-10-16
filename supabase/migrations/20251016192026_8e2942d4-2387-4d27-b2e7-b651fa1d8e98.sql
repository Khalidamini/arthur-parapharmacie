-- Fix RLS on admin_roles to avoid circular check
DROP POLICY IF EXISTS "Admins can view admin roles" ON public.admin_roles;

CREATE POLICY "Users can view own admin role or admins see all"
ON public.admin_roles
FOR SELECT
USING (
  user_id = auth.uid() OR is_admin(auth.uid())
);

-- Ensure super admins can manage roles for all operations (USING and WITH CHECK)
DROP POLICY IF EXISTS "Super admins can manage admin roles" ON public.admin_roles;
CREATE POLICY "Super admins can manage admin roles"
ON public.admin_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);