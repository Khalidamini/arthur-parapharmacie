#!/usr/bin/env python3
"""
Arthur Pharmacy Connector v1.0
Connecteur officiel pour synchroniser automatiquement votre catalogue pharmacie avec Arthur
Compatible: Pharmagest, LGPI, Winpharma | Windows, macOS, Linux
"""

import os
import sys
import json
import time
import sqlite3
import platform
import logging
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime

# Configuration du logging
LOG_DIR = Path.home() / '.arthur-connector'
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'arthur-connector.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('ArthurConnector')

# Bannière de démarrage
BANNER = """
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              ARTHUR PHARMACY CONNECTOR v1.0              ║
║                                                           ║
║     Synchronisation automatique de votre catalogue       ║
║           Compatible: Pharmagest • LGPI • Winpharma      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"""

class Config:
    """Gestionnaire de configuration sécurisé"""
    
    def __init__(self):
        self.config_dir = Path.home() / '.arthur-connector'
        self.config_file = self.config_dir / 'config.json'
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.load()
    
    def load(self):
        """Charge la configuration"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.pharmacy_id = data.get('pharmacy_id', '')
                    self.api_key = data.get('api_key', '')
                    self.api_url = data.get('api_url', 'https://gtjmebionytcomoldgjl.supabase.co/functions/v1')
                    self.sync_interval = data.get('sync_interval', 15)
            except Exception as e:
                logger.error(f"Erreur chargement configuration: {e}")
                self._init_default()
        else:
            self._init_default()
    
    def _init_default(self):
        """Initialise la configuration par défaut"""
        self.pharmacy_id = ''
        self.api_key = ''
        self.api_url = 'https://gtjmebionytcomoldgjl.supabase.co/functions/v1'
        self.sync_interval = 15
    
    def save(self):
        """Sauvegarde la configuration"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'pharmacy_id': self.pharmacy_id,
                    'api_key': self.api_key,
                    'api_url': self.api_url,
                    'sync_interval': self.sync_interval
                }, f, indent=2)
            logger.info("Configuration sauvegardée")
        except Exception as e:
            logger.error(f"Erreur sauvegarde configuration: {e}")
    
    def is_configured(self) -> bool:
        """Vérifie si le connecteur est configuré"""
        return bool(self.pharmacy_id and self.api_key)


class DatabaseDetector:
    """Détecteur intelligent de bases de données pharmacie"""
    
    SEARCH_PATHS = {
        'Windows': [
            r'C:\Program Files\Pharmagest',
            r'C:\Program Files (x86)\Pharmagest',
            r'C:\ProgramData\Pharmagest',
            r'C:\LGPI',
            r'C:\Program Files\LGPI',
            r'C:\Winpharma',
            r'C:\Program Files\Winpharma',
            r'C:\Pharmacie',
        ],
        'Darwin': [
            '/Applications/Pharmagest',
            '/Applications/LGPI',
            '/Applications/Winpharma',
            str(Path.home() / 'Library/Application Support/Pharmagest'),
            str(Path.home() / 'Library/Application Support/LGPI'),
            str(Path.home() / 'Library/Application Support/Winpharma'),
        ],
        'Linux': [
            '/opt/pharmagest',
            '/opt/lgpi',
            '/opt/winpharma',
            str(Path.home() / '.pharmagest'),
            str(Path.home() / '.lgpi'),
            str(Path.home() / '.winpharma'),
        ]
    }
    
    def detect(self) -> Optional[Dict]:
        """Détecte automatiquement le logiciel de pharmacie"""
        system = platform.system()
        paths = self.SEARCH_PATHS.get(system, self.SEARCH_PATHS['Linux'])
        
        logger.info(f"Détection sur {system}...")
        
        for base_path in paths:
            base_path = Path(base_path)
            if not base_path.exists():
                continue
            
            logger.info(f"Scan de {base_path}...")
            
            # Chercher bases SQLite
            for ext in ['*.db', '*.sqlite', '*.sqlite3']:
                for db_file in base_path.rglob(ext):
                    if self._is_valid_pharmacy_db(db_file):
                        software_name = self._identify_software(str(base_path))
                        if software_name:
                            logger.info(f"✓ {software_name} détecté: {db_file}")
                            return {
                                'name': software_name,
                                'db_path': str(db_file),
                                'detected_at': datetime.now().isoformat()
                            }
        
        logger.warning("Aucun logiciel de pharmacie détecté")
        return None
    
    def _is_valid_pharmacy_db(self, db_path: Path) -> bool:
        """Vérifie si c'est une vraie base pharmacie"""
        try:
            conn = sqlite3.connect(str(db_path), timeout=5)
            cursor = conn.cursor()
            
            # Chercher des tables typiques
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0].lower() for row in cursor.fetchall()]
            
            conn.close()
            
            # Mots-clés de tables pharmacie
            keywords = ['produit', 'article', 'stock', 'medicament', 'prix']
            return any(keyword in ' '.join(tables) for keyword in keywords)
        except:
            return False
    
    def _identify_software(self, path: str) -> Optional[str]:
        """Identifie le logiciel depuis le chemin"""
        path_lower = path.lower()
        if 'pharmagest' in path_lower:
            return 'Pharmagest'
        elif 'lgpi' in path_lower:
            return 'LGPI'
        elif 'winpharma' in path_lower:
            return 'Winpharma'
        return 'Logiciel de pharmacie'


