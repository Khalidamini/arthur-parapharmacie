import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import log from 'electron-log';

export interface DetectionResult {
  name: string;
  version?: string;
  dbPath: string;
}

export class DatabaseDetector {
  private readonly searchPaths: Record<string, string[]> = {
    win32: [
      'C:\\Program Files\\Pharmagest',
      'C:\\Program Files (x86)\\Pharmagest',
      'C:\\ProgramData\\Pharmagest',
      'C:\\LGPI',
      'C:\\Program Files\\LGPI',
      'C:\\Winpharma',
      'C:\\Program Files\\Winpharma'
    ],
    darwin: [
      '/Applications/Pharmagest',
      '/Applications/LGPI',
      '/Applications/Winpharma',
      path.join(os.homedir(), 'Library/Application Support/Pharmagest'),
      path.join(os.homedir(), 'Library/Application Support/LGPI'),
      path.join(os.homedir(), 'Library/Application Support/Winpharma')
    ],
    linux: [
      '/opt/pharmagest',
      '/opt/lgpi',
      '/opt/winpharma',
      path.join(os.homedir(), '.pharmagest'),
      path.join(os.homedir(), '.lgpi'),
      path.join(os.homedir(), '.winpharma')
    ]
  };

  async detect(): Promise<DetectionResult | null> {
    const platform = os.platform() as keyof typeof this.searchPaths;
    const paths = this.searchPaths[platform] || this.searchPaths.linux;

    log.info(`Détection des logiciels de pharmacie sur ${platform}`);

    // Chercher Pharmagest
    for (const basePath of paths) {
      if (basePath.toLowerCase().includes('pharmagest')) {
        const result = await this.detectPharmagest(basePath);
        if (result) return result;
      }
    }

    // Chercher LGPI
    for (const basePath of paths) {
      if (basePath.toLowerCase().includes('lgpi')) {
        const result = await this.detectLGPI(basePath);
        if (result) return result;
      }
    }

    // Chercher Winpharma
    for (const basePath of paths) {
      if (basePath.toLowerCase().includes('winpharma')) {
        const result = await this.detectWinpharma(basePath);
        if (result) return result;
      }
    }

    log.warn('Aucun logiciel de pharmacie détecté');
    return null;
  }

  private async detectPharmagest(basePath: string): Promise<DetectionResult | null> {
    try {
      if (!fs.existsSync(basePath)) return null;

      // Patterns de recherche pour la base de données Pharmagest
      const dbPatterns = [
        'data/pharmagest.db',
        'database/pharmagest.sqlite',
        'db/pharma.db',
        'pharmagest.mdb' // Access Database
      ];

      for (const pattern of dbPatterns) {
        const dbPath = path.join(basePath, pattern);
        if (fs.existsSync(dbPath)) {
          log.info(`Base Pharmagest trouvée: ${dbPath}`);
          return {
            name: 'Pharmagest',
            dbPath
          };
        }
      }

      // Recherche récursive limitée
      const found = this.searchRecursive(basePath, ['*.db', '*.sqlite', '*.mdb'], 2);
      if (found) {
        log.info(`Base Pharmagest trouvée: ${found}`);
        return {
          name: 'Pharmagest',
          dbPath: found
        };
      }
    } catch (error) {
      log.error(`Erreur détection Pharmagest: ${error}`);
    }

    return null;
  }

  private async detectLGPI(basePath: string): Promise<DetectionResult | null> {
    try {
      if (!fs.existsSync(basePath)) return null;

      const dbPatterns = [
        'data/lgpi.db',
        'database/lgpi.sqlite',
        'db/gestion.db'
      ];

      for (const pattern of dbPatterns) {
        const dbPath = path.join(basePath, pattern);
        if (fs.existsSync(dbPath)) {
          log.info(`Base LGPI trouvée: ${dbPath}`);
          return {
            name: 'LGPI',
            dbPath
          };
        }
      }

      const found = this.searchRecursive(basePath, ['*.db', '*.sqlite'], 2);
      if (found) {
        log.info(`Base LGPI trouvée: ${found}`);
        return {
          name: 'LGPI',
          dbPath: found
        };
      }
    } catch (error) {
      log.error(`Erreur détection LGPI: ${error}`);
    }

    return null;
  }

  private async detectWinpharma(basePath: string): Promise<DetectionResult | null> {
    try {
      if (!fs.existsSync(basePath)) return null;

      const dbPatterns = [
        'data/winpharma.db',
        'database/winpharma.sqlite',
        'db/pharma.db'
      ];

      for (const pattern of dbPatterns) {
        const dbPath = path.join(basePath, pattern);
        if (fs.existsSync(dbPath)) {
          log.info(`Base Winpharma trouvée: ${dbPath}`);
          return {
            name: 'Winpharma',
            dbPath
          };
        }
      }

      const found = this.searchRecursive(basePath, ['*.db', '*.sqlite'], 2);
      if (found) {
        log.info(`Base Winpharma trouvée: ${found}`);
        return {
          name: 'Winpharma',
          dbPath: found
        };
      }
    } catch (error) {
      log.error(`Erreur détection Winpharma: ${error}`);
    }

    return null;
  }

  private searchRecursive(
    dir: string,
    patterns: string[],
    maxDepth: number,
    currentDepth = 0
  ): string | null {
    if (currentDepth > maxDepth) return null;

    try {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const found = this.searchRecursive(fullPath, patterns, maxDepth, currentDepth + 1);
          if (found) return found;
        } else {
          for (const pattern of patterns) {
            const ext = pattern.replace('*', '');
            if (file.endsWith(ext)) {
              return fullPath;
            }
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs de permission
    }

    return null;
  }
}
