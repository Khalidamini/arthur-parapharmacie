-- Create enum for pharmacy user roles
CREATE TYPE public.pharmacy_role AS ENUM ('owner', 'admin', 'product_manager', 'promotion_manager', 'viewer');

-- Create user_roles table for pharmacy staff
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
  role pharmacy_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, pharmacy_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_pharmacy_role(_user_id UUID, _pharmacy_id UUID, _role pharmacy_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND pharmacy_id = _pharmacy_id
      AND role = _role
  )
$$;

-- Create function to check if user has any role in pharmacy
CREATE OR REPLACE FUNCTION public.has_any_pharmacy_role(_user_id UUID, _pharmacy_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND pharmacy_id = _pharmacy_id
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their pharmacies"
ON public.user_roles
FOR SELECT
USING (public.has_any_pharmacy_role(auth.uid(), pharmacy_id));

CREATE POLICY "Pharmacy owners can manage roles"
ON public.user_roles
FOR ALL
USING (
  public.has_pharmacy_role(auth.uid(), pharmacy_id, 'owner'::pharmacy_role) OR
  public.has_pharmacy_role(auth.uid(), pharmacy_id, 'admin'::pharmacy_role)
);

-- Update pharmacies table RLS to allow pharmacy staff to update
CREATE POLICY "Pharmacy staff can update their pharmacy"
ON public.pharmacies
FOR UPDATE
USING (
  public.has_pharmacy_role(auth.uid(), id, 'owner'::pharmacy_role) OR
  public.has_pharmacy_role(auth.uid(), id, 'admin'::pharmacy_role)
);

-- Update products RLS to allow pharmacy staff to manage
CREATE POLICY "Pharmacy staff can insert products"
ON public.products
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Pharmacy staff can update products"
ON public.products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.pharmacy_products pp
    WHERE pp.product_id = products.id
    AND public.has_any_pharmacy_role(auth.uid(), pp.pharmacy_id)
  )
);

-- Update pharmacy_products RLS
CREATE POLICY "Pharmacy staff can manage pharmacy products"
ON public.pharmacy_products
FOR ALL
USING (public.has_any_pharmacy_role(auth.uid(), pharmacy_id));

-- Update promotions RLS
CREATE POLICY "Pharmacy staff can insert promotions"
ON public.promotions
FOR INSERT
WITH CHECK (public.has_any_pharmacy_role(auth.uid(), pharmacy_id));

CREATE POLICY "Pharmacy staff can update promotions"
ON public.promotions
FOR UPDATE
USING (
  public.has_pharmacy_role(auth.uid(), pharmacy_id, 'owner'::pharmacy_role) OR
  public.has_pharmacy_role(auth.uid(), pharmacy_id, 'admin'::pharmacy_role) OR
  public.has_pharmacy_role(auth.uid(), pharmacy_id, 'promotion_manager'::pharmacy_role)
);

CREATE POLICY "Pharmacy staff can delete promotions"
ON public.promotions
FOR DELETE
USING (
  public.has_pharmacy_role(auth.uid(), pharmacy_id, 'owner'::pharmacy_role) OR
  public.has_pharmacy_role(auth.uid(), pharmacy_id, 'admin'::pharmacy_role) OR
  public.has_pharmacy_role(auth.uid(), pharmacy_id, 'promotion_manager'::pharmacy_role)
);

-- Create table for pharmacy registration requests
CREATE TABLE public.pharmacy_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT,
  owner_email TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pharmacy_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can create a registration request
CREATE POLICY "Anyone can create pharmacy registration"
ON public.pharmacy_registrations
FOR INSERT
WITH CHECK (true);

-- Users can view their own registration requests
CREATE POLICY "Users can view own registrations"
ON public.pharmacy_registrations
FOR SELECT
USING (owner_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pharmacy_registrations_updated_at
BEFORE UPDATE ON public.pharmacy_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();