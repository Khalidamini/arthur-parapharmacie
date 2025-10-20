-- Ajouter un champ pour le statut de notification dans la table carts
ALTER TABLE public.carts 
ADD COLUMN ready_for_pickup boolean DEFAULT false,
ADD COLUMN notification_sent_at timestamp with time zone,
ADD COLUMN pickup_message text;

-- Créer les RLS policies pour que les pharmaciens puissent voir les commandes
CREATE POLICY "Pharmacy staff can view their pharmacy carts"
ON public.carts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.pharmacy_id = carts.pharmacy_id
  )
);

CREATE POLICY "Pharmacy staff can update their pharmacy carts"
ON public.carts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.pharmacy_id = carts.pharmacy_id
  )
);

-- Les items de panier doivent aussi être visibles par les pharmaciens
CREATE POLICY "Pharmacy staff can view cart items for their pharmacy"
ON public.cart_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.carts
    INNER JOIN public.user_roles ON user_roles.pharmacy_id = carts.pharmacy_id
    WHERE carts.id = cart_items.cart_id
      AND user_roles.user_id = auth.uid()
  )
);