import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as schedule from 'node-schedule';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import { SyncManager } from './sync/SyncManager';
import { ConfigManager } from './config/ConfigManager';

// Configuration des logs
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

class ArthurConnector {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private syncManager: SyncManager;
  private configManager: ConfigManager;
  private syncJob: schedule.Job | null = null;

  constructor() {
    this.configManager = new ConfigManager();
    this.syncManager = new SyncManager(this.configManager);
  }

  async initialize() {
    await app.whenReady();
    
    // Créer le tray icon
    this.createTray();
    
    // Vérifier les mises à jour
    this.setupAutoUpdater();
    
    // Configurer la synchronisation automatique
    await this.setupAutoSync();
    
    // Première synchronisation au démarrage
    await this.performSync();
    
    log.info('Arthur Connector démarré avec succès');
  }

  createTray() {
    // Créer une icône simple (en production, utiliser une vraie icône)
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Arthur Pharmacy Connector',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Synchroniser maintenant',
        click: async () => {
          await this.performSync();
        }
      },
      {
        label: 'Configurer',
        click: () => {
          this.showConfigWindow();
        }
      },
      {
        label: 'Logs',
        click: () => {
          this.showLogsWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Quitter',
        click: () => {
          app.quit();
        }
      }
    ]);
    
    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Arthur Pharmacy Connector');
  }

  setupAutoUpdater() {
    autoUpdater.logger = log;
    
    autoUpdater.on('update-available', () => {
      log.info('Mise à jour disponible');
      // Notification à l'utilisateur
    });
    
    autoUpdater.on('update-downloaded', () => {
      log.info('Mise à jour téléchargée');
      // Demander à l'utilisateur de redémarrer
      autoUpdater.quitAndInstall();
    });
    
    // Vérifier les mises à jour toutes les heures
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);
    
    // Vérification au démarrage
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 5000);
  }

  async setupAutoSync() {
    // Synchronisation toutes les 15 minutes
    this.syncJob = schedule.scheduleJob('*/15 * * * *', async () => {
      log.info('Synchronisation automatique déclenchée');
      await this.performSync();
    });
    
    log.info('Synchronisation automatique configurée (toutes les 15 minutes)');
  }

  async performSync() {
    try {
      this.updateTrayStatus('sync');
      const result = await this.syncManager.sync();
      
      log.info('Synchronisation terminée', result);
      this.updateTrayStatus('idle');
      
      // Afficher une notification si des produits ont été synchronisés
      if (result.totalProducts > 0) {
        this.showNotification(
          'Synchronisation réussie',
          `${result.totalProducts} produits synchronisés`
        );
      }
    } catch (error) {
      log.error('Erreur de synchronisation', error);
      this.updateTrayStatus('error');
      this.showNotification(
        'Erreur de synchronisation',
        'Vérifiez les logs pour plus de détails'
      );
    }
  }

  updateTrayStatus(status: 'idle' | 'sync' | 'error') {
    const tooltips = {
      idle: 'Arthur Connector - En attente',
      sync: 'Arthur Connector - Synchronisation...',
      error: 'Arthur Connector - Erreur'
    };
    
    this.tray?.setToolTip(tooltips[status]);
  }

  showNotification(title: string, body: string) {
    // Utiliser l'API Notification d'Electron
    if (this.mainWindow) {
      this.mainWindow.webContents.send('notification', { title, body });
    }
  }

  showConfigWindow() {
    if (this.mainWindow) {
      this.mainWindow.focus();
      return;
    }
    
    this.mainWindow = new BrowserWindow({
      width: 600,
      height: 500,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      title: 'Configuration Arthur Connector'
    });
    
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/config.html'));
    
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  showLogsWindow() {
    const logsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      title: 'Logs Arthur Connector'
    });
    
    logsWindow.loadFile(path.join(__dirname, '../renderer/logs.html'));
  }
}

// Point d'entrée
const connector = new ArthurConnector();
connector.initialize().catch(err => {
  log.error('Erreur fatale au démarrage', err);
  app.quit();
});

// Empêcher l'application de se fermer complètement
app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
