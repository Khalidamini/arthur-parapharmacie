-- Create role_permissions table to manage feature access per role
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role pharmacy_role NOT NULL,
  permission_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key)
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies: only site admins can manage and view
DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view role permissions" ON public.role_permissions;
CREATE POLICY "Admins can view role permissions"
ON public.role_permissions
FOR SELECT
USING (is_admin(auth.uid()));

-- Seed default permissions if not present
-- Define a helper upsert via INSERT ON CONFLICT
INSERT INTO public.role_permissions (role, permission_key, allowed)
VALUES
  ('owner', 'view_dashboard', true),
  ('owner', 'manage_team', true),
  ('owner', 'manage_promotions', true),
  ('owner', 'manage_products', true),
  ('owner', 'manage_orders', true),
  ('owner', 'manage_api_keys', true),
  ('owner', 'manage_connectors', true),
  ('admin', 'view_dashboard', true),
  ('admin', 'manage_team', true),
  ('admin', 'manage_promotions', true),
  ('admin', 'manage_products', true),
  ('admin', 'manage_orders', true),
  ('admin', 'manage_api_keys', true),
  ('promotion_manager', 'view_dashboard', true),
  ('promotion_manager', 'manage_promotions', true)
ON CONFLICT (role, permission_key) DO NOTHING;