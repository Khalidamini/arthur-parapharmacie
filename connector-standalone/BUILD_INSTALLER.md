# Construction des Installateurs Arthur Connector

Ce document explique comment compiler les installateurs automatiques pour Windows, macOS et Linux.

## Windows (.exe avec NSIS)

### Prérequis
- NSIS (Nullsoft Scriptable Install System) : https://nsis.sourceforge.io/Download
- Plugin NSISdl (inclus avec NSIS)
- Plugin nsisunz : https://nsis.sourceforge.io/Nsisunz_plug-in

### Construction
```bash
cd connector-standalone
makensis arthur-connector-installer.nsi
```

Cela créera `arthur-connector-setup.exe` qui :
- Télécharge Python Embedded 3.11.9 (64-bit)
- Configure pip automatiquement
- Installe requests et schedule
- Télécharge arthur-connector.py
- Configure le démarrage automatique
- Crée des raccourcis

### Upload vers Supabase
```bash
supabase storage upload connector-updates/arthur-connector-setup.exe arthur-connector-setup.exe --upsert
```

## macOS (.sh → .pkg ou .dmg)

### Le script shell
Le fichier `install-mac.sh` :
- Vérifie Python 3
- Crée un environnement virtuel
- Installe les dépendances
- Configure LaunchAgent pour démarrage auto

### Distribution

**Option 1 : Script shell direct**
```bash
chmod +x install-mac.sh
supabase storage upload connector-updates/install-mac.sh install-mac.sh --upsert
```

**Option 2 : Empaquetage en .pkg (recommandé)**
```bash
# Créer une structure de package
mkdir -p package-root/usr/local/bin
cp install-mac.sh package-root/usr/local/bin/arthur-connector-install

# Construire le .pkg
pkgbuild --root package-root \
         --identifier com.arthur.connector.installer \
         --version 1.0.0 \
         --install-location / \
         arthur-connector-installer.pkg

# Upload
supabase storage upload connector-updates/arthur-connector-installer.pkg arthur-connector-installer.pkg --upsert
```

## Linux (.sh)

### Le script shell
Le fichier `install-linux.sh` :
- Détecte et installe Python 3 si nécessaire (apt/yum/dnf)
- Crée un environnement virtuel
- Installe les dépendances
- Configure systemd user service pour démarrage auto

### Distribution
```bash
chmod +x install-linux.sh
supabase storage upload connector-updates/install-linux.sh install-linux.sh --upsert
```

## Automatisation avec GitHub Actions

Créer `.github/workflows/build-installers.yml` :

```yaml
name: Build Installers

on:
  push:
    branches: [main]
    paths:
      - 'connector-standalone/**'
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install NSIS
        run: |
          choco install nsis -y
          choco install nsis-nsisunz -y
      
      - name: Build Windows installer
        run: |
          cd connector-standalone
          makensis arthur-connector-installer.nsi
      
      - name: Upload to Supabase
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: gtjmebionytcomoldgjl
        run: |
          supabase storage upload connector-updates/arthur-connector-setup.exe connector-standalone/arthur-connector-setup.exe --upsert

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build macOS package
        run: |
          cd connector-standalone
          chmod +x install-mac.sh
          mkdir -p package-root/usr/local/bin
          cp install-mac.sh package-root/usr/local/bin/arthur-connector-install
          pkgbuild --root package-root \
                   --identifier com.arthur.connector.installer \
                   --version 1.0.0 \
                   --install-location / \
                   arthur-connector-installer.pkg
      
      - name: Upload to Supabase
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: gtjmebionytcomoldgjl
        run: |
          supabase storage upload connector-updates/arthur-connector-installer.pkg connector-standalone/arthur-connector-installer.pkg --upsert

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Prepare Linux script
        run: |
          cd connector-standalone
          chmod +x install-linux.sh
      
      - name: Upload to Supabase
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: gtjmebionytcomoldgjl
        run: |
          supabase storage upload connector-updates/install-linux.sh connector-standalone/install-linux.sh --upsert
```

## URLs de téléchargement finales

Une fois uploadés dans Supabase Storage :

- **Windows** : `https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector-setup.exe`
- **macOS** : `https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector-installer.pkg` ou `install-mac.sh`
- **Linux** : `https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-linux.sh`

## Test des installateurs

### Windows
1. Télécharger `arthur-connector-setup.exe`
2. Double-cliquer et suivre l'assistant
3. Vérifier que le connecteur apparaît dans le menu Démarrer et démarre au lancement

### macOS
```bash
curl -O https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-mac.sh
chmod +x install-mac.sh
./install-mac.sh
```

### Linux
```bash
curl -O https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/install-linux.sh
chmod +x install-linux.sh
./install-linux.sh
```
