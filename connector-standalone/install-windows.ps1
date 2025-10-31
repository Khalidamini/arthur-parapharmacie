# Arthur Connector - Installateur Windows automatique
# Ce script télécharge Python Embedded et configure le connecteur automatiquement

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Installation d'Arthur Connector" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$INSTALL_DIR = "$env:LOCALAPPDATA\ArthurConnector"
$PYTHON_VERSION = "3.11.9"
$PYTHON_URL = "https://www.python.org/ftp/python/$PYTHON_VERSION/python-$PYTHON_VERSION-embed-amd64.zip"
$CONNECTOR_URL = "https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.py"

# Créer le répertoire d'installation
Write-Host "Creation du repertoire d'installation..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
Set-Location $INSTALL_DIR

# Télécharger Python Embedded
Write-Host "Telechargement de Python Embedded ($PYTHON_VERSION)..." -ForegroundColor Yellow
$pythonZip = "$INSTALL_DIR\python-embedded.zip"
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
$pythonDir = "$INSTALL_DIR\python"
New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null
Expand-Archive -Path $pythonZip -DestinationPath $pythonDir -Force
Remove-Item $pythonZip

# Activer les imports standards dans Python
Write-Host "Configuration de Python..." -ForegroundColor Yellow
$pthFile = "$pythonDir\python311._pth"
Add-Content -Path $pthFile -Value "`nimport site"

# Télécharger et installer pip
Write-Host "Installation de pip..." -ForegroundColor Yellow
$getPip = "$pythonDir\get-pip.py"
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip -UseBasicParsing
& "$pythonDir\python.exe" $getPip --no-warn-script-location
Remove-Item $getPip

# Installer les dépendances
Write-Host "Installation des dependances (requests, schedule)..." -ForegroundColor Yellow
& "$pythonDir\python.exe" -m pip install --no-warn-script-location requests schedule

# Télécharger le connecteur Arthur
Write-Host "Telechargement du connecteur Arthur..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $CONNECTOR_URL -OutFile "$INSTALL_DIR\arthur-connector.py" -UseBasicParsing
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
python\python.exe arthur-connector.py %*
"@
Set-Content -Path "$INSTALL_DIR\arthur-connector.bat" -Value $launcherBat

# Créer le lanceur invisible (pour le démarrage automatique)
$launcherVbs = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "$INSTALL_DIR\arthur-connector.bat" & chr(34), 0
Set WshShell = Nothing
"@
Set-Content -Path "$INSTALL_DIR\arthur-connector-silent.vbs" -Value $launcherVbs

# Créer le raccourci sur le bureau
Write-Host "Creation des raccourcis..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Arthur Connector.lnk")
$Shortcut.TargetPath = "$INSTALL_DIR\arthur-connector.bat"
$Shortcut.WorkingDirectory = $INSTALL_DIR
$Shortcut.IconLocation = "$pythonDir\python.exe,0"
$Shortcut.Description = "Arthur Connector - Synchronisation Pharmacie"
$Shortcut.Save()

# Créer le raccourci dans le menu Démarrer
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$Shortcut = $WshShell.CreateShortcut("$startMenuPath\Arthur Connector.lnk")
$Shortcut.TargetPath = "$INSTALL_DIR\arthur-connector.bat"
$Shortcut.WorkingDirectory = $INSTALL_DIR
$Shortcut.IconLocation = "$pythonDir\python.exe,0"
$Shortcut.Description = "Arthur Connector - Synchronisation Pharmacie"
$Shortcut.Save()

# Configurer le démarrage automatique
Write-Host "Configuration du demarrage automatique..." -ForegroundColor Yellow
$startupPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$Shortcut = $WshShell.CreateShortcut("$startupPath\Arthur Connector.lnk")
$Shortcut.TargetPath = "$INSTALL_DIR\arthur-connector-silent.vbs"
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
Start-Process -FilePath "$INSTALL_DIR\arthur-connector-silent.vbs"

Write-Host ""
Write-Host "Connecteur lance ! Il fonctionne maintenant en arriere-plan." -ForegroundColor Green
Write-Host ""
Read-Host "Appuyez sur Entree pour fermer cette fenetre"
