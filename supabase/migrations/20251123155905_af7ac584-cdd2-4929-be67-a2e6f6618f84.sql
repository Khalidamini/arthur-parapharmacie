-- Create table for Arthur's response cache
CREATE TABLE IF NOT EXISTS public.arthur_response_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_normalized TEXT NOT NULL,
  query_hash TEXT NOT NULL UNIQUE,
  response_text TEXT NOT NULL,
  context_type TEXT,
  hit_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_arthur_cache_hash ON public.arthur_response_cache(query_hash);
CREATE INDEX idx_arthur_cache_hit_count ON public.arthur_response_cache(hit_count DESC);
CREATE INDEX idx_arthur_cache_last_used ON public.arthur_response_cache(last_used_at DESC);

-- Enable RLS
ALTER TABLE public.arthur_response_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read cache
CREATE POLICY "Allow authenticated users to read cache"
ON public.arthur_response_cache
FOR SELECT
USING (true);

-- Policy: Only system can insert/update cache (via service role in edge function)
CREATE POLICY "System can manage cache"
ON public.arthur_response_cache
FOR ALL
USING (false);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_arthur_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_arthur_cache_timestamp
BEFORE UPDATE ON public.arthur_response_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_arthur_cache_timestamp();