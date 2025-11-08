# 🦆 Quack Releases - Vercel Hosting

Questo è il progetto Vercel separato per hostare le release di Quack mantenendo il codice sorgente privato.

## 📦 Cosa Contiene

- **Landing Page**: `public/index.html` - Pagina di download per gli utenti
- **API Endpoint**: `api/latest.js` - Endpoint per auto-update Tauri
- **Downloads Folder**: `public/downloads/` - DMG/MSI/AppImage files

## 🚀 Deploy su Vercel

### Prima Volta - Setup Iniziale

1. **Crea nuovo progetto Vercel**
   ```bash
   cd vercel-releases
   vercel
   ```

2. **Configura il progetto**
   - Project Name: `quack-releases` (o quello che preferisci)
   - Framework: `Other`
   - Root Directory: `./`
   - Build Command: (lascia vuoto)
   - Output Directory: `public`

3. **Deploy**
   ```bash
   vercel --prod
   ```

Il tuo sito sarà disponibile su: `https://quack-releases.vercel.app`

---

## 📝 Workflow Completo

### Step 1: Build l'App Localmente

```bash
cd .. # Torna alla root di quack-app
npm run tauri:build
```

### Step 2: Copia i File Build

```bash
# macOS
cp src-tauri/target/release/bundle/dmg/Quack_*_aarch64.dmg vercel-releases/public/downloads/
cp src-tauri/target/release/bundle/dmg/Quack_*_x64.dmg vercel-releases/public/downloads/

# Windows (se buildi su Windows)
cp src-tauri/target/release/bundle/msi/Quack_*.msi vercel-releases/public/downloads/

# Linux (se buildi su Linux)
cp src-tauri/target/release/bundle/appimage/Quack_*.AppImage vercel-releases/public/downloads/
```

### Step 3: Aggiorna Versione nell'API

Modifica `api/latest.js` con la nuova versione

### Step 4: Deploy su Vercel

```bash
cd vercel-releases
vercel --prod
```

---

## 🤖 Automatizzare con GitHub Actions (Opzionale)

Posso creare un workflow che:
1. Builda l'app sul runner di GitHub (privato)
2. Carica i file su Vercel via CLI
3. Fa deploy automatico
4. Notifica Discord

Questo mantiene il codice privato ma automatizza le release!

---

## 🔗 Link per gli Utenti

Dopo il deploy, condividi:

**Landing Page:**
```
https://quack-releases.vercel.app
```

**Download Diretti:**
```
https://quack-releases.vercel.app/downloads/Quack_0.0.1_aarch64.dmg (Mac M1/M2/M3)
https://quack-releases.vercel.app/downloads/Quack_0.0.1_x64.dmg (Mac Intel)
https://quack-releases.vercel.app/downloads/Quack_0.0.1_x64.msi (Windows)
https://quack-releases.vercel.app/downloads/Quack_0.0.1_amd64.AppImage (Linux)
```

**Auto-Update Endpoint:**
```
https://quack-releases.vercel.app/api/latest
```

---

## ⚙️ Configurazione Tauri

Aggiorna `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://quack-releases.vercel.app/api/latest"
      ],
      "dialog": true,
      "pubkey": ""
    }
  }
}
```

---

🦆 **Quack quack!** Il tuo sistema di distribuzione privato è pronto!
