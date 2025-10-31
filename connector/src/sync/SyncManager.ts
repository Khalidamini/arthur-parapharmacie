import log from 'electron-log';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseDetector } from './DatabaseDetector';
import { PharmagestReader } from './readers/PharmagestReader';
import { LGPIReader } from './readers/LGPIReader';
import { WinpharmaReader } from './readers/WinpharmaReader';
import { ProductData } from './types';

export interface SyncResult {
  success: boolean;
  totalProducts: number;
  syncedProducts: number;
  errors: string[];
}

export class SyncManager {
  private configManager: ConfigManager;
  private detector: DatabaseDetector;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.detector = new DatabaseDetector();
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      totalProducts: 0,
      syncedProducts: 0,
      errors: []
    };

    try {
      // Vérifier la configuration
      if (!this.configManager.isConfigured()) {
        throw new Error('Connecteur non configuré');
      }

      // Détecter le logiciel de pharmacie
      const detection = await this.detector.detect();
      
      if (!detection) {
        throw new Error('Aucun logiciel de pharmacie détecté');
      }

      log.info(`Logiciel détecté: ${detection.name} à ${detection.dbPath}`);

      // Sauvegarder la détection dans la config
      this.configManager.saveConfig({
        detectedSoftware: detection
      });

      // Lire les produits selon le logiciel détecté
      let products: ProductData[] = [];
      
      switch (detection.name) {
        case 'Pharmagest':
          products = await new PharmagestReader().readProducts(detection.dbPath);
          break;
        case 'LGPI':
          products = await new LGPIReader().readProducts(detection.dbPath);
          break;
        case 'Winpharma':
          products = await new WinpharmaReader().readProducts(detection.dbPath);
          break;
        default:
          throw new Error(`Logiciel non supporté: ${detection.name}`);
      }

      result.totalProducts = products.length;
      log.info(`${products.length} produits lus depuis ${detection.name}`);

      // Envoyer les produits à Arthur
      if (products.length > 0) {
        await this.sendToArthur(products);
        result.syncedProducts = products.length;
        result.success = true;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      log.error('Erreur de synchronisation', error);
      result.errors.push(errorMessage);
      
      // Remonter l'erreur critique à Arthur
      await this.reportError(errorMessage);
      
      return result;
    }
  }

  private async sendToArthur(products: ProductData[]): Promise<void> {
    const config = this.configManager.getConfig();
    const url = `${config.apiUrl}/sync-pharmacy-products`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pharmacy_id: config.pharmacyId,
          products
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erreur API: ${response.status} - ${error}`);
      }

      const result = await response.json();
      log.info('Produits envoyés avec succès', result);
    } catch (error) {
      log.error('Erreur lors de l\'envoi à Arthur', error);
      throw error;
    }
  }

  private async reportError(errorMessage: string): Promise<void> {
    const config = this.configManager.getConfig();
    const url = `${config.apiUrl}/connector-error-logs`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pharmacy_id: config.pharmacyId,
          error: errorMessage,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      log.error('Impossible de remonter l\'erreur à Arthur', error);
    }
  }
}
