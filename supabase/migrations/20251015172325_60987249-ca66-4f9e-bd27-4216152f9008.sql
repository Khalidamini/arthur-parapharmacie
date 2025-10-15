-- Ajouter une colonne username à la table profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Créer un index pour les recherches rapides par username
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);