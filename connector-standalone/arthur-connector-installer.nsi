; Arthur Connector - Installateur Windows automatique
; Télécharge Python Embedded et configure automatiquement l'environnement

!define APP_NAME "Arthur Connector"
!define APP_VERSION "1.0.0"
!define PUBLISHER "Arthur"
!define PYTHON_VERSION "3.11.9"
!define PYTHON_URL "https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip"
!define CONNECTOR_URL "https://gtjmebionytcomoldgjl.supabase.co/storage/v1/object/public/connector-updates/arthur-connector.py"

!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "${APP_NAME}"
OutFile "arthur-connector-setup.exe"
InstallDir "$LOCALAPPDATA\ArthurConnector"
RequestExecutionLevel user

!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\arthur-connector.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer Arthur Connector"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "French"

Section "Installation" SecMain
    SetOutPath "$INSTDIR"
    
    DetailPrint "Téléchargement de Python Embedded..."
    NSISdl::download /TIMEOUT=30000 "${PYTHON_URL}" "$TEMP\python-embedded.zip"
    Pop $R0
    ${If} $R0 != "success"
        MessageBox MB_OK "Échec du téléchargement de Python. Vérifiez votre connexion Internet."
        Abort
    ${EndIf}
    
    DetailPrint "Extraction de Python..."
    CreateDirectory "$INSTDIR\python"
    nsisunz::Unzip "$TEMP\python-embedded.zip" "$INSTDIR\python"
    Delete "$TEMP\python-embedded.zip"
    
    DetailPrint "Configuration de Python..."
    ; Activer les imports standards
    FileOpen $0 "$INSTDIR\python\python311._pth" a
    FileSeek $0 0 END
    FileWrite $0 "$\r$\nimport site$\r$\n"
    FileClose $0
    
    DetailPrint "Installation de pip..."
    NSISdl::download /TIMEOUT=30000 "https://bootstrap.pypa.io/get-pip.py" "$INSTDIR\python\get-pip.py"
    ExecWait '"$INSTDIR\python\python.exe" "$INSTDIR\python\get-pip.py" --no-warn-script-location'
    Delete "$INSTDIR\python\get-pip.py"
    
    DetailPrint "Installation des dépendances..."
    ExecWait '"$INSTDIR\python\python.exe" -m pip install --no-warn-script-location requests schedule'
    
    DetailPrint "Téléchargement du connecteur..."
    NSISdl::download /TIMEOUT=30000 "${CONNECTOR_URL}" "$INSTDIR\arthur-connector.py"
    Pop $R0
    ${If} $R0 != "success"
        MessageBox MB_OK "Échec du téléchargement du connecteur."
        Abort
    ${EndIf}
    
    DetailPrint "Création du lanceur..."
    FileOpen $0 "$INSTDIR\arthur-connector.bat" w
    FileWrite $0 '@echo off$\r$\n'
    FileWrite $0 'cd /d "%~dp0"$\r$\n'
    FileWrite $0 'python\python.exe arthur-connector.py %*$\r$\n'
    FileClose $0
    
    DetailPrint "Création du raccourci..."
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\arthur-connector.bat" "" "$INSTDIR\python\python.exe"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\Désinstaller.lnk" "$INSTDIR\uninstall.exe"
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\arthur-connector.bat" "" "$INSTDIR\python\python.exe"
    
    DetailPrint "Configuration du démarrage automatique..."
    CreateShortCut "$SMSTARTUP\${APP_NAME}.lnk" "$INSTDIR\arthur-connector.bat" "" "$INSTDIR\python\python.exe"
    
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "${PUBLISHER}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
    
    MessageBox MB_OK "Installation terminée ! Le connecteur démarrera automatiquement avec Windows."
SectionEnd

Section "Uninstall"
    Delete "$INSTDIR\arthur-connector.py"
    Delete "$INSTDIR\arthur-connector.bat"
    Delete "$INSTDIR\uninstall.exe"
    RMDir /r "$INSTDIR\python"
    RMDir "$INSTDIR"
    
    Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Désinstaller.lnk"
    RMDir "$SMPROGRAMS\${APP_NAME}"
    Delete "$DESKTOP\${APP_NAME}.lnk"
    Delete "$SMSTARTUP\${APP_NAME}.lnk"
    
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
SectionEnd
