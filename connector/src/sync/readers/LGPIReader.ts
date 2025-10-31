import Database from 'better-sqlite3';
import log from 'electron-log';
import { ProductData } from '../types';

export class LGPIReader {
  async readProducts(dbPath: string): Promise<ProductData[]> {
    const products: ProductData[] = [];

    try {
      const db = new Database(dbPath, { readonly: true });

      const queries = [
        `SELECT 
          designation as name,
          laboratoire as brand,
          prix_vente as price,
          famille as category,
          stock as stock_quantity
        FROM produits`,
        
        `SELECT 
          libelle as name,
          marque as brand,
          prix as price,
          type as category,
          quantite as stock_quantity
        FROM articles`
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
              stock_quantity: parseInt(row.stock_quantity) || 0,
              is_available: parseInt(row.stock_quantity) > 0
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

      log.info(`${products.length} produits lus depuis LGPI`);
      return products;
    } catch (error) {
      log.error('Erreur lecture LGPI', error);
      throw error;
    }
  }
}
