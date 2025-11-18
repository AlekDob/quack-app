# Avatar Images Loading Fix

## 🦆 Problem Description

Avatar images for agents/terminals were not loading in production builds of the Quack app, even though they worked perfectly in development mode.

**Symptoms:**
- ✅ Avatars visible in development mode (`npm run tauri:dev`)
- ❌ Avatars show placeholder icons (❓) in production build
- The images exist in the bundle but at a different path

## 🔍 Root Cause Analysis

The issue was caused by **different resource path resolution** between development and production:

1. **Development Mode:**
   - Images referenced as `/images/ducks/avatars/filename.png`
   - Works because the `images/` folder is at the project root
   - The dev server serves these files directly

2. **Production Mode:**
   - Tauri bundles the `images/` folder as a resource
   - The path becomes `_up_/images/ducks/avatars/filename.png`
   - Frontend code was still using `/images/...` which doesn't exist
   - Need to use Tauri's `resolveResource` + `convertFileSrc` APIs

## ✅ Solution Applied

### Step 1: Create Helper Function

Added a helper function that resolves avatar URLs for both dev and production:

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

async function getAvatarUrl(avatarName: string): Promise<string> {
  try {
    // Try to resolve as a resource (production build)
    const resourcePath = await resolveResource(`images/ducks/avatars/${avatarName}`);
    return convertFileSrc(resourcePath);
  } catch {
    // Fallback to public path (dev mode)
    return `/images/ducks/avatars/${avatarName}`;
  }
}
```

**How it works:**
- **Production**: Uses `resolveResource()` to get the actual file path in the bundle, then `convertFileSrc()` to convert it to a valid URL
- **Development**: Falls back to the standard `/images/...` path that works with the dev server
- **Async**: Returns a Promise since resource resolution is asynchronous

### Step 2: Update NewTerminalModal.tsx

**File:** `src/components/NewTerminalModal.tsx`

**Changes:**

1. **Added imports** (lines 1-3):
```typescript
import { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';
```

2. **Added state to cache avatar URLs** (line 78):
```typescript
const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
```

3. **Added effect to load URLs when modal opens** (lines 81-92):
```typescript
useEffect(() => {
  if (open) {
    const loadAvatarUrls = async () => {
      const urls: Record<string, string> = {};
      for (const avatarName of AVAILABLE_AVATARS) {
        urls[avatarName] = await getAvatarUrl(avatarName);
      }
      setAvatarUrls(urls);
    };
    loadAvatarUrls();
  }
}, [open]);
```

4. **Updated image src** (line 136):
```typescript
<img
  src={avatarUrls[avatarName] || `/images/ducks/avatars/${avatarName}`}
  alt={avatarName}
  // ...
/>
```

5. **Added 3 new avatars to the list** (lines 5-10):
```typescript
const AVAILABLE_AVATARS = [
  // ... existing avatars
  '5c275f841f212073cbddbe734d1979a6c2f17ab8.png',  // NEW
  'ab7cadc881ab08dcc27d8a8a1f3cb3e8af002216.png',  // NEW
  'd305287d5c861601e285b34ec5a8c7835ae9f8ea.png',  // NEW
]
```

### Step 3: Update TerminalActivityBar.tsx

**File:** `src/components/TerminalActivityBar.tsx`

**Changes:**

1. **Added imports** (lines 2-3):
```typescript
import { convertFileSrc } from '@tauri-apps/api/core'
import { resolveResource } from '@tauri-apps/api/path'
```

2. **Added helper function** (lines 6-16):
```typescript
async function getAvatarUrl(avatarName: string): Promise<string> {
  try {
    const resourcePath = await resolveResource(`images/ducks/avatars/${avatarName}`)
    return convertFileSrc(resourcePath)
  } catch {
    return `/images/ducks/avatars/${avatarName}`
  }
}
```

3. **Added state for avatar URL** (line 42):
```typescript
const [avatarUrl, setAvatarUrl] = useState<string>('')
```

4. **Added effect to load avatar URL** (lines 44-49):
```typescript
useEffect(() => {
  if (terminal.avatar) {
    getAvatarUrl(terminal.avatar).then(setAvatarUrl)
  }
}, [terminal.avatar])
```

5. **Updated image src** (line 117):
```typescript
<img
  src={avatarUrl || `/images/ducks/avatars/${terminal.avatar}`}
  alt={terminal.label}
  // ...
/>
```

## 📋 How the Fix Works

### Resource Path Resolution Flow

```
Development Mode:
  /images/ducks/avatars/avatar.png
  └─> Served directly by Vite dev server
  └─> Works immediately ✅

Production Mode:
  Request: /images/ducks/avatars/avatar.png
  └─> resolveResource("images/ducks/avatars/avatar.png")
      └─> Returns: /path/to/Quack.app/Contents/Resources/_up_/images/ducks/avatars/avatar.png
      └─> convertFileSrc(path)
          └─> Returns: asset://localhost/[hash]/avatar.png
          └─> Tauri serves the file ✅
```

### Caching Strategy

1. **NewTerminalModal**: Loads all 15 avatar URLs when the modal opens
   - Efficient: Only loads once per modal open
   - All avatars ready immediately
   - No flashing/loading delays

2. **TerminalActivityBar**: Loads avatar URL when terminal avatar changes
   - Minimal overhead: Only loads the selected avatar
   - Updates automatically when avatar changes

## 🔧 Files Modified

1. `src/components/NewTerminalModal.tsx`
   - Added helper function for avatar URL resolution
   - Added state and effect to pre-load avatar URLs
   - Updated image src to use resolved URLs
   - Added 3 new avatars to the list

2. `src/components/TerminalActivityBar.tsx`
   - Added helper function for avatar URL resolution
   - Added state and effect to load avatar URL
   - Updated image src to use resolved URL

## 🧪 Testing the Fix

### Verify Development Mode Still Works
```bash
npm run tauri:dev
```
- Click "New" to create agent
- Check that all 15 avatars are visible
- Select an avatar and confirm it shows in activity bar ✅

### Verify Production Build Works
```bash
npm run tauri:build
open src-tauri/target/release/bundle/macos/Quack.app
```
- Click "New" to create agent
- Check that all 15 avatars are visible (including 3 new ones)
- Select an avatar and confirm it shows in activity bar ✅

### Debug Production Issues (if they occur)

1. **Check if images are bundled:**
```bash
find src-tauri/target/release/bundle/macos/Quack.app -name "avatars" -type d
ls -la [path-to-avatars-folder]
```
Should show all 15 avatar images.

2. **Check console for errors:**
Open Quack.app and check the console for:
- Failed to resolve resource errors
- 404 errors for images
- React errors related to image loading

3. **Verify Tauri configuration:**
Check `src-tauri/tauri.conf.json`:
```json
"bundle": {
  "resources": [
    "../images",
    "node-sdk"
  ]
}
```
The `../images` path should be present.

## 🚨 If the Problem Recurs

### Common Causes

1. **Images not bundled**:
   - Check `tauri.conf.json` has `"../images"` in resources
   - Verify images exist in `/Users/alekdob/Desktop/Dev/Personal/quack-app/images/ducks/avatars/`
   - Rebuild: `npm run tauri:build`

2. **Tauri API imports missing**:
   - Ensure `@tauri-apps/api` is installed
   - Check imports: `convertFileSrc`, `resolveResource`

3. **New avatars not showing**:
   - Add avatar filename to `AVAILABLE_AVATARS` array in `NewTerminalModal.tsx`
   - Make sure the file exists in `images/ducks/avatars/`
   - Rebuild the app

### Quick Fix Steps

1. **Add a new avatar:**
```bash
# 1. Copy image to avatars folder
cp new-avatar.png images/ducks/avatars/

# 2. Add to AVAILABLE_AVATARS list in NewTerminalModal.tsx
# 3. Rebuild
npm run tauri:build
```

2. **Debug avatar loading:**
```typescript
// Add console.log in getAvatarUrl helper:
async function getAvatarUrl(avatarName: string): Promise<string> {
  try {
    const resourcePath = await resolveResource(`images/ducks/avatars/${avatarName}`);
    console.log('Resolved avatar path:', resourcePath);
    return convertFileSrc(resourcePath);
  } catch (error) {
    console.error('Failed to resolve avatar:', avatarName, error);
    return `/images/ducks/avatars/${avatarName}`;
  }
}
```

## 📝 Current Avatar List

The app now includes **15 avatars**:

1. `24d6c816fe40a284f2451b1469c5e6d63d236e53.png`
2. `5a1b030fb3b46f153f9b4f786a56570d828d2d2f.png`
3. `5c275f841f212073cbddbe734d1979a6c2f17ab8.png` ⭐ NEW
4. `5ef21f43a917b3bbe86dad58669fdad1c9f3e7c1.png`
5. `68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg`
6. `94ab4eb6a469bf7f9de538e5c2f3dc3f2637fddf.jpeg`
7. `9e56d5e5edfcef59ce2aba2b96130dad44ce1135.png`
8. `ab7cadc881ab08dcc27d8a8a1f3cb3e8af002216.png` ⭐ NEW
9. `bafc4d0ca4264fb26f014f27c641d860ff356f7a.png`
10. `c036fd117629d44e78464dd12d95760f0f0b3d9b.png`
11. `d305287d5c861601e285b34ec5a8c7835ae9f8ea.png` ⭐ NEW
12. `de8b5bfa62130bde399a6cb5255323ac949756ec.png`
13. `e34736e96c3537509d80e78454d6e88ebe18cc2a.png`
14. `e98b4d01e977b8572b85c44cad2e32bbfde68902.jpeg`
15. `fa574b2f56d31adfc5900e4bfd116f9cddff17a0.png`

## 💡 Key Takeaways

1. **Always use Tauri APIs for resources** in production builds:
   - `resolveResource()` to get the actual path
   - `convertFileSrc()` to convert to a valid URL

2. **Pre-load resources when possible** to avoid loading delays and flashing

3. **Always provide fallbacks** for development mode where Tauri APIs may not be available

4. **Test both dev and production** - they behave differently!

---

**Created:** October 31, 2025
**By:** Jack (Quack Agency CEO) 🦆
**Status:** Resolved ✅
**Related:** CLAUDE_SDK_BUILD_FIX.md
