#!/bin/bash
# Arthur Connector - Installateur Linux automatique

set -e

APP_NAME="Arthur Connector"
INSTALL_DIR="$HOME/.local/share/arthur-connector"
CONNECTOR_URL="https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.py"

echo "==================================="
echo "Installation d'Arthur Connector"
echo "==================================="

# Vérifier Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 n'est pas installé."
    echo "Installation de Python 3..."
    
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv
    elif command -v yum &> /dev/null; then
        sudo yum install -y python3 python3-pip
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y python3 python3-pip
    else
        echo "Gestionnaire de paquets non supporté. Installez Python 3 manuellement."
        exit 1
    fi
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
cat > "$INSTALL_DIR/arthur-connector.sh" << 'EOF'
#!/bin/bash
cd "$HOME/.local/share/arthur-connector"
source venv/bin/activate
python arthur-connector.py "$@"
EOF

chmod +x "$INSTALL_DIR/arthur-connector.sh"

# Créer le service systemd
SERVICE_FILE="$HOME/.config/systemd/user/arthur-connector.service"
mkdir -p "$HOME/.config/systemd/user"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Arthur Connector - Synchronisation Pharmacie
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/arthur-connector.py
Restart=always
RestartSec=10
StandardOutput=append:$INSTALL_DIR/connector.log
StandardError=append:$INSTALL_DIR/connector-error.log

[Install]
WantedBy=default.target
EOF

# Activer et démarrer le service
systemctl --user daemon-reload
systemctl --user enable arthur-connector.service
systemctl --user start arthur-connector.service

# Créer un lanceur d'application desktop
DESKTOP_FILE="$HOME/.local/share/applications/arthur-connector.desktop"
mkdir -p "$HOME/.local/share/applications"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Type=Application
Name=Arthur Connector
Comment=Connecteur de synchronisation pour pharmacie
Exec=$INSTALL_DIR/arthur-connector.sh
Terminal=true
Categories=Utility;
EOF

echo ""
echo "✅ Installation terminée !"
echo ""
echo "Le connecteur Arthur est maintenant installé et démarrera automatiquement."
echo "Emplacement : $INSTALL_DIR"
echo ""
echo "Commandes utiles :"
echo "  Statut    : systemctl --user status arthur-connector"
echo "  Arrêter   : systemctl --user stop arthur-connector"
echo "  Redémarrer: systemctl --user restart arthur-connector"
echo "  Logs      : journalctl --user -u arthur-connector -f"
echo ""
