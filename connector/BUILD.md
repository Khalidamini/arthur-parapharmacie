# Guide de compilation du connecteur Arthur

## Prérequis

- Node.js 18+ installé
- npm ou yarn
- Accès à un Mac pour compiler la version macOS (ou utiliser GitHub Actions)

## Compilation locale

### 1. Installation des dépendances

```bash
cd connector
npm install
```

### 2. Compilation pour toutes les plateformes

```bash
npm run package:all
```

Cela créera les installeurs dans `connector/release/` :
- `arthur-connector-setup.exe` (Windows)
- `arthur-connector.dmg` (macOS)
- `arthur-connector.AppImage` (Linux)

### 3. Compilation pour une plateforme spécifique

```bash
# Windows uniquement
npm run build && npx electron-builder --win

# macOS uniquement  
npm run build && npx electron-builder --mac

# Linux uniquement
npm run build && npx electron-builder --linux
```

## Upload vers Supabase Storage

Une fois les binaires compilés :

1. Aller dans le dashboard Supabase : Cloud → Files
2. Ouvrir le bucket `connector-updates`
3. Uploader les 3 fichiers depuis `connector/release/`

## Automatisation avec GitHub Actions

Pour automatiser la compilation et le déploiement, créer `.github/workflows/build-connector.yml` :

```yaml
name: Build Connector

on:
  push:
    paths:
      - 'connector/**'
    branches:
      - main

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        working-directory: connector
        run: npm install
      
      - name: Build
        working-directory: connector
        run: npm run build
      
      - name: Package
        working-directory: connector
        run: npm run package
      
      - name: Upload to Supabase
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          # Script pour uploader vers Supabase Storage
          # À implémenter selon vos besoins
```

## Notes importantes

- **macOS** : La compilation pour Mac nécessite un Mac ou un CI/CD macOS
- **Code signing** : Pour distribuer officiellement, il faut signer les applications
- **Notarization** : macOS nécessite la notarisation Apple pour éviter les warnings
- **Updates** : Les mises à jour automatiques fonctionneront dès que les fichiers sont dans le bucket

## Version de développement

Pour tester localement sans compiler :

```bash
cd connector
npm start
```
