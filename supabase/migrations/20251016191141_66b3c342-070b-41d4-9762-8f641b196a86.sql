-- Create admin role enum
CREATE TYPE public.admin_role AS ENUM ('admin', 'super_admin');

-- Create admin_roles table
CREATE TABLE public.admin_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role admin_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE user_id = _user_id
  )
$$;

-- RLS policies for admin_roles
CREATE POLICY "Admins can view admin roles"
ON public.admin_roles
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Super admins can manage admin roles"
ON public.admin_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Update pharmacy_registrations policies to allow admins to view and update
CREATE POLICY "Admins can view all registrations"
ON public.pharmacy_registrations
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update registrations"
ON public.pharmacy_registrations
FOR UPDATE
USING (is_admin(auth.uid()));

-- Allow admins to insert pharmacies
CREATE POLICY "Admins can insert pharmacies"
ON public.pharmacies
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to manage user roles
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
USING (is_admin(auth.uid()));

-- Add trigger for admin_roles updated_at
CREATE TRIGGER update_admin_roles_updated_at
BEFORE UPDATE ON public.admin_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();