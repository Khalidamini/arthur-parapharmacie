-- Create storage bucket for connector updates
INSERT INTO storage.buckets (id, name, public)
VALUES ('connector-updates', 'connector-updates', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can download connector files
CREATE POLICY "Public can download connector files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'connector-updates');

-- Policy: Only admins can upload connector files
CREATE POLICY "Admins can upload connector files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'connector-updates' 
  AND is_admin(auth.uid())
);