class ProductReader:
    """Lecteur universel de produits pharmacie"""
    
    QUERY_VARIANTS = [
        # Variante 1: Schéma standard
        {
            'query': """
                SELECT 
                    nom as name, marque as brand, prix as price,
                    categorie as category, description, stock as stock_quantity,
                    CASE WHEN actif = 1 THEN 1 ELSE 0 END as is_available
                FROM produits WHERE actif = 1
            """,
            'name': 'schema_standard'
        },
        # Variante 2: Schéma articles
        {
            'query': """
                SELECT 
                    libelle as name, fabricant as brand, pvttc as price,
                    famille as category, '' as description, qte_stock as stock_quantity,
                    CASE WHEN qte_stock > 0 THEN 1 ELSE 0 END as is_available
                FROM articles WHERE qte_stock >= 0
            """,
            'name': 'schema_articles'
        },
        # Variante 3: Schéma LGPI
        {
            'query': """
                SELECT 
                    designation as name, laboratoire as brand, prix_vente as price,
                    type as category, '' as description, quantite as stock_quantity,
                    1 as is_available
                FROM produits
            """,
            'name': 'schema_lgpi'
        },
        # Variante 4: Schéma minimal
        {
            'query': """
                SELECT 
                    libelle as name, marque as brand, prix as price,
                    rayon as category, '' as description, stock as stock_quantity,
                    1 as is_available
                FROM articles
            """,
            'name': 'schema_minimal'
        }
    ]
    
    def read_products(self, db_path: str) -> List[Dict]:
        """Lit les produits avec détection automatique du schéma"""
        products = []
        
        try:
            conn = sqlite3.connect(db_path, timeout=10)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            for variant in self.QUERY_VARIANTS:
                try:
                    cursor.execute(variant['query'])
                    rows = cursor.fetchall()
                    
                    for row in rows:
                        try:
                            products.append({
                                'name': str(row['name'] or 'Produit').strip(),
                                'brand': str(row['brand'] or 'Non spécifié').strip(),
                                'price': float(row['price']) if row['price'] else 0.0,
                                'category': str(row['category'] or 'Autres').strip(),
                                'description': str(row['description'] or '').strip()[:500],
                                'stock_quantity': int(row['stock_quantity']) if row['stock_quantity'] else 0,
                                'is_available': bool(row['is_available'])
                            })
                        except Exception as e:
                            logger.debug(f"Ligne ignorée: {e}")
                            continue
                    
                    if products:
                        logger.info(f"✓ {len(products)} produits lus ({variant['name']})")
                        break
                        
                except sqlite3.Error as e:
                    logger.debug(f"Variante {variant['name']} non compatible: {e}")
                    continue
            
            conn.close()
            
            if not products:
                logger.error("Aucun produit trouvé avec les schémas disponibles")
            
        except Exception as e:
            logger.error(f"Erreur lecture base: {e}")
        
        return products


class ArthurAPI:
    """Client API Arthur avec gestion d'erreurs robuste"""
    
    def __init__(self, config: Config):
        self.config = config
    
    def sync_products(self, products: List[Dict]) -> Dict:
        """Synchronise les produits vers Arthur"""
        import urllib.request
        import urllib.error
        
        url = f"{self.config.api_url}/sync-pharmacy-products"
        
        headers = {
            'Authorization': f'Bearer {self.config.api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'pharmacy_id': self.config.pharmacy_id,
            'products': products
        }
        
        try:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers=headers, method='POST')
            
            with urllib.request.urlopen(req, timeout=60) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result
                
        except urllib.error.HTTPError as e:
            error_msg = e.read().decode('utf-8')
            logger.error(f"Erreur HTTP {e.code}: {error_msg}")
            raise Exception(f"Erreur API: {e.code}")
        except urllib.error.URLError as e:
            logger.error(f"Erreur réseau: {e.reason}")
            raise Exception("Erreur de connexion à Arthur")
        except Exception as e:
            logger.error(f"Erreur inattendue: {e}")
            raise


