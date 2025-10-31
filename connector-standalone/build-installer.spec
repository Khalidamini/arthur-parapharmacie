# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file pour Arthur Pharmacy Connector
Génère un exécutable standalone sans dépendances Python
"""

block_cipher = None

a = Analysis(
    ['arthur-connector-standalone.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'sqlite3',
        'json',
        'urllib.request',
        'urllib.error',
        'pathlib',
        'datetime',
        'platform',
        'logging',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='arthur-connector',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

# Configuration pour macOS
app = BUNDLE(
    exe,
    name='ArthurConnector.app',
    icon=None,
    bundle_identifier='com.arthur.pharmacyconnector',
    info_plist={
        'NSHighResolutionCapable': 'True',
        'CFBundleName': 'Arthur Connector',
        'CFBundleDisplayName': 'Arthur Pharmacy Connector',
        'CFBundleVersion': '1.0.0',
        'CFBundleShortVersionString': '1.0.0',
    },
)
