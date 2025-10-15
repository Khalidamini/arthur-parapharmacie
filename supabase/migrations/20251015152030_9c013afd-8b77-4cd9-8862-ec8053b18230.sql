-- Ajouter les colonnes image_url et original_price à la table promotions
ALTER TABLE public.promotions
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS original_price numeric;

-- Mettre à jour les promotions existantes avec des images et des prix
UPDATE public.promotions SET 
  image_url = 'https://images.unsplash.com/photo-1550572017-4814c5c0fec0?w=400',
  original_price = 12.90
WHERE title LIKE '%Vitamines%';

UPDATE public.promotions SET 
  image_url = 'https://images.unsplash.com/photo-1532413992378-f169ac26fff0?w=400',
  original_price = 24.90
WHERE title LIKE '%Crèmes solaires%';

UPDATE public.promotions SET 
  image_url = 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400',
  original_price = 19.90
WHERE title LIKE '%Compléments alimentaires%';

UPDATE public.promotions SET 
  image_url = 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400',
  original_price = 29.50
WHERE title LIKE '%Soins du visage%';