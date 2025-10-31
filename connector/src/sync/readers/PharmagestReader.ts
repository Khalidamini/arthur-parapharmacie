import Database from 'better-sqlite3';
import log from 'electron-log';
import { ProductData } from '../types';

export class PharmagestReader {
  async readProducts(dbPath: string): Promise<ProductData[]> {
    const products: ProductData[] = [];

    try {
      const db = new Database(dbPath, { readonly: true });

      // Requêtes possibles selon le schéma Pharmagest
      // Note: Ces requêtes sont des exemples et doivent être adaptées
      const queries = [
        // Tentative 1: Schéma standard
        `SELECT 
          nom as name,
          marque as brand,
          prix as price,
          categorie as category,
          description,
          stock as stock_quantity,
          actif as is_available
        FROM produits
        WHERE actif = 1`,
        
        // Tentative 2: Schéma alternatif
        `SELECT 
          libelle as name,
          fabricant as brand,
          pvttc as price,
          famille as category,
          qte_stock as stock_quantity,
          1 as is_available
        FROM articles
        WHERE qte_stock > 0`
      ];

      let success = false;

      for (const query of queries) {
        try {
          const stmt = db.prepare(query);
          const rows = stmt.all();

          for (const row: any) {
            products.push({
              name: row.name || 'Produit',
              brand: row.brand || 'Non spécifié',
              price: parseFloat(row.price) || 0,
              category: row.category || 'Autres',
              description: row.description,
              stock_quantity: parseInt(row.stock_quantity) || 0,
              is_available: row.is_available ? true : false
            });
          }

          if (products.length > 0) {
            success = true;
            break;
          }
        } catch (queryError) {
          log.debug(`Tentative de requête échouée: ${queryError}`);
          continue;
        }
      }

      db.close();

      if (!success) {
        throw new Error('Impossible de lire les produits avec les schémas connus');
      }

      log.info(`${products.length} produits lus depuis Pharmagest`);
      return products;
    } catch (error) {
      log.error('Erreur lecture Pharmagest', error);
      throw error;
    }
  }
}
