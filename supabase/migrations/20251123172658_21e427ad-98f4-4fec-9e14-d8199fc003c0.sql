-- Add column to control tutorial display at startup
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS skip_tutorial_at_startup boolean DEFAULT false;