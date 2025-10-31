-- Create table for pharmacy API keys
CREATE TABLE IF NOT EXISTS public.pharmacy_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id)
);

-- Enable RLS
ALTER TABLE public.pharmacy_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Pharmacy staff can view their own API key
CREATE POLICY "Pharmacy staff can view own API key"
ON public.pharmacy_api_keys
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.pharmacy_id = pharmacy_api_keys.pharmacy_id
  )
);

-- Policy: Pharmacy owners/admins can manage API keys
CREATE POLICY "Pharmacy owners can manage API keys"
ON public.pharmacy_api_keys
FOR ALL
USING (
  has_pharmacy_role(auth.uid(), pharmacy_id, 'owner'::pharmacy_role) 
  OR has_pharmacy_role(auth.uid(), pharmacy_id, 'admin'::pharmacy_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_pharmacy_api_keys_updated_at
BEFORE UPDATE ON public.pharmacy_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();