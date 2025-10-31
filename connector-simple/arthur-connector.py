#!/usr/bin/env python3
"""
Arthur Pharmacy Connector - Version Python Simple
Synchronise automatiquement les produits des logiciels de pharmacie vers Arthur
"""

import os
import sys
import json
import time
import sqlite3
import platform
import schedule
import logging
from pathlib import Path
from typing import Optional, List, Dict
import requests

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('arthur-connector.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger('ArthurConnector')


class Config:
    """Gestionnaire de configuration"""
    
    def __init__(self):
        self.config_file = Path.home() / '.arthur-connector' / 'config.json'
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        self.load()
    
    def load(self):
        """Charge la configuration"""
        if self.config_file.exists():
            with open(self.config_file, 'r') as f:
                data = json.load(f)
                self.pharmacy_id = data.get('pharmacy_id', '')
                self.api_key = data.get('api_key', '')
                self.api_url = data.get('api_url', 'https://gtjmebionytcomoldgjl.supabase.co/functions/v1')
        else:
            self.pharmacy_id = ''
            self.api_key = ''
            self.api_url = 'https://gtjmebionytcomoldgjl.supabase.co/functions/v1'
    
    def save(self):
        """Sauvegarde la configuration"""
        with open(self.config_file, 'w') as f:
            json.dump({
                'pharmacy_id': self.pharmacy_id,
                'api_key': self.api_key,
                'api_url': self.api_url
            }, f, indent=2)
    
    def is_configured(self) -> bool:
        """Vérifie si le connecteur est configuré"""
        return bool(self.pharmacy_id and self.api_key)


class DatabaseDetector:
    """Détecte les bases de données des logiciels de pharmacie"""
    
    SEARCH_PATHS = {
        'Windows': [
            'C:\\Program Files\\Pharmagest',
            'C:\\Program Files (x86)\\Pharmagest',
            'C:\\ProgramData\\Pharmagest',
            'C:\\LGPI',
            'C:\\Winpharma',
        ],
        'Darwin': [  # macOS
            '/Applications/Pharmagest',
            '/Applications/LGPI',
            '/Applications/Winpharma',
        ],
        'Linux': [
            '/opt/pharmagest',
            '/opt/lgpi',
            '/opt/winpharma',
        ]
    }
    
    def detect(self) -> Optional[Dict]:
        """Détecte le logiciel de pharmacie installé"""
        system = platform.system()
        paths = self.SEARCH_PATHS.get(system, self.SEARCH_PATHS['Linux'])
        
        for base_path in paths:
            base_path = Path(base_path)
            if not base_path.exists():
                continue
            
            # Chercher les bases de données
            for db_file in base_path.rglob('*.db'):
                software_name = self._identify_software(base_path.name)
                if software_name:
                    logger.info(f"Logiciel détecté: {software_name} à {db_file}")
                    return {
                        'name': software_name,
                        'db_path': str(db_file)
                    }
            
            # Chercher aussi les .sqlite
            for db_file in base_path.rglob('*.sqlite'):
                software_name = self._identify_software(base_path.name)
                if software_name:
                    logger.info(f"Logiciel détecté: {software_name} à {db_file}")
                    return {
                        'name': software_name,
                        'db_path': str(db_file)
                    }
        
        return None
    
    def _identify_software(self, path_name: str) -> Optional[str]:
        """Identifie le logiciel depuis le nom du chemin"""
        path_lower = path_name.lower()
        if 'pharmagest' in path_lower:
            return 'Pharmagest'
        elif 'lgpi' in path_lower:
            return 'LGPI'
        elif 'winpharma' in path_lower:
            return 'Winpharma'
        return None


class ProductReader:
    """Lit les produits depuis la base de données"""
    
    QUERIES = {
        'standard': """
            SELECT 
                nom as name,
                marque as brand,
                prix as price,
                categorie as category,
                description,
                stock as stock_quantity
            FROM produits
            WHERE actif = 1
        """,
        'alternative1': """
            SELECT 
                libelle as name,
                fabricant as brand,
                pvttc as price,
                famille as category,
                qte_stock as stock_quantity
            FROM articles
        """,
        'alternative2': """
            SELECT 
                designation as name,
                laboratoire as brand,
                prix_vente as price,
                type as category,
                quantite as stock_quantity
            FROM produits
        """
    }
    
    def read_products(self, db_path: str) -> List[Dict]:
        """Lit les produits depuis la base"""
        products = []
        
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Essayer différentes requêtes
            for query_name, query in self.QUERIES.items():
                try:
                    cursor.execute(query)
                    rows = cursor.fetchall()
                    
                    for row in rows:
                        products.append({
                            'name': row['name'] or 'Produit',
                            'brand': row['brand'] or 'Non spécifié',
                            'price': float(row['price']) if row['price'] else 0,
                            'category': row['category'] or 'Autres',
                            'description': row.get('description'),
                            'stock_quantity': int(row['stock_quantity']) if row['stock_quantity'] else 0,
                            'is_available': True
                        })
                    
                    if products:
                        logger.info(f"✓ {len(products)} produits lus avec la requête: {query_name}")
                        break
                        
                except sqlite3.Error as e:
                    logger.debug(f"Requête {query_name} échouée: {e}")
                    continue
            
            conn.close()
            
        except Exception as e:
            logger.error(f"Erreur lecture base de données: {e}")
        
        return products


class ArthurAPI:
    """Client API Arthur"""
    
    def __init__(self, config: Config):
        self.config = config
    
    def sync_products(self, products: List[Dict]) -> Dict:
        """Synchronise les produits vers Arthur"""
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
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur API: {e}")
            raise


class ArthurConnector:
    """Connecteur principal"""
    
    def __init__(self):
        self.config = Config()
        self.detector = DatabaseDetector()
        self.reader = ProductReader()
        self.api = ArthurAPI(self.config)
        self.detected_software = None
    
    def configure(self):
        """Configuration interactive"""
        print("\n" + "="*50)
        print("Configuration du connecteur Arthur")
        print("="*50 + "\n")
        
        pharmacy_id = input(f"ID Pharmacie [{self.config.pharmacy_id}]: ").strip()
        if pharmacy_id:
            self.config.pharmacy_id = pharmacy_id
        
        api_key = input(f"Clé API: ").strip()
        if api_key:
            self.config.api_key = api_key
        
        self.config.save()
        print("\n✓ Configuration sauvegardée\n")
    
    def sync(self):
        """Effectue une synchronisation"""
        logger.info("Démarrage de la synchronisation...")
        
        if not self.config.is_configured():
            logger.error("❌ Connecteur non configuré. Lancez avec --configure")
            return
        
        # Détecter le logiciel si pas déjà fait
        if not self.detected_software:
            self.detected_software = self.detector.detect()
            if not self.detected_software:
                logger.error("❌ Aucun logiciel de pharmacie détecté")
                return
        
        # Lire les produits
        products = self.reader.read_products(self.detected_software['db_path'])
        
        if not products:
            logger.warning("⚠️ Aucun produit trouvé")
            return
        
        # Envoyer à Arthur
        try:
            result = self.api.sync_products(products)
            logger.info(f"✓ Synchronisation réussie: {result}")
        except Exception as e:
            logger.error(f"❌ Erreur de synchronisation: {e}")
    
    def run_daemon(self):
        """Lance le connecteur en mode daemon"""
        logger.info("Démarrage du connecteur Arthur en mode automatique")
        logger.info("Synchronisation toutes les 15 minutes")
        
        # Synchronisation immédiate
        self.sync()
        
        # Programmer la synchronisation toutes les 15 minutes
        schedule.every(15).minutes.do(self.sync)
        
        # Boucle principale
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)
        except KeyboardInterrupt:
            logger.info("\nArrêt du connecteur")


def main():
    """Point d'entrée principal"""
    connector = ArthurConnector()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--configure':
            connector.configure()
        elif sys.argv[1] == '--sync':
            connector.sync()
        elif sys.argv[1] == '--daemon':
            connector.run_daemon()
        else:
            print("Usage: python arthur-connector.py [--configure|--sync|--daemon]")
    else:
        # Mode par défaut: daemon
        if not connector.config.is_configured():
            print("Configuration requise. Lancez avec --configure")
            connector.configure()
        connector.run_daemon()


if __name__ == '__main__':
    main()
