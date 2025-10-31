# Instructions de compilation des installateurs Arthur Connector

## Prérequis
- Python 3.8+ installé
- PyInstaller: `pip install pyinstaller`

## Compilation Windows (.exe)

```bash
# Installer PyInstaller
pip install pyinstaller

# Compiler l'exécutable
pyinstaller build-installer.spec --clean

# L'exécutable se trouve dans dist/arthur-connector.exe
```

## Compilation macOS (.app / .dmg)

```bash
# Installer PyInstaller
pip3 install pyinstaller

# Compiler l'application
pyinstaller build-installer.spec --clean

# Créer un DMG
# Option 1: Utiliser create-dmg
brew install create-dmg
create-dmg \
  --volname "Arthur Connector" \
  --volicon "icon.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "ArthurConnector.app" 200 190 \
  --hide-extension "ArthurConnector.app" \
  --app-drop-link 600 185 \
  "ArthurConnector.dmg" \
  "dist/"

# Option 2: Manuellement avec Disk Utility
# - Ouvrir Disk Utility
# - File > New Image > Image from Folder
# - Sélectionner le dossier dist/
# - Enregistrer comme arthur-connector.dmg
```

## Compilation Linux (.AppImage)

```bash
# Installer pyinstaller et appimage-builder
pip3 install pyinstaller
sudo apt install appimage-builder

# Compiler l'exécutable
pyinstaller build-installer.spec --clean

# Créer l'AppImage
# Créer un fichier AppImageBuilder.yml (voir ci-dessous)
appimage-builder --recipe AppImageBuilder.yml

# L'AppImage se trouve dans arthur-connector-x86_64.AppImage
```

### AppImageBuilder.yml
```yaml
version: 1

AppDir:
  path: ./AppDir
  app_info:
    id: com.arthur.pharmacyconnector
    name: arthur-connector
    icon: arthur-connector
    version: 1.0.0
    exec: usr/bin/arthur-connector
    exec_args: $@

  apt:
    arch: amd64
    sources:
      - sourceline: 'deb http://archive.ubuntu.com/ubuntu/ focal main universe'

  files:
    include:
      - dist/arthur-connector

  runtime:
    env:
      APPDIR_LIBRARY_PATH: $APPDIR/usr/lib/x86_64-linux-gnu

AppImage:
  arch: x86_64
  comp: xz
```

## Upload vers Supabase Storage

Après compilation, uploadez les fichiers sur Supabase Storage:

```bash
# Via l'interface Supabase ou via CLI
supabase storage upload connector-updates arthur-connector.exe
supabase storage upload connector-updates arthur-connector.dmg
supabase storage upload connector-updates arthur-connector.AppImage
```

## Automatisation avec GitHub Actions

Pour automatiser la compilation, créez un fichier `.github/workflows/build-connectors.yml`:

```yaml
name: Build Connectors

on:
  push:
    paths:
      - 'connector-standalone/**'
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install pyinstaller
      - run: cd connector-standalone && pyinstaller build-installer.spec --clean
      - uses: actions/upload-artifact@v3
        with:
          name: arthur-connector-windows
          path: connector-standalone/dist/arthur-connector.exe

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip3 install pyinstaller
      - run: cd connector-standalone && pyinstaller build-installer.spec --clean
      - run: brew install create-dmg
      - run: |
          create-dmg \
            --volname "Arthur Connector" \
            --window-pos 200 120 \
            --window-size 800 400 \
            --icon-size 100 \
            "arthur-connector.dmg" \
            "connector-standalone/dist/"
      - uses: actions/upload-artifact@v3
        with:
          name: arthur-connector-macos
          path: arthur-connector.dmg

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip3 install pyinstaller
      - run: cd connector-standalone && pyinstaller build-installer.spec --clean
      - run: |
          wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
          chmod +x appimagetool-x86_64.AppImage
          mkdir -p AppDir/usr/bin
          cp connector-standalone/dist/arthur-connector AppDir/usr/bin/
          ./appimagetool-x86_64.AppImage AppDir arthur-connector-x86_64.AppImage
      - uses: actions/upload-artifact@v3
        with:
          name: arthur-connector-linux
          path: arthur-connector-x86_64.AppImage
```

## Notes importantes

1. **Signature de code**: Pour une distribution professionnelle:
   - Windows: Signer avec un certificat de signature de code
   - macOS: Notariser avec Apple Developer ID
   - Linux: Pas de signature requise

2. **Taille des fichiers**: Les exécutables PyInstaller sont volumineux (~30-50 MB) car ils incluent l'interpréteur Python

3. **Antivirus**: Certains antivirus peuvent bloquer les exécutables PyInstaller non signés

4. **Mise à jour**: Créer une nouvelle version nécessite de recompiler et d'uploader les nouveaux fichiers
