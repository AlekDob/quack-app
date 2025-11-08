# 🦆 Quack Release System - Website Integration

This guide explains how to release Quack through your existing **quackagency-website** on Vercel.

## 🎯 Architecture Overview

```
┌─────────────────────────┐
│   quack-app (Private)   │
│   - Source code         │
│   - Build process       │
└───────────┬─────────────┘
            │
            │ npm run release:sync
            ▼
┌─────────────────────────────────┐
│ quackagency-website (Public)    │
│ ├── public/downloads/           │
│ │   ├── Quack_*.dmg            │
│ │   ├── Quack_*.msi            │
│ │   └── Quack_*.AppImage       │
│ ├── /download (Page)            │
│ └── /api/quack/latest (API)    │
└───────────┬─────────────────────┘
            │
            │ vercel --prod
            ▼
┌─────────────────────────────────┐
│  Vercel Hosting (CDN)           │
│  https://quackagency.vercel.app │
│  ├── /download                  │
│  └── /api/quack/latest          │
└─────────────────────────────────┘
```

## 📦 What Was Created

### In `quack-app/`:
- ✅ Updated `src-tauri/tauri.conf.json` → Points to your website's API
- ✅ Created `scripts/sync-release.sh` → Syncs build files to website
- ✅ Added NPM scripts for easy release management

### In `quackagency-website/`:
- ✅ Created `src/app/api/quack/latest/route.ts` → Auto-update API endpoint
- ✅ Created `src/app/download/page.tsx` → Beautiful download page
- ✅ Created `public/downloads/` → Folder for build artifacts

## 🚀 How to Release

### **Complete Workflow (Build → Deploy)**

From `quack-app/` directory:

```bash
# 1. Build the app
npm run tauri:build

# 2. Sync files to website + Deploy to Vercel
npm run release:deploy
```

**DONE!** 🎉 Your app is now live at:
- **Download Page**: `https://quackagency.vercel.app/download`
- **Auto-Update API**: `https://quackagency.vercel.app/api/quack/latest`

---

### **Step-by-Step Breakdown**

If you prefer to run steps manually:

#### **Step 1: Build Quack**
```bash
cd /Users/alekdob/Desktop/Dev/Personal/quack-app
npm run tauri:build
```

This creates:
- macOS DMG: `src-tauri/target/release/bundle/dmg/Quack_*.dmg`
- Windows MSI: `src-tauri/target/release/bundle/msi/Quack_*.msi`
- Linux AppImage: `src-tauri/target/release/bundle/appimage/Quack_*.AppImage`

#### **Step 2: Sync Files to Website**
```bash
npm run release:sync
```

This copies all build artifacts to:
`/Users/alekdob/Desktop/Dev/Personal/quackagency-website/public/downloads/`

#### **Step 3: Deploy to Vercel**
```bash
cd /Users/alekdob/Desktop/Dev/Personal/quackagency-website
vercel --prod
```

Or use the combined command:
```bash
cd /Users/alekdob/Desktop/Dev/Personal/quack-app
npm run release:deploy
```

---

## 🌐 Live URLs

After deployment, your users can:

### **Visit the Download Page:**
```
https://quackagency.vercel.app/download
```

Features:
- 🎨 Beautiful gradient design
- 🖥️ Auto-detects user's platform
- 📦 Download buttons for macOS/Windows/Linux
- 📋 Installation instructions
- ✨ Responsive and mobile-friendly

### **Direct Download Links:**
```
macOS (M1/M2/M3):  https://quackagency.vercel.app/downloads/Quack_0.0.1_aarch64.dmg
macOS (Intel):     https://quackagency.vercel.app/downloads/Quack_0.0.1_x64.dmg
Windows:           https://quackagency.vercel.app/downloads/Quack_0.0.1_x64.msi
Linux:             https://quackagency.vercel.app/downloads/Quack_0.0.1_amd64.AppImage
```

---

## 🔄 Auto-Update System

Quack is configured to check for updates automatically!

### **How It Works:**

