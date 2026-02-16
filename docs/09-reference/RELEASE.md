# Release System - Quack App

## Overview

Quack uses a fully automated release system based on GitHub Actions. When pushed to the `production` branch, the system:

1. Automatically bumps the version (patch: 0.1.0 -> 0.1.1)
2. Builds the app for macOS, Windows, and Linux
3. Creates a GitHub Release with DMG/MSI/AppImage files
4. Sends a Discord notification
5. Existing users receive an in-app update notification

---

## Branch Strategy

```
main (development)
  ├─ feature/* → New features
  ├─ agent/* → Agent development
  └─ AlekDob/* → Personal experiments

production (releases)
  └─ Push here → Auto-deploy!
```

---

## How to Create a Release

### First Time: Create the Production Branch

```bash
npm run release:create-branch
```

### Standard Release

```bash
# 1. Make sure everything is committed on main
git add .
git commit -m "feat: new feature"
git push origin main

# 2. Prepare the release (merge main → production)
npm run release:prepare

# 3. Verify everything is OK, then publish
npm run release:publish
```

GitHub Actions takes care of the rest automatically.

---

## Automatic Versioning

The system uses **Semantic Versioning**:

- **Patch** (0.1.0 → 0.1.1): Bug fixes, small changes
- **Minor** (0.1.0 → 0.2.0): New features
- **Major** (0.1.0 → 1.0.0): Breaking changes

Currently, the workflow automatically bumps the `patch` version on each release.

---

## Discord Notifications

### Discord Webhook Setup

1. Go to your Discord server
2. **Server Settings** → **Integrations** → **Webhooks**
3. Click **"New Webhook"**
4. Give it a name (e.g., "Quack Releases")
5. Choose the channel for notifications
6. **Copy Webhook URL**

### Add the Webhook to GitHub

1. Go to GitHub: `https://github.com/alekdob/quack-app/settings/secrets/actions`
2. Click **"New repository secret"**
3. Name: `DISCORD_WEBHOOK`
4. Value: Paste the webhook URL
5. Click **"Add secret"**

---

## Tauri Signing Setup (Optional but Recommended)

To sign updates and ensure security:

```bash
# Generate a private key for signing
cd src-tauri
cargo tauri signer generate -w ~/.tauri/myapp.key

# Save the public key in tauri.conf.json
# Save the private key as a GitHub Secret: TAURI_PRIVATE_KEY
```

Add these secrets on GitHub:
- `TAURI_PRIVATE_KEY`: The generated private key
- `TAURI_KEY_PASSWORD`: The key password (if you set one)

---

## What Happens During a Release?

### GitHub Actions Workflow

1. **Checkout code** from the `production` branch
2. **Setup environment**: Node.js 22, Rust, system dependencies
3. **Bump version**: Automatically increments in `package.json` and `tauri.conf.json`
4. **Multi-platform build**:
   - macOS: `.dmg` and `.app`
   - Windows: `.msi`
   - Linux: `.deb`
5. **Create GitHub Release**: Tag `v0.1.1` with automatic changelog
6. **Upload artifacts**: Upload all build files
7. **Commit version bump**: Update version files in the repo
8. **Discord notification**: Send embed with release link

### Output

```
https://github.com/alekdob/quack-app/releases
├─ v0.1.1
│  ├─ Quack_0.1.1_aarch64.dmg (macOS Apple Silicon)
│  ├─ Quack_0.1.1_x64.dmg (macOS Intel)
│  ├─ Quack_0.1.1_x64.msi (Windows)
│  ├─ Quack_0.1.1_amd64.deb (Linux)
│  └─ latest.json (update manifest)
```

---

## Auto-Update in the App

Users who have installed Quack will automatically receive:

1. **Popup notification** when an update is available
2. **Automatic download** of the new version
3. **Installation prompt** on next launch

The system checks for updates:
- On app startup
- Every 24 hours in the background

---

## Troubleshooting

### Workflow fails?

Check the logs on GitHub Actions:
```
https://github.com/alekdob/quack-app/actions
```

### Common issues:

1. **Build fails**: Verify the code compiles locally with `npm run build:mac` (or `build:win`, `build:linux`)
2. **Discord notification not received**: Verify the `DISCORD_WEBHOOK` secret is configured
3. **Auto-update not working**: Verify `TAURI_PRIVATE_KEY` is configured

---

## References

- [Tauri Auto-Updater](https://v2.tauri.app/plugin/updater/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