class ArthurConnector:
    """Connecteur principal Arthur"""
    
    def __init__(self):
        self.config = Config()
        self.detector = DatabaseDetector()
        self.reader = ProductReader()
        self.api = ArthurAPI(self.config)
        self.detected_software = None
        self.last_sync = None
    
    def show_banner(self):
        """Affiche la bannière"""
        print(BANNER)
    
    def configure(self):
        """Assistant de configuration interactif"""
        self.show_banner()
        print("╔═══════════════════════════════════════════════════╗")
        print("║           CONFIGURATION DU CONNECTEUR            ║")
        print("╚═══════════════════════════════════════════════════╝\n")
        
        print("Ces informations sont disponibles dans votre")
        print("tableau de bord Arthur > Synchronisation\n")
        
        while True:
            pharmacy_id = input(f"ID Pharmacie: ").strip()
            if pharmacy_id:
                self.config.pharmacy_id = pharmacy_id
                break
            print("⚠️  ID pharmacie requis\n")
        
        while True:
            api_key = input(f"Clé API: ").strip()
            if api_key:
                self.config.api_key = api_key
                break
            print("⚠️  Clé API requise\n")
        
        self.config.save()
        
        print("\n✓ Configuration sauvegardée avec succès")
        print(f"✓ Fichier: {self.config.config_file}")
        print("\nVous pouvez maintenant lancer la synchronisation\n")
    
    def sync(self):
        """Effectue une synchronisation complète"""
        logger.info("═══ DÉMARRAGE SYNCHRONISATION ═══")
        
        if not self.config.is_configured():
            logger.error("❌ Connecteur non configuré")
            print("\n⚠️  Configuration requise")
            print("Lancez: python arthur-connector-standalone.py --configure\n")
            return False
        
        # Détection du logiciel
        if not self.detected_software:
            print("🔍 Détection du logiciel de pharmacie...")
            self.detected_software = self.detector.detect()
            
            if not self.detected_software:
                logger.error("❌ Aucun logiciel détecté")
                print("\n⚠️  Logiciel de pharmacie non détecté")
                print("Vérifiez que Pharmagest, LGPI ou Winpharma est installé\n")
                return False
            
            print(f"✓ {self.detected_software['name']} détecté\n")
        
        # Lecture des produits
        print("📦 Lecture du catalogue...")
        products = self.reader.read_products(self.detected_software['db_path'])
        
        if not products:
            logger.warning("⚠️  Aucun produit trouvé")
            print("\n⚠️  Aucun produit trouvé dans la base")
            print("Vérifiez que votre logiciel contient des produits\n")
            return False
        
        print(f"✓ {len(products)} produits trouvés\n")
        
        # Envoi vers Arthur
        print("☁️  Synchronisation avec Arthur...")
        try:
            result = self.api.sync_products(products)
            
            self.last_sync = datetime.now()
            
            logger.info(f"✓ Synchronisation réussie: {result}")
            print(f"\n✓ Synchronisation réussie!")
            
            if result.get('results'):
                res = result['results']
                print(f"  • Produits créés: {res.get('created', 0)}")
                print(f"  • Produits mis à jour: {res.get('updated', 0)}")
                if res.get('errors'):
                    print(f"  • Erreurs: {len(res['errors'])}")
            
            print(f"\n⏰ Dernière sync: {self.last_sync.strftime('%H:%M:%S')}\n")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur: {e}")
            print(f"\n❌ Erreur de synchronisation: {e}")
            print("Vérifiez votre connexion et vos identifiants\n")
            return False
    
    def run_daemon(self):
        """Mode daemon avec synchronisation automatique"""
        self.show_banner()
        
        if not self.config.is_configured():
            print("⚠️  Configuration requise\n")
            self.configure()
            print()
        
        print("╔═══════════════════════════════════════════════════╗")
        print("║          MODE AUTOMATIQUE ACTIVÉ                 ║")
        print("║   Synchronisation toutes les 15 minutes          ║")
        print("║   Ctrl+C pour arrêter                            ║")
        print("╚═══════════════════════════════════════════════════╝\n")
        
        # Première synchronisation
        self.sync()
        
        # Boucle de synchronisation
        try:
            while True:
                time.sleep(60)  # Check chaque minute
                
                if not self.last_sync:
                    continue
                
                elapsed = (datetime.now() - self.last_sync).total_seconds() / 60
                
                if elapsed >= self.config.sync_interval:
                    logger.info("⏰ Synchronisation programmée")
                    self.sync()
                
        except KeyboardInterrupt:
            print("\n\n╔═══════════════════════════════════════════════════╗")
            print("║         CONNECTEUR ARRÊTÉ                        ║")
            print("╚═══════════════════════════════════════════════════╝\n")
            logger.info("Connecteur arrêté par l'utilisateur")


def main():
    """Point d'entrée principal"""
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == '--configure':
            connector = ArthurConnector()
            connector.configure()
        
        elif command == '--sync':
            connector = ArthurConnector()
            connector.show_banner()
            connector.sync()
        
        elif command == '--daemon':
            connector = ArthurConnector()
            connector.run_daemon()
        
        elif command == '--help':
            print(BANNER)
            print("UTILISATION:")
            print("  --configure  Configuration initiale")
            print("  --sync       Synchronisation unique")
            print("  --daemon     Mode automatique (défaut)")
            print("  --help       Affiche cette aide\n")
        
        else:
            print(f"Commande inconnue: {command}")
            print("Utilisez --help pour voir les commandes disponibles\n")
    
    else:
        # Mode par défaut: daemon
        connector = ArthurConnector()
        connector.run_daemon()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        logger.error(f"Erreur fatale: {e}")
        print(f"\n❌ Erreur fatale: {e}\n")
        sys.exit(1)
