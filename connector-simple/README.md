# Arthur Connector - Version Python Simple

Version légère et portable du connecteur Arthur pour pharmacies.

## Avantages

✅ Aucune installation lourde  
✅ Fonctionne sur Windows, Mac, Linux  
✅ Synchronisation automatique toutes les 15 minutes  
✅ Détection automatique du logiciel de pharmacie  
✅ Léger et rapide  

## Installation

### 1. Installer Python

- **Windows**: Télécharger depuis [python.org](https://www.python.org/downloads/)
- **Mac**: Déjà installé ou `brew install python3`
- **Linux**: `sudo apt install python3 python3-pip`

### 2. Installer les dépendances

```bash
pip install -r requirements.txt
```

## Configuration

### Première utilisation

```bash
python arthur-connector.py --configure
```

Entrer:
- ID de votre pharmacie
- Clé API

## Utilisation

### Mode automatique (recommandé)

```bash
python arthur-connector.py --daemon
```

Le connecteur:
- Synchronise immédiatement
- Puis toutes les 15 minutes automatiquement
- Tourne en arrière-plan

### Synchronisation unique

```bash
python arthur-connector.py --sync
```

### Reconfiguration

```bash
python arthur-connector.py --configure
```

## Démarrage automatique

### Windows

Créer un fichier `arthur-connector.bat`:

```batch
@echo off
python "C:\chemin\vers\arthur-connector.py" --daemon
```

Ajouter ce fichier au démarrage Windows:
- Win + R → `shell:startup`
- Copier le fichier .bat

### Mac

Créer `~/Library/LaunchAgents/com.arthur.connector.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.arthur.connector</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/chemin/vers/arthur-connector.py</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Puis:
```bash
launchctl load ~/Library/LaunchAgents/com.arthur.connector.plist
```

### Linux

Créer `/etc/systemd/system/arthur-connector.service`:

```ini
[Unit]
Description=Arthur Pharmacy Connector
After=network.target

[Service]
Type=simple
User=pharmacie
ExecStart=/usr/bin/python3 /chemin/vers/arthur-connector.py --daemon
Restart=always

[Install]
WantedBy=multi-user.target
```

Puis:
```bash
sudo systemctl enable arthur-connector
sudo systemctl start arthur-connector
```

## Logs

Les logs sont disponibles dans `arthur-connector.log`

## Dépannage

### "Aucun logiciel détecté"

Le connecteur cherche automatiquement dans:
- Windows: `C:\Program Files\Pharmagest`, `C:\LGPI`, etc.
- Mac: `/Applications/Pharmagest`, etc.
- Linux: `/opt/pharmagest`, etc.

Si votre logiciel est ailleurs, modifiez les chemins dans le script.

### "Erreur de connexion"

Vérifiez:
- Connexion internet
- ID pharmacie et clé API corrects
- Firewall autorisant Python

## Support

Email: support@arthur.app
