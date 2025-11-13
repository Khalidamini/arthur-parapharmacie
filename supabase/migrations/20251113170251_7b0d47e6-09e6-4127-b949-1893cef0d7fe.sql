-- Ajouter les colonnes pour stocker le statut de livraison Sendcloud
ALTER TABLE public.carts 
ADD COLUMN IF NOT EXISTS delivery_status TEXT,
ADD COLUMN IF NOT EXISTS delivery_status_id INTEGER;

-- Créer un index pour améliorer les performances des requêtes de suivi
CREATE INDEX IF NOT EXISTS idx_carts_delivery_tracking 
ON public.carts(delivery_method, payment_status, shipping_tracking_number)
WHERE delivery_method = 'delivery' AND payment_status = 'paid' AND shipping_tracking_number IS NOT NULL;

-- Commenter les nouvelles colonnes
COMMENT ON COLUMN public.carts.delivery_status IS 'Statut de livraison Sendcloud (message lisible)';
COMMENT ON COLUMN public.carts.delivery_status_id IS 'ID du statut de livraison Sendcloud';