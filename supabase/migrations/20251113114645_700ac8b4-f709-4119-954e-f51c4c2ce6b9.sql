-- Ajouter une colonne product_id dans la table promotions pour lier les promotions aux produits
ALTER TABLE promotions ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX idx_promotions_product_id ON promotions(product_id);