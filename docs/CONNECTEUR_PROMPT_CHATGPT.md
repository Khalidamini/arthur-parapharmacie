# Prompt pour ChatGPT : Création du Connecteur Arthur

## CONTEXTE DU PROJET

Je développe **Arthur**, une plateforme de parapharmacie en ligne qui permet aux patients de commander des produits directement depuis les pharmacies partenaires. Les pharmacies utilisent différents logiciels de gestion (Pharmagest, LGPI, Winpharma) pour gérer leur inventaire.

**Problème actuel** : Les pharmacies doivent synchroniser manuellement leurs produits avec la plateforme Arthur. Je veux créer un **connecteur desktop automatique** qui fait ce travail à leur place.

---

## OBJECTIF DU CONNECTEUR

Créer une application desktop Windows/Mac appelée **"Arthur Connecteur"** qui :
1. S'installe facilement (installeur en 1 clic)
2. Détecte automatiquement le logiciel de pharmacie installé
3. Se connecte à l'API Arthur avec les identifiants du pharmacien
4. Synchronise automatiquement les produits toutes les heures
5. Tourne en arrière-plan sans intervention humaine
6. Est ultra-simple d'utilisation (aucune compétence technique requise)

---

## SPÉCIFICATIONS TECHNIQUES

### Technologies recommandées
- **Electron** (pour créer une app desktop multi-plateforme)
- **Node.js** (pour le backend de l'app)
- **React** (pour l'interface utilisateur)
- **SQLite** (pour stocker les configs localement de manière sécurisée)

### Logiciels de pharmacie à supporter
Le connecteur doit se connecter à ces 3 logiciels :

1. **Pharmagest X**
   - Chemin d'installation typique : `C:\Program Files\Pharmagest\`
   - Base de données : SQL Server ou Access selon la version
   
2. **LGPI**
   - Chemin d'installation typique : `C:\LGPI\`
   - Base de données : SQL Server
   
3. **Winpharma**
   - Chemin d'installation typique : `C:\Winpharma\`
   - Base de données : Firebird ou MySQL

### API Arthur (Backend)
L'API est hébergée sur Supabase. Voici les endpoints disponibles :

**Base URL** : `https://gtjmebionytcomoldgjl.supabase.co`

**Headers requis** :
```
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0am1lYmlvbnl0Y29tb2xkZ2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NzE1NDYsImV4cCI6MjA3NjA0NzU0Nn0.TT33bEn025Lwn2CN9C-2cVE3ZwnbOt66rNMm784lR1M
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Endpoint d'authentification** :
```
POST /auth/v1/token?grant_type=password
Body: {
  "email": "pharmacien@email.com",
  "password": "mot_de_passe"
}
Response: {
  "access_token": "JWT_TOKEN",
  "refresh_token": "REFRESH_TOKEN",
  "expires_in": 3600
}
```

**Endpoint de synchronisation des produits** :
```
POST /functions/v1/sync-pharmacy-products
Headers: Authorization: Bearer <JWT_TOKEN>
Body: {
  "pharmacy_id": "uuid-de-la-pharmacie",
  "products": [
    {
      "external_id": "CODE_PRODUIT",
      "name": "Nom du produit",
      "brand": "Marque",
      "price": 15.99,
      "stock_quantity": 50,
      "category": "Soins du visage",
      "is_available": true
    }
  ]
}
```

---

## ARCHITECTURE DU CONNECTEUR

### 1. Interface utilisateur (Electron + React)

#### Écran 1 : Assistant d'installation (Wizard)
```
┌─────────────────────────────────────────┐
│     🎯 Bienvenue sur Arthur Connecteur  │
│                                         │
│  Étape 1/4 : Connexion à Arthur        │
│                                         │
│  Email :    [________________]          │
│  Mot de passe : [________________]      │
│                                         │
│        [Suivant]      [Annuler]        │
└─────────────────────────────────────────┘
```

#### Écran 2 : Détection du logiciel
```
┌─────────────────────────────────────────┐
│  Étape 2/4 : Détection automatique      │
│                                         │
│  🔍 Recherche en cours...               │
│                                         │
│  ✓ Pharmagest X détecté !              │
│    C:\Program Files\Pharmagest\         │
│                                         │
│        [Suivant]      [Retour]         │
└─────────────────────────────────────────┘
```

#### Écran 3 : Configuration de la connexion
```
┌─────────────────────────────────────────┐
│  Étape 3/4 : Configuration             │
│                                         │
│  Logiciel : Pharmagest X               │
│  Base de données : SQL Server          │
│                                         │
│  Serveur BD : [localhost]              │
│  Utilisateur BD : [admin]              │
│  Mot de passe BD : [********]          │
│                                         │
│        [Tester]  [Suivant]  [Retour]   │
└─────────────────────────────────────────┘
```

#### Écran 4 : Test et finalisation
```
┌─────────────────────────────────────────┐
│  Étape 4/4 : Test de connexion         │
│                                         │
│  ✓ Connexion à Pharmagest réussie      │
│  ✓ Connexion à Arthur réussie          │
│  ✓ 1247 produits détectés              │
│                                         │
│  Première synchronisation :             │
│  ○ Maintenant                          │
│  ○ Dans 1 heure                        │
│                                         │
│        [Terminer]      [Retour]        │
└─────────────────────────────────────────┘
```

#### Écran principal (après installation)
```
┌─────────────────────────────────────────┐
│  Arthur Connecteur - Actif 🟢          │
│                                         │
│  Pharmacie : Pharmacie du Centre       │
│  Logiciel : Pharmagest X               │
│                                         │
│  📊 Dernière synchronisation            │
│     Aujourd'hui à 15:42                │
│     1247 produits synchronisés         │
│     ✓ Aucune erreur                    │
│                                         │
│  ⏰ Prochaine synchronisation           │
│     Aujourd'hui à 16:42                │
│                                         │
│  [Synchroniser maintenant]             │
│  [Paramètres]  [Logs]  [Aide]         │
└─────────────────────────────────────────┘
```

### 2. Logique de détection automatique

```javascript
// Pseudo-code
async function detectPharmacySoftware() {
  const possiblePaths = {
    pharmagest: [
      'C:\\Program Files\\Pharmagest\\',
      'C:\\Program Files (x86)\\Pharmagest\\',
      'C:\\Pharmagest\\'
    ],
    lgpi: [
      'C:\\LGPI\\',
      'C:\\Program Files\\LGPI\\'
    ],
    winpharma: [
      'C:\\Winpharma\\',
      'C:\\Program Files\\Winpharma\\'
    ]
  };

  for (const [software, paths] of Object.entries(possiblePaths)) {
    for (const path of paths) {
      if (await fs.exists(path)) {
        return {
          software: software,
          path: path,
          database: await detectDatabase(path)
        };
      }
    }
  }
  
  return null;
}
```

### 3. Module de connexion aux bases de données

Pour chaque logiciel, créer un adaptateur qui :
- Se connecte à la BD du logiciel
- Extrait les données produits
- Normalise le format

```javascript
// Exemple pour Pharmagest
class PharmagesAdapter {
  async connect(config) {
    // Connexion SQL Server ou Access
  }
  
  async getProducts() {
    const query = `
      SELECT 
        CODE_PRODUIT as external_id,
        NOM as name,
        MARQUE as brand,
        PRIX_TTC as price,
        STOCK as stock_quantity,
        CATEGORIE as category,
        ACTIF as is_available
      FROM PRODUITS
      WHERE ACTIF = 1
    `;
    
    return await this.executeQuery(query);
  }
}
```

### 4. Module de synchronisation

```javascript
class SyncManager {
  constructor(pharmacyId, authToken) {
    this.pharmacyId = pharmacyId;
    this.authToken = authToken;
    this.apiUrl = 'https://gtjmebionytcomoldgjl.supabase.co';
  }
  
  async syncProducts(products) {
    // Envoyer par batch de 100 produits
    const batches = chunkArray(products, 100);
    
    for (const batch of batches) {
      await fetch(`${this.apiUrl}/functions/v1/sync-pharmacy-products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'apikey': 'YOUR_SUPABASE_ANON_KEY',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pharmacy_id: this.pharmacyId,
          products: batch
        })
      });
    }
  }
  
  async startAutoSync(intervalHours = 1) {
    setInterval(async () => {
      await this.performSync();
    }, intervalHours * 60 * 60 * 1000);
  }
}
```

---

## FONCTIONNALITÉS REQUISES

### ✅ Obligatoires
1. **Installation en 1 clic** - Installeur Windows (.exe) et Mac (.dmg)
2. **Détection automatique** du logiciel de pharmacie
3. **Assistant de configuration** visuel et guidé
4. **Authentification** avec l'API Arthur
5. **Synchronisation automatique** toutes les heures
6. **Service en arrière-plan** (tourne même si l'app est fermée)
7. **Notifications** desktop lors des synchronisations
8. **Logs détaillés** pour le débogage
9. **Mise à jour automatique** de l'app

### 🔒 Sécurité
- Chiffrement des identifiants en local (utiliser `electron-store` avec encryption)
- Connexion sécurisée aux bases de données
- Gestion des tokens JWT (refresh automatique)
- Validation des données avant envoi

### 🎨 Interface utilisateur
- Design moderne et épuré
- Icône dans la barre des tâches (system tray)
- Messages d'erreur clairs et solutions proposées
- Barre de progression pendant la synchronisation

---

## GESTION DES ERREURS

Le connecteur doit gérer intelligemment ces situations :

1. **Logiciel de pharmacie non détecté**
   → Proposer une sélection manuelle du dossier

2. **Erreur de connexion à la BD**
   → Afficher un message clair + lien vers la documentation

3. **Erreur API Arthur**
   → Retenter 3 fois avec backoff exponentiel
   → Notifier l'utilisateur si échec persistant

4. **Token expiré**
   → Refresh automatique du token
   → Re-authentification si nécessaire

5. **Produits en doublon**
   → Mettre à jour l'existant plutôt que créer

---

## LIVRABLES ATTENDUS

1. **Code source complet** (GitHub repo)
   - Structure Electron + React
   - Adaptateurs pour les 3 logiciels
   - Tests unitaires

2. **Installeurs**
   - `arthur-connecteur-setup.exe` (Windows)
   - `arthur-connecteur.dmg` (macOS)

3. **Documentation**
   - README.md avec instructions de build
   - Guide d'installation pour les pharmaciens
   - Documentation technique des adaptateurs

4. **Scripts de build**
   - Script pour créer les installeurs
   - Configuration pour auto-update

---

## CONTRAINTES

- **Taille de l'installeur** : < 100 MB
- **RAM utilisée** : < 150 MB
- **Compatible** : Windows 10/11, macOS 12+
- **Aucune compétence technique** requise de l'utilisateur
- **Installation silencieuse** possible (pour déploiement à distance)

---

## EXEMPLE DE FLUX UTILISATEUR

1. Le pharmacien télécharge `arthur-connecteur-setup.exe`
2. Double-clic → L'installeur lance l'assistant
3. Écran 1 : Il entre son email/password Arthur → Clic "Suivant"
4. Écran 2 : "✓ Pharmagest détecté automatiquement" → Clic "Suivant"
5. Écran 3 : Configuration pré-remplie → Clic "Tester" → ✓ Test OK → Clic "Suivant"
6. Écran 4 : "1247 produits détectés" → Sélection "Maintenant" → Clic "Terminer"
7. Synchronisation en cours... → Notification "✓ Synchronisation terminée !"
8. L'app se minimise dans la barre des tâches
9. Toutes les heures, synchronisation automatique en arrière-plan

---

## QUESTIONS POUR CLARIFICATION

Avant de commencer, peux-tu me confirmer :

1. **Bases de données** : As-tu accès aux schémas exacts des BD de Pharmagest/LGPI/Winpharma ? Sinon, faut-il les retrouver en reverse engineering ?

2. **Authentification BD** : Les pharmacies ont-elles des accès administrateur à leurs BDs ou faut-il que le connecteur puisse fonctionner avec des droits limités ?

3. **Auto-update** : Veux-tu un système d'auto-update intégré (comme Electron-updater) ou un simple message "nouvelle version disponible" ?

4. **Logs** : Où doivent être envoyés les logs d'erreur ? Sur Arthur ou uniquement en local ?

5. **Multi-pharmacies** : Une pharmacie peut-elle gérer plusieurs comptes Arthur (pharmacies multiples) ?

---

## COMMENCE PAR

**Étape 1** : Créer la structure de base Electron + React
**Étape 2** : Implémenter l'assistant de configuration (wizard)
**Étape 3** : Créer le module de détection automatique
**Étape 4** : Développer l'adaptateur Pharmagest (le plus utilisé)
**Étape 5** : Intégrer l'API Arthur
**Étape 6** : Ajouter la synchronisation automatique
**Étape 7** : Créer les installeurs

Procède étape par étape et montre-moi le code au fur et à mesure.
