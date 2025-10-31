import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Scripts d'installation
    const scripts = {
      'install-windows.ps1': `# Arthur Connector - Installateur Windows automatique
# Ce script télécharge Python Embedded et configure le connecteur automatiquement

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Installation d'Arthur Connector" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$INSTALL_DIR = "$env:LOCALAPPDATA\\ArthurConnector"
$PYTHON_VERSION = "3.11.9"
$PYTHON_URL = "https://www.python.org/ftp/python/$PYTHON_VERSION/python-$PYTHON_VERSION-embed-amd64.zip"
$CONNECTOR_URL = "https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.py"

# Créer le répertoire d'installation
Write-Host "Creation du repertoire d'installation..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
Set-Location $INSTALL_DIR

# Télécharger Python Embedded
Write-Host "Telechargement de Python Embedded ($PYTHON_VERSION)..." -ForegroundColor Yellow
$pythonZip = "$INSTALL_DIR\\python-embedded.zip"
try {
    Invoke-WebRequest -Uri $PYTHON_URL -OutFile $pythonZip -UseBasicParsing
    Write-Host "Python telecharge avec succes" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors du telechargement de Python: $_" -ForegroundColor Red
    Write-Host "Verifiez votre connexion Internet et reessayez." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# Extraire Python
Write-Host "Extraction de Python..." -ForegroundColor Yellow
$pythonDir = "$INSTALL_DIR\\python"
New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null
Expand-Archive -Path $pythonZip -DestinationPath $pythonDir -Force
Remove-Item $pythonZip

# Activer les imports standards dans Python
Write-Host "Configuration de Python..." -ForegroundColor Yellow
$pthFile = "$pythonDir\\python311._pth"
Add-Content -Path $pthFile -Value "\`nimport site"

# Télécharger et installer pip
Write-Host "Installation de pip..." -ForegroundColor Yellow
$getPip = "$pythonDir\\get-pip.py"
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip -UseBasicParsing
& "$pythonDir\\python.exe" $getPip --no-warn-script-location
Remove-Item $getPip

# Installer les dépendances
Write-Host "Installation des dependances (requests, schedule)..." -ForegroundColor Yellow
& "$pythonDir\\python.exe" -m pip install --no-warn-script-location requests schedule

# Télécharger le connecteur Arthur
Write-Host "Telechargement du connecteur Arthur..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $CONNECTOR_URL -OutFile "$INSTALL_DIR\\arthur-connector.py" -UseBasicParsing
    Write-Host "Connecteur telecharge avec succes" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors du telechargement du connecteur: $_" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# Créer le script de lancement
Write-Host "Creation du lanceur..." -ForegroundColor Yellow
$launcherBat = @"
@echo off
cd /d "%~dp0"
python\\python.exe arthur-connector.py %*
"@
Set-Content -Path "$INSTALL_DIR\\arthur-connector.bat" -Value $launcherBat

# Créer le lanceur invisible (pour le démarrage automatique)
$launcherVbs = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "$INSTALL_DIR\\arthur-connector.bat" & chr(34), 0
Set WshShell = Nothing
"@
Set-Content -Path "$INSTALL_DIR\\arthur-connector-silent.vbs" -Value $launcherVbs

# Créer le raccourci sur le bureau
Write-Host "Creation des raccourcis..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\Arthur Connector.lnk")
$Shortcut.TargetPath = "$INSTALL_DIR\\arthur-connector.bat"
$Shortcut.WorkingDirectory = $INSTALL_DIR
$Shortcut.IconLocation = "$pythonDir\\python.exe,0"
$Shortcut.Description = "Arthur Connector - Synchronisation Pharmacie"
$Shortcut.Save()

# Créer le raccourci dans le menu Démarrer
$startMenuPath = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"
$Shortcut = $WshShell.CreateShortcut("$startMenuPath\\Arthur Connector.lnk")
$Shortcut.TargetPath = "$INSTALL_DIR\\arthur-connector.bat"
$Shortcut.WorkingDirectory = $INSTALL_DIR
$Shortcut.IconLocation = "$pythonDir\\python.exe,0"
$Shortcut.Description = "Arthur Connector - Synchronisation Pharmacie"
$Shortcut.Save()

# Configurer le démarrage automatique
Write-Host "Configuration du demarrage automatique..." -ForegroundColor Yellow
$startupPath = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
$Shortcut = $WshShell.CreateShortcut("$startupPath\\Arthur Connector.lnk")
$Shortcut.TargetPath = "$INSTALL_DIR\\arthur-connector-silent.vbs"
$Shortcut.WorkingDirectory = $INSTALL_DIR
$Shortcut.Description = "Arthur Connector - Synchronisation Pharmacie (Demarrage automatique)"
$Shortcut.Save()

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Installation terminee avec succes !" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Le connecteur Arthur est maintenant installe et demarrera automatiquement avec Windows." -ForegroundColor White
Write-Host ""
Write-Host "Emplacement : $INSTALL_DIR" -ForegroundColor White
Write-Host ""
Write-Host "Pour lancer manuellement : Double-cliquez sur le raccourci 'Arthur Connector' sur le bureau" -ForegroundColor White
Write-Host ""
Write-Host "Le connecteur va demarrer dans quelques secondes..." -ForegroundColor Yellow

# Lancer le connecteur
Start-Sleep -Seconds 3
Start-Process -FilePath "$INSTALL_DIR\\arthur-connector-silent.vbs"

Write-Host ""
Write-Host "Connecteur lance ! Il fonctionne maintenant en arriere-plan." -ForegroundColor Green
Write-Host ""
Read-Host "Appuyez sur Entree pour fermer cette fenetre"
`,
      'install-mac.sh': `#!/bin/bash
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
        echo ""`,

        'install-mac.command': `#!/bin/bash
# Arthur Connector - Installateur macOS automatique (double-clic)

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

# Ouvrir le lanceur automatiquement
open "$INSTALL_DIR/arthur-connector.command" 2>/dev/null || true

echo ""
echo "✅ Installation terminée !"
echo ""
echo "Le connecteur Arthur est maintenant installé et démarrera automatiquement."
echo "Emplacement : $INSTALL_DIR"
echo ""
echo "Pour le lancer manuellement : $INSTALL_DIR/arthur-connector.command"
echo "Pour le désinstaller : launchctl unload $PLIST_PATH && rm -rf '$INSTALL_DIR'"
echo ""`,

        'install-linux.sh': `#!/bin/bash
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
echo ""`
    };

    // Uploader chaque script
    const results = [];
    for (const [filename, content] of Object.entries(scripts)) {
      const { error } = await supabase.storage
        .from('connector-updates')
        .upload(filename, new Blob([content], { type: 'text/plain' }), {
          upsert: true,
          contentType: 'text/x-shellscript'
        });

      if (error) {
        console.error(`Error uploading ${filename}:`, error);
        results.push({ filename, success: false, error: error.message });
      } else {
        console.log(`Successfully uploaded ${filename}`);
        results.push({ filename, success: true });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Scripts uploaded successfully',
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
