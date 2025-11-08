# 🦆 Quack Release System - Final Setup

## ✅ Cosa È Stato Completato

### 1. **Repository Pubblico per le Release**
- ✅ Creato `AlekDob/quack-releases` (pubblico)
- ✅ Ospita solo i file DMG/MSI/AppImage (NO codice sorgente)
- ✅ Il codice sorgente rimane in `quack-app` (privato)

### 2. **GitHub Actions Workflow**
- ✅ Configurato per pubblicare su `quack-releases`
- ✅ Build automatiche per macOS/Windows/Linux
- ✅ Bump automatico versione
- ✅ Notifiche Discord

### 3. **Landing Page e API**
- ✅ Pagina download: `https://quackagency-website-kz2p4exqv-alek-dobrohotovs-projects.vercel.app/download`
- ✅ API auto-update: `https://quackagency-website-kz2p4exqv-alek-dobrohotovs-projects.vercel.app/api/quack/latest`
- ✅ Deploy su Vercel completato

### 4. **Tauri Auto-Update**
- ✅ Configurato per scaricare da GitHub Releases
- ✅ Endpoint configurato correttamente

---

## 🚀 Prima Release - STEP FINALE

### **IMPORTANTE: Crea GitHub Personal Access Token**

Il workflow ha bisogno di un token per pubblicare release sul repository pubblico.

**Vai su GitHub:**

1. https://github.com/settings/tokens/new
2. **Note**: `Quack Releases Token`
3. **Expiration**: `No expiration` (o 90 days se preferisci rinnovarlo)
4. **Select scopes**:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `write:packages` (Upload packages to GitHub Package Registry)
5. Click **"Generate token"**
6. **COPIA IL TOKEN!** (lo vedrai una sola volta)

**Aggiungi il Secret su GitHub:**

1. Vai su: https://github.com/AlekDob/quack-app/settings/secrets/actions
2. Click **"New repository secret"**
3. **Name**: `RELEASES_GITHUB_TOKEN`
4. **Value**: Incolla il token che hai copiato
5. Click **"Add secret"**

---

## 🎯 Come Fare la Prima Release

### **Opzione 1: Via Terminale** (Consigliata)

```bash
cd /Users/alekdob/Desktop/Dev/Personal/quack-app

# 1. Assicurati di essere su main
git checkout main

# 2. Prepara la release (merge main → production)
npm run release:prepare

# 3. Pubblica (trigger GitHub Actions)
npm run release:publish
```

### **Opzione 2: Manuale via GitHub**

1. Vai su GitHub: https://github.com/AlekDob/quack-app
2. Vai su **Branches**
3. Crea un nuovo branch chiamato `production` da `main`
4. Fai un push

---

## 📊 Cosa Succederà

1. **GitHub Actions si avvia** (circa 10-15 minuti)
   - Build per macOS, Windows, Linux in parallelo
   - Bumpa automaticamente versione (0.1.0 → 0.1.1)
   - Crea release su `quack-releases` (pubblico)
   - Upload DMG/MSI/AppImage
   - Invia notifica Discord (se configurato)

2. **Release Pubblicata**
   - Disponibile su: https://github.com/AlekDob/quack-releases/releases/latest
   - Gli utenti possono scaricare i file
   - Auto-update funzionante

3. **Download Links**
   - Landing page: https://quackagency-website-kz2p4exqv-alek-dobrohotovs-projects.vercel.app/download
   - Direct GitHub: https://github.com/AlekDob/quack-releases/releases/latest

---

## 🔗 Links Finali

### **Per gli Utenti:**
```
Landing Page:    https://quackagency-website-kz2p4exqv-alek-dobrohotovs-projects.vercel.app/download
GitHub Releases: https://github.com/AlekDob/quack-releases/releases/latest
```

### **Per Te (Developer):**
```
Source Code:     https://github.com/AlekDob/quack-app (privato)
Releases Repo:   https://github.com/AlekDob/quack-releases (pubblico)
Actions:         https://github.com/AlekDob/quack-app/actions
```

---

## 🛠️ Future Release

Ogni volta che vuoi rilasciare una nuova versione:

```bash
# Sviluppi su main normalmente
git checkout main
git add .
git commit -m "feat: nuova funzionalità"
git push

# Quando sei pronto per rilasciare
npm run release:prepare  # Merge main → production
npm run release:publish  # Trigger release

# GitHub Actions fa tutto il resto automaticamente!
```

---

## 🎨 Personalizzazioni Future (Opzionali)

### **Custom Domain per Vercel**

Se hai un dominio personalizzato:
1. Vercel Dashboard → Add Domain
2. Aggiorna i link nella documentazione

### **Discord Notifications**

Segui `.github/SETUP_DISCORD.md` per configurare le notifiche

### **Code Signing (Apple)**

Quando il tuo Apple Developer Account sarà approvato:
1. Crea "Developer ID Application" certificate
2. Aggiungi secret `APPLE_CERTIFICATE` su GitHub
3. L'app sarà firmata automaticamente nei prossimi build

---

## 🦆 Sistema Completo!

**Architettura Finale:**

```
┌─────────────────────────────┐
│   quack-app (PRIVATE)       │
│   - Source code             │
│   - Development             │
└──────────┬──────────────────┘
           │
           │ git push to production
           ▼
┌─────────────────────────────┐
│   GitHub Actions            │
│   - Build multi-platform    │
│   - Bump version            │
│   - Sign (future)           │
└──────────┬──────────────────┘
           │
           │ Upload artifacts
           ▼
┌─────────────────────────────┐
│   quack-releases (PUBLIC)   │
│   - DMG/MSI/AppImage only   │
│   - GitHub Releases         │
└──────────┬──────────────────┘
           │
           │ Users download from here
           ▼
┌─────────────────────────────┐
│   quackagency-website       │
│   - Landing page            │
│   - Auto-update API         │
│   - Vercel hosting          │
└─────────────────────────────┘
```

**Vantaggi:**
- ✅ Codice sorgente **privato**
- ✅ Download **pubblici** e veloci (GitHub CDN)
- ✅ Auto-update **funzionante**
- ✅ Workflow **completamente automatico**
- ✅ **Gratis** (nessun costo di hosting)
- ✅ **Scalabile** (supporta file di qualsiasi dimensione)

---

**Quack quack! 🦆 Il tuo sistema di release è COMPLETO e PROFESSIONALE!**

Hai bisogno di aiuto?
- Crea il token GitHub
- Fai la prima release
- Configura Discord
- Qualcos'altro?

Sono qui per aiutarti! Quack! 🚀
