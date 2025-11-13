-- Supprimer la table des invitations (ancien système)
DROP TABLE IF EXISTS public.pharmacy_invitations CASCADE;

-- Ajouter un champ pour forcer le changement de mot de passe
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS temporary_password_set_at timestamp with time zone;

-- Créer un index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_user_roles_must_change_password 
ON public.user_roles(user_id) 
WHERE must_change_password = true;