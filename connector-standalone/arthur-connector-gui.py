#!/usr/bin/env python3
"""
Arthur Pharmacy Connector - Interface Graphique
Interface conviviale pour la synchronisation automatique
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import json
import threading
import time
from pathlib import Path
from datetime import datetime
from typing import Optional
import sys
import os

# Import du connecteur principal
sys.path.insert(0, os.path.dirname(__file__))
from arthur_connector_standalone import (
    Config, DatabaseDetector, ProductReader, ArthurAPI, logger
)


class ArthurConnectorGUI:
    """Interface graphique pour Arthur Connector"""
    
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Arthur Pharmacy Connector")
        self.root.geometry("700x600")
        self.root.resizable(False, False)
        
        # Style moderne
        self.setup_style()
        
        # Variables
        self.config = Config()
        self.detector = DatabaseDetector()
        self.reader = ProductReader()
        self.detected_software = None
        self.sync_running = False
        self.auto_sync_active = False
        
        # Interface
        self.create_ui()
        self.load_config()
        
    def setup_style(self):
        """Configure le style moderne"""
        style = ttk.Style()
        style.theme_use('clam')
        
        # Couleurs
        bg_color = "#f5f5f5"
        accent_color = "#4a90e2"
        success_color = "#27ae60"
        error_color = "#e74c3c"
        
        self.root.configure(bg=bg_color)
        
        # Styles personnalisés
        style.configure('Title.TLabel', 
                       font=('Helvetica', 16, 'bold'),
                       background=bg_color,
                       foreground='#2c3e50')
        
        style.configure('Subtitle.TLabel',
                       font=('Helvetica', 10),
                       background=bg_color,
                       foreground='#7f8c8d')
        
        style.configure('Info.TLabel',
                       font=('Helvetica', 9),
                       background=bg_color,
                       foreground='#34495e')
        
        style.configure('Success.TLabel',
                       font=('Helvetica', 9, 'bold'),
                       background=bg_color,
                       foreground=success_color)
        
        style.configure('Error.TLabel',
                       font=('Helvetica', 9, 'bold'),
                       background=bg_color,
                       foreground=error_color)
        
        style.configure('Primary.TButton',
                       font=('Helvetica', 10, 'bold'),
                       background=accent_color)
        
    def create_ui(self):
        """Crée l'interface utilisateur"""
        
        # En-tête
        header_frame = tk.Frame(self.root, bg='#4a90e2', height=100)
        header_frame.pack(fill='x')
        header_frame.pack_propagate(False)
        
        title_label = tk.Label(
            header_frame,
            text="Arthur Pharmacy Connector",
            font=('Helvetica', 20, 'bold'),
            bg='#4a90e2',
            fg='white'
        )
        title_label.pack(pady=10)
        
        subtitle_label = tk.Label(
            header_frame,
            text="Synchronisation automatique de votre catalogue pharmacie",
            font=('Helvetica', 10),
            bg='#4a90e2',
            fg='white'
        )
        subtitle_label.pack()
        
        # Zone principale
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill='both', expand=True)
        
        # Section Configuration
        config_frame = ttk.LabelFrame(main_frame, text="Configuration", padding="10")
        config_frame.pack(fill='x', pady=(0, 10))
        
        # ID Pharmacie
        ttk.Label(config_frame, text="ID Pharmacie:").grid(row=0, column=0, sticky='w', pady=5)
        self.pharmacy_id_entry = ttk.Entry(config_frame, width=40)
        self.pharmacy_id_entry.grid(row=0, column=1, pady=5, padx=(10, 0))
        
        # Clé API
        ttk.Label(config_frame, text="Clé API:").grid(row=1, column=0, sticky='w', pady=5)
        self.api_key_entry = ttk.Entry(config_frame, width=40, show="*")
        self.api_key_entry.grid(row=1, column=1, pady=5, padx=(10, 0))
        
        # Bouton sauvegarder
        save_btn = ttk.Button(
            config_frame,
            text="💾 Sauvegarder",
            command=self.save_config,
            style='Primary.TButton'
        )
        save_btn.grid(row=2, column=1, pady=10, sticky='e')
        
        # Section Statut
        status_frame = ttk.LabelFrame(main_frame, text="Statut", padding="10")
        status_frame.pack(fill='x', pady=(0, 10))
        
        # Logiciel détecté
        ttk.Label(status_frame, text="Logiciel détecté:").grid(row=0, column=0, sticky='w', pady=5)
        self.software_label = ttk.Label(status_frame, text="Non détecté", style='Info.TLabel')
        self.software_label.grid(row=0, column=1, sticky='w', pady=5, padx=(10, 0))
        
        detect_btn = ttk.Button(
            status_frame,
            text="🔍 Détecter",
            command=self.detect_software
        )
        detect_btn.grid(row=0, column=2, pady=5, padx=(10, 0))
        
        # Dernière sync
        ttk.Label(status_frame, text="Dernière sync:").grid(row=1, column=0, sticky='w', pady=5)
        self.last_sync_label = ttk.Label(status_frame, text="Jamais", style='Info.TLabel')
        self.last_sync_label.grid(row=1, column=1, sticky='w', pady=5, padx=(10, 0))
        
        # Section Actions
        actions_frame = ttk.LabelFrame(main_frame, text="Actions", padding="10")
        actions_frame.pack(fill='x', pady=(0, 10))
        
        button_frame = ttk.Frame(actions_frame)
        button_frame.pack(fill='x')
        
        # Sync manuelle
        self.sync_btn = ttk.Button(
            button_frame,
            text="🔄 Synchroniser maintenant",
            command=self.manual_sync,
            style='Primary.TButton'
        )
        self.sync_btn.pack(side='left', padx=(0, 10))
        
        # Sync automatique
        self.auto_sync_btn = ttk.Button(
            button_frame,
            text="▶️ Démarrer sync automatique",
            command=self.toggle_auto_sync
        )
        self.auto_sync_btn.pack(side='left')
        
        # Section Logs
        log_frame = ttk.LabelFrame(main_frame, text="Journal d'activité", padding="10")
        log_frame.pack(fill='both', expand=True)
        
        self.log_text = scrolledtext.ScrolledText(
            log_frame,
            height=12,
            font=('Courier', 9),
            bg='#2c3e50',
            fg='#ecf0f1',
            insertbackground='white'
        )
        self.log_text.pack(fill='both', expand=True)
        
        # Pied de page
        footer_frame = tk.Frame(self.root, bg='#ecf0f1', height=30)
        footer_frame.pack(fill='x', side='bottom')
        footer_frame.pack_propagate(False)
        
        footer_label = tk.Label(
            footer_frame,
            text="Compatible: Pharmagest • LGPI • Winpharma • César • Alliadis • Cegid • Everest • Officine Partner",
            font=('Helvetica', 8),
            bg='#ecf0f1',
            fg='#7f8c8d'
        )
        footer_label.pack(pady=8)
        
    def load_config(self):
        """Charge la configuration existante"""
        if self.config.pharmacy_id:
            self.pharmacy_id_entry.insert(0, self.config.pharmacy_id)
        if self.config.api_key:
            self.api_key_entry.insert(0, self.config.api_key)
            
        self.log("✓ Configuration chargée")
        
    def save_config(self):
        """Sauvegarde la configuration"""
        pharmacy_id = self.pharmacy_id_entry.get().strip()
        api_key = self.api_key_entry.get().strip()
        
        if not pharmacy_id or not api_key:
            messagebox.showwarning(
                "Configuration incomplète",
                "Veuillez renseigner l'ID Pharmacie et la Clé API"
            )
            return
        
        self.config.pharmacy_id = pharmacy_id
        self.config.api_key = api_key
        self.config.save()
        
        self.log("✓ Configuration sauvegardée")
        messagebox.showinfo("Succès", "Configuration sauvegardée avec succès!")
        
    def detect_software(self):
        """Détecte le logiciel de pharmacie"""
        self.log("🔍 Détection du logiciel de pharmacie...")
        
        def detect():
            self.detected_software = self.detector.detect()
            
            if self.detected_software:
                software_name = self.detected_software['name']
                self.software_label.config(
                    text=f"✓ {software_name}",
                    style='Success.TLabel'
                )
                self.log(f"✓ {software_name} détecté!")
            else:
                self.software_label.config(
                    text="❌ Non détecté",
                    style='Error.TLabel'
                )
                self.log("❌ Aucun logiciel détecté")
                messagebox.showwarning(
                    "Détection échouée",
                    "Aucun logiciel de pharmacie détecté.\n"
                    "Vérifiez que votre logiciel est installé."
                )
        
        threading.Thread(target=detect, daemon=True).start()
        
    def manual_sync(self):
        """Synchronisation manuelle"""
        if not self.config.is_configured():
            messagebox.showwarning(
                "Configuration requise",
                "Veuillez configurer l'ID Pharmacie et la Clé API"
            )
            return
        
        if self.sync_running:
            messagebox.showinfo("Sync en cours", "Une synchronisation est déjà en cours")
            return
        
        self.sync_btn.config(state='disabled', text="⏳ Sync en cours...")
        
        def sync():
            self.sync_running = True
            try:
                # Détection si nécessaire
                if not self.detected_software:
                    self.log("🔍 Détection du logiciel...")
                    self.detected_software = self.detector.detect()
                    
                    if not self.detected_software:
                        self.log("❌ Aucun logiciel détecté")
                        messagebox.showerror(
                            "Erreur",
                            "Aucun logiciel de pharmacie détecté"
                        )
                        return
                
                # Lecture des produits
                self.log("📦 Lecture du catalogue...")
                products = self.reader.read_products(
                    self.detected_software['db_path']
                )
                
                if not products:
                    self.log("⚠️ Aucun produit trouvé")
                    messagebox.showwarning(
                        "Attention",
                        "Aucun produit trouvé dans la base de données"
                    )
                    return
                
                self.log(f"✓ {len(products)} produits trouvés")
                
                # Synchronisation
                self.log("☁️ Envoi vers Arthur...")
                api = ArthurAPI(self.config)
                result = api.sync_products(products)
                
                # Succès
                now = datetime.now()
                self.last_sync_label.config(
                    text=now.strftime("%d/%m/%Y à %H:%M:%S")
                )
                
                self.log("✓ Synchronisation réussie!")
                if result.get('results'):
                    res = result['results']
                    self.log(f"  • Créés: {res.get('created', 0)}")
                    self.log(f"  • Mis à jour: {res.get('updated', 0)}")
                
                messagebox.showinfo(
                    "Succès",
                    f"Synchronisation réussie!\n\n"
                    f"Produits synchronisés: {len(products)}"
                )
                
            except Exception as e:
                self.log(f"❌ Erreur: {str(e)}")
                messagebox.showerror(
                    "Erreur de synchronisation",
                    f"Une erreur est survenue:\n{str(e)}"
                )
            finally:
                self.sync_running = False
                self.sync_btn.config(state='normal', text="🔄 Synchroniser maintenant")
        
        threading.Thread(target=sync, daemon=True).start()
        
    def toggle_auto_sync(self):
        """Active/désactive la sync automatique"""
        if self.auto_sync_active:
            self.auto_sync_active = False
            self.auto_sync_btn.config(text="▶️ Démarrer sync automatique")
            self.log("⏸️ Synchronisation automatique arrêtée")
        else:
            if not self.config.is_configured():
                messagebox.showwarning(
                    "Configuration requise",
                    "Veuillez configurer l'ID Pharmacie et la Clé API"
                )
                return
            
            self.auto_sync_active = True
            self.auto_sync_btn.config(text="⏸️ Arrêter sync automatique")
            self.log("▶️ Synchronisation automatique démarrée (toutes les 15 min)")
            
            def auto_sync_loop():
                while self.auto_sync_active:
                    if not self.sync_running:
                        self.manual_sync()
                    time.sleep(15 * 60)  # 15 minutes
            
            threading.Thread(target=auto_sync_loop, daemon=True).start()
    
    def log(self, message: str):
        """Ajoute un message au journal"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert('end', f"[{timestamp}] {message}\n")
        self.log_text.see('end')
        self.root.update()
        
    def run(self):
        """Lance l'application"""
        self.log("=== Arthur Pharmacy Connector v1.0 ===")
        self.log("✓ Interface graphique démarrée")
        self.root.mainloop()


def main():
    """Point d'entrée principal"""
    app = ArthurConnectorGUI()
    app.run()


if __name__ == '__main__':
    main()
