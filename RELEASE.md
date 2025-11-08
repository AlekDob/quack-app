# 🚀 Release System - Quack App

## 📋 Overview

Quack usa un sistema di release completamente automatico basato su GitHub Actions. Quando pushato al branch `production`, il sistema:

1. ✅ Bumpa automaticamente la versione (patch: 0.1.0 → 0.1.1)
2. 🏗️ Builda l'app per macOS, Windows e Linux
3. 📦 Crea una GitHub Release con i file DMG/MSI/AppImage
4. 🔔 Invia una notifica Discord
5. 🔄 Gli utenti esistenti ricevono notifica di aggiornamento nell'app

---

## 🌳 Branch Strategy

```
main (development)
  ├─ feature/* → Nuove funzionalità
  ├─ agent/* → Sviluppo agent
  └─ AlekDob/* → Esperimenti personali

production (releases)
  └─ Push qui → 🚀 Auto-deploy!
```

---

## 🎯 Come Fare una Release

### Prima Volta: Crea il Branch Production

```bash
npm run release:create-branch
```

### Release Standard

```bash
# 1. Assicurati di aver committato tutto su main
git add .
git commit -m "feat: nuova funzionalità"
git push origin main

# 2. Prepara la release (merge main → production)
npm run release:prepare

# 3. Controlla che tutto sia ok, poi pubblica
npm run release:publish
```

**BOOM! 🚀** GitHub Actions farà il resto automaticamente!

---

## 📊 Versioning Automatico

Il sistema usa **Semantic Versioning**:

- **Patch** (0.1.0 → 0.1.1): Bug fixes, piccole modifiche
- **Minor** (0.1.0 → 0.2.0): Nuove funzionalità
- **Major** (0.1.0 → 1.0.0): Breaking changes

Al momento il workflow bumpa automaticamente la versione `patch` ad ogni release.

---

## 🔔 Notifiche Discord

### Setup Discord Webhook

1. Vai sul tuo server Discord
2. **Server Settings** → **Integrations** → **Webhooks**
3. Clicca **"New Webhook"**
4. Dai un nome (es. "Quack Releases")
5. Scegli il canale dove vuoi le notifiche
6. **Copy Webhook URL**

### Aggiungi il Webhook a GitHub

1. Vai su GitHub: `https://github.com/alekdob/quack-app/settings/secrets/actions`
2. Clicca **"New repository secret"**
3. Nome: `DISCORD_WEBHOOK`
4. Valore: Incolla l'URL del webhook
5. Clicca **"Add secret"**

---

## 🔐 Setup Tauri Signing (Opzionale ma Consigliato)

Per firmare gli aggiornamenti e garantire sicurezza:

```bash
# Genera una chiave privata per la firma
cd src-tauri
cargo tauri signer generate -w ~/.tauri/myapp.key

# Salva la chiave pubblica in tauri.conf.json
# Salva la chiave privata come GitHub Secret: TAURI_PRIVATE_KEY
```

Aggiungi questi secrets su GitHub:
- `TAURI_PRIVATE_KEY`: La chiave privata generata
- `TAURI_KEY_PASSWORD`: La password della chiave (se ne hai usata una)

---

## 📦 Cosa Succede Durante una Release?

### GitHub Actions Workflow

1. **Checkout del codice** dal branch `production`
2. **Setup ambiente**: Node.js 22, Rust, dipendenze sistema
3. **Bump versione**: Incrementa automaticamente in `package.json` e `tauri.conf.json`
4. **Build multi-piattaforma**:
   - macOS: `.dmg` e `.app`
   - Windows: `.msi`
   - Linux: `.AppImage` e `.deb`
5. **Create GitHub Release**: Tag `v0.1.1` con changelog automatico
6. **Upload artifacts**: Carica tutti i file build
7. **Commit version bump**: Aggiorna i file di versione nel repo
8. **Discord notification**: Invia embed con link alla release

### Output

```
https://github.com/alekdob/quack-app/releases
├─ v0.1.1
│  ├─ Quack_0.1.1_aarch64.dmg (macOS Apple Silicon)
│  ├─ Quack_0.1.1_x64.dmg (macOS Intel)
│  ├─ Quack_0.1.1_x64.msi (Windows)
│  ├─ Quack_0.1.1_amd64.AppImage (Linux)
│  └─ latest.json (update manifest)
```

---

## 🔄 Auto-Update nell'App

Gli utenti che hanno installato Quack riceveranno automaticamente:

1. **Notifica popup** quando è disponibile un aggiornamento
2. **Download automatico** della nuova versione
3. **Prompt di installazione** al prossimo avvio

Il sistema controlla gli aggiornamenti:
- All'avvio dell'app
- Ogni 24 ore in background

---

## 🐛 Troubleshooting

### Il workflow fallisce?

Controlla i log su GitHub Actions:
```
https://github.com/alekdob/quack-app/actions
```

### Problemi comuni:

1. **Build fallisce**: Verifica che il codice compili localmente con `npm run tauri:build`
2. **Discord notifica non arriva**: Verifica che il secret `DISCORD_WEBHOOK` sia configurato
3. **Auto-update non funziona**: Verifica che `TAURI_PRIVATE_KEY` sia configurato

---

## 📚 Riferimenti

- [Tauri Auto-Updater](https://v2.tauri.app/plugin/updater/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)

---

🦆 **Quack quack!** Sistema di release pronto all'uso!

_Generated with Claude Code_
