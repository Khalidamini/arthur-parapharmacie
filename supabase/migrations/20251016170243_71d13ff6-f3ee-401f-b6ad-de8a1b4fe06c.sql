-- Create carts table to manage separate carts per pharmacy
CREATE TABLE public.carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create unique partial index for active carts per pharmacy
CREATE UNIQUE INDEX idx_active_cart_per_pharmacy 
  ON public.carts(user_id, pharmacy_id) 
  WHERE status = 'active';

-- Enable RLS on carts
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- RLS policies for carts
CREATE POLICY "Users can view their own carts"
  ON public.carts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own carts"
  ON public.carts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own carts"
  ON public.carts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own carts"
  ON public.carts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add cart_id to cart_items
ALTER TABLE public.cart_items ADD COLUMN cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_carts_user_status ON public.carts(user_id, status);
CREATE INDEX idx_cart_items_cart_id ON public.cart_items(cart_id);

-- Add trigger for carts updated_at
CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();