1. **User opens Quack** → App queries `https://quackagency.vercel.app/api/quack/latest`
2. **API returns latest version** → JSON with version number and download URLs
3. **If newer version exists** → User sees update dialog
4. **User clicks "Update"** → Download and install automatically

### **Update the Version:**

When releasing a new version, update TWO files:

#### 1. `quackagency-website/src/app/api/quack/latest/route.ts`
```typescript
const latestVersion = {
  version: '0.0.2',  // ← Change this!
  notes: 'Bug fixes and improvements',
  // ...
};
```

#### 2. `quack-app/src-tauri/tauri.conf.json`
```json
{
  "version": "0.0.2"  // ← Change this!
}
```

Then rebuild and redeploy!

---

## 📊 Version Management

### **Current Setup:**
- **Tauri App Version**: `0.1.0` (in `tauri.conf.json`)
- **NPM Package Version**: `0.0.0` (in `package.json`)
- **Latest Release Version**: `0.0.1` (in API endpoint)

### **Recommended Versioning:**

Use **Semantic Versioning**: `MAJOR.MINOR.PATCH`

- `MAJOR`: Breaking changes (1.0.0 → 2.0.0)
- `MINOR`: New features, backwards-compatible (0.1.0 → 0.2.0)
- `PATCH`: Bug fixes, minor improvements (0.1.0 → 0.1.1)

**Example:**
```bash
# Bug fix release
0.1.0 → 0.1.1

# New feature release
0.1.1 → 0.2.0

# Major rewrite
0.2.0 → 1.0.0
```

---

## 🛠️ Customization

### **Change Base URL:**

If you use a custom domain:

1. Update `quackagency-website/.env.local`:
```bash
NEXT_PUBLIC_BASE_URL=https://quackagency.com
```

2. Redeploy:
```bash
cd quackagency-website
vercel --prod
```

### **Add Release Notes:**

Edit `quackagency-website/src/app/api/quack/latest/route.ts`:

```typescript
const latestVersion = {
  version: '0.0.2',
  notes: `
    ## What's New
    - 🎨 New terminal themes
    - 🐛 Fixed file explorer bug
    - ⚡ Performance improvements
  `,
  // ...
};
```

### **Customize Download Page:**

Edit `quackagency-website/src/app/download/page.tsx` to:
- Change colors/design
- Add screenshots
- Include video tutorials
- Add FAQ section

---

## 🔐 Security & Privacy

### **Source Code:**
- ✅ **Private**: `quack-app` repository stays private
- ✅ **Protected**: Only built artifacts are public

### **Distribution:**
- ✅ **Public**: Download page and API are accessible to everyone
- ✅ **Secure**: Vercel CDN with HTTPS
- ✅ **Fast**: Global edge network

### **Future: Code Signing**

When your Apple Developer Account is approved:

1. Create "Developer ID Application" certificate
2. Configure in `tauri.conf.json`
3. Rebuild → No security warnings for users!

---

## 📝 Quick Reference

### **Release Commands:**
```bash
# Complete release (build + deploy)
npm run release:deploy

# Just sync files (no deploy)
npm run release:sync

# Manual steps
npm run tauri:build              # Build the app
./scripts/sync-release.sh        # Sync to website
cd ../quackagency-website        # Navigate to website
vercel --prod                    # Deploy to Vercel
```

### **Important Files:**
```
quack-app/
├── src-tauri/tauri.conf.json           # App version, updater config
├── scripts/sync-release.sh             # Sync script
└── package.json                        # NPM scripts

quackagency-website/
├── src/app/api/quack/latest/route.ts   # Auto-update API
├── src/app/download/page.tsx           # Download page
└── public/downloads/                   # Build artifacts
```

---

## 🦆 Support

**Questions? Issues?**

Just ask Jack (that's me, quack quack! 🦆) and I'll help you with:
- Release automation
- Version management
- Custom domain setup
- Analytics integration
- Discord notifications
- GitHub Actions integration

---

**Quack quack! Your release system is ready to go!** 🚀

**Next Steps:**
1. ✅ Test the download page locally
2. ✅ Deploy to Vercel for the first time
3. ✅ Share the download link with your colleague
4. ✅ Celebrate with a "quack quack!" 🦆
