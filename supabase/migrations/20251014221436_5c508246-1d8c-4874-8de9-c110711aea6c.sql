-- Create pharmacies table
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  opening_hours JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pharmacy_products junction table
CREATE TABLE IF NOT EXISTS public.pharmacy_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pharmacy_id, product_id)
);

-- Create user_pharmacy_affiliation table
CREATE TABLE IF NOT EXISTS public.user_pharmacy_affiliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
  affiliation_type TEXT CHECK (affiliation_type IN ('temporary', 'permanent')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pharmacy_id)
);

-- Enable RLS
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pharmacy_affiliation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pharmacies (public read)
CREATE POLICY "Everyone can view pharmacies"
  ON public.pharmacies FOR SELECT
  USING (true);

-- RLS Policies for products (public read)
CREATE POLICY "Everyone can view products"
  ON public.products FOR SELECT
  USING (true);

-- RLS Policies for pharmacy_products (public read)
CREATE POLICY "Everyone can view pharmacy products"
  ON public.pharmacy_products FOR SELECT
  USING (true);

-- RLS Policies for user_pharmacy_affiliation
CREATE POLICY "Users can view their own affiliations"
  ON public.user_pharmacy_affiliation FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own affiliations"
  ON public.user_pharmacy_affiliation FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own affiliations"
  ON public.user_pharmacy_affiliation FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own affiliations"
  ON public.user_pharmacy_affiliation FOR DELETE
  USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_pharmacies_updated_at
  BEFORE UPDATE ON public.pharmacies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pharmacy_products_updated_at
  BEFORE UPDATE ON public.pharmacy_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_pharmacy_affiliation_updated_at
  BEFORE UPDATE ON public.user_pharmacy_affiliation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update promotions table to link to pharmacy
ALTER TABLE public.promotions 
  ADD COLUMN IF NOT EXISTS pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL;