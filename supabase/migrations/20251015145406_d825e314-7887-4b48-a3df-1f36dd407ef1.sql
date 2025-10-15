-- Ajouter les colonnes de profil médical à la table profiles
ALTER TABLE public.profiles
ADD COLUMN gender text CHECK (gender IN ('homme', 'femme', 'autre')),
ADD COLUMN age integer CHECK (age >= 0 AND age <= 150),
ADD COLUMN is_pregnant boolean DEFAULT false,
ADD COLUMN allergies text,
ADD COLUMN medical_history text;