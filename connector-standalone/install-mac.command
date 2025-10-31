#!/bin/bash
# Arthur Connector - Installateur macOS automatique

set -e

APP_NAME="Arthur Connector"
INSTALL_DIR="$HOME/Library/Application Support/ArthurConnector"
CONNECTOR_URL="https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.py"

echo "==================================="
echo "Installation d'Arthur Connector"
echo "==================================="

# Vérifier Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 n'est pas installé."
    echo "Veuillez installer Python 3 depuis https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Python $PYTHON_VERSION détecté"

# Créer le répertoire d'installation
echo "Création du répertoire d'installation..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Créer l'environnement virtuel
echo "Création de l'environnement virtuel..."
python3 -m venv venv

# Activer l'environnement virtuel
source venv/bin/activate

# Installer les dépendances
echo "Installation des dépendances..."
pip install --upgrade pip > /dev/null 2>&1
pip install requests schedule > /dev/null 2>&1

# Télécharger le connecteur
echo "Téléchargement du connecteur Arthur..."
curl -L -o arthur-connector.py "$CONNECTOR_URL"

# Créer le script de lancement
cat > arthur-connector.command << 'EOF'
#!/bin/bash
cd "$HOME/Library/Application Support/ArthurConnector"
source venv/bin/activate
python arthur-connector.py "$@"
EOF

chmod +x arthur-connector.command

# Créer le plist pour LaunchAgent
PLIST_PATH="$HOME/Library/LaunchAgents/com.arthur.connector.plist"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.arthur.connector</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/venv/bin/python</string>
        <string>$INSTALL_DIR/arthur-connector.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/connector.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/connector-error.log</string>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
</dict>
</plist>
EOF

# Charger le LaunchAgent
launchctl load "$PLIST_PATH" 2>/dev/null || true

echo ""
echo "✅ Installation terminée !"
echo ""
echo "Le connecteur Arthur est maintenant installé et démarrera automatiquement."
echo "Emplacement : $INSTALL_DIR"
echo ""
echo "Pour le lancer manuellement : $INSTALL_DIR/arthur-connector.command"
echo "Pour le désinstaller : launchctl unload $PLIST_PATH && rm -rf '$INSTALL_DIR'"
echo ""
