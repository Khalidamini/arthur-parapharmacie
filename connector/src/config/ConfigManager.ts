import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import log from 'electron-log';

export interface ConnectorConfig {
  pharmacyId: string;
  apiKey: string;
  apiUrl: string;
  detectedSoftware?: {
    name: string;
    version?: string;
    dbPath: string;
  };
  syncInterval: number; // en minutes
}

export class ConfigManager {
  private configPath: string;
  private config: ConnectorConfig | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(data);
        log.info('Configuration chargée');
      } else {
        log.info('Aucune configuration trouvée, utilisation des valeurs par défaut');
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      log.error('Erreur lors du chargement de la configuration', error);
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): ConnectorConfig {
    return {
      pharmacyId: '',
      apiKey: '',
      apiUrl: 'https://gtjmebionytcomoldgjl.supabase.co/functions/v1',
      syncInterval: 15
    };
  }

  getConfig(): ConnectorConfig {
    return this.config || this.getDefaultConfig();
  }

  saveConfig(config: Partial<ConnectorConfig>): void {
    this.config = {
      ...this.getConfig(),
      ...config
    };

    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      log.info('Configuration sauvegardée');
    } catch (error) {
      log.error('Erreur lors de la sauvegarde de la configuration', error);
      throw error;
    }
  }

  isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config.pharmacyId && config.apiKey);
  }

  getPharmacyId(): string {
    return this.getConfig().pharmacyId;
  }

  getApiKey(): string {
    return this.getConfig().apiKey;
  }

  getApiUrl(): string {
    return this.getConfig().apiUrl;
  }
}
