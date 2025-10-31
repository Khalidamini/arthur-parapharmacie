# Arthur Pharmacy Connector

Connecteur automatique pour synchroniser les produits depuis les logiciels de pharmacie vers Arthur.

## Fonctionnalités

- ✅ Détection automatique des logiciels (Pharmagest, LGPI, Winpharma)
- ✅ Synchronisation automatique toutes les 15 minutes
- ✅ Fonctionne en arrière-plan (system tray)
- ✅ Multi-plateforme (Windows, macOS, Linux)
- ✅ Mise à jour automatique
- ✅ Logs détaillés
- ✅ Remontée d'erreurs critiques

## Installation

### Prérequis

- Node.js 18+ et npm
- Les droits en lecture sur la base de données du logiciel de pharmacie

### Installation des dépendances

```bash
cd connector
npm install
```

### Compilation

```bash
npm run build
```

### Création des installeurs

```bash
# Pour toutes les plateformes
npm run package:all

# Ou spécifiquement pour chaque plateforme
npm run package  # Plateforme actuelle seulement
```

Les installeurs seront créés dans `connector/release/`

## Configuration

### Première utilisation

1. Lancer le connecteur
2. Cliquer sur l'icône dans la barre des tâches
3. Choisir "Configurer"
4. Entrer:
   - ID de la pharmacie (fourni par Arthur)
   - Clé API (fournie lors de l'inscription)

### Détection automatique

Le connecteur détecte automatiquement:
- L'emplacement du logiciel de pharmacie
- Le type de base de données
- Les tables et colonnes pertinentes

## Utilisation

### Menu

L'icône dans la barre des tâches permet de:
- Synchroniser manuellement
- Configurer
- Voir les logs
- Quitter

### Synchronisation automatique

Le connecteur synchronise automatiquement toutes les 15 minutes:
- Lecture des produits depuis la base locale
- Envoi sécurisé à Arthur
- Notification en cas de succès/erreur

## Développement

### Structure du projet

```
connector/
├── src/
│   ├── main.ts              # Point d'entrée Electron
│   ├── config/
│   │   └── ConfigManager.ts # Gestion de la configuration
│   ├── sync/
│   │   ├── SyncManager.ts   # Orchestration de la sync
│   │   ├── DatabaseDetector.ts # Détection des BD
│   │   ├── types.ts         # Types TypeScript
│   │   └── readers/         # Lecteurs par logiciel
│   │       ├── PharmagestReader.ts
│   │       ├── LGPIReader.ts
│   │       └── WinpharmaReader.ts
│   └── renderer/            # Interface utilisateur
├── package.json
├── tsconfig.json
└── README.md
```

### Ajouter un nouveau logiciel

1. Créer un nouveau reader dans `src/sync/readers/`
2. Implémenter l'interface de lecture
3. Ajouter la détection dans `DatabaseDetector.ts`
4. Ajouter le case dans `SyncManager.ts`

### Debug

```bash
npm start  # Lance en mode développement
```

Les logs sont disponibles:
- Windows: `%APPDATA%\arthur-pharmacy-connector\logs`
- macOS: `~/Library/Logs/arthur-pharmacy-connector`
- Linux: `~/.config/arthur-pharmacy-connector/logs`

## Sécurité

- ✅ Lecture seule sur les bases de données
- ✅ Clés API stockées localement et chiffrées
- ✅ Communication HTTPS uniquement
- ✅ Pas de modification des données locales
- ✅ Authentification requise pour toutes les API

## Support

Pour toute question ou problème:
- Email: support@arthur.app
- Documentation: https://docs.arthur.app/connecteur

## Licence

Propriétaire - Arthur © 2024
