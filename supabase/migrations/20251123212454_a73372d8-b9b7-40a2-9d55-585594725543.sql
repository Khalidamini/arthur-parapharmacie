-- Create storage bucket for pharmacy logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('pharmacy-logos', 'pharmacy-logos', true);

-- Add logo_url column to pharmacies table
ALTER TABLE public.pharmacies
ADD COLUMN logo_url text;

-- Create RLS policies for pharmacy logos bucket
CREATE POLICY "Anyone can view pharmacy logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pharmacy-logos');

CREATE POLICY "Pharmacy staff can upload their pharmacy logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pharmacy-logos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.pharmacy_id::text = (storage.foldername(name))[1]
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Pharmacy staff can update their pharmacy logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pharmacy-logos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.pharmacy_id::text = (storage.foldername(name))[1]
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Pharmacy staff can delete their pharmacy logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pharmacy-logos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.pharmacy_id::text = (storage.foldername(name))[1]
    AND ur.role IN ('owner', 'admin')
  )
);