# Tauri + Vite Asset Management

## The Problem

When building Tauri applications with Vite, there's a critical difference between **development** and **production** that causes image loading issues:

### Development Mode (`npm run tauri:dev`)
- Vite dev server serves files from:
  - `public/` folder
  - Root project folder (when configured)
- Path `/images/foo.png` works if the file exists in:
  - `public/images/foo.png` ✅
  - `images/foo.png` ✅ (served from root)

### Production Mode (`npm run tauri build`)
- Vite only bundles files from `public/` → `dist/`
- Tauri packages `dist/` folder into the app
- Path `/images/foo.png` only works if file is in:
  - `public/images/foo.png` ✅
  - `images/foo.png` ❌ (NOT bundled!)

## The Solution

**All images referenced in code MUST exist in `public/` folder.**

### Directory Structure

```
project/
├── public/              # ✅ Images HERE for production
│   ├── images/
│   │   ├── logo.png
│   │   └── backgrounds/
│   └── avatars/
└── images/              # ❌ Images here DON'T work in production
    └── ...              #    (unless also copied to public/)
```

### Common Pitfall

```typescript
// In your component
<img src="/images/logo.png" />  // Works in dev if images/logo.png exists
                                 // Breaks in production if NOT in public/images/logo.png
```

## Best Practices

### 1. Keep Images in Public Folder
Store all images directly in `public/` from the start:

```
public/
├── images/
│   ├── logo.png
│   ├── avatars/
│   │   ├── avatar1.png
│   │   └── avatar2.png
│   └── backgrounds/
│       └── bg.jpg
```

### 2. Use Consistent Path Format
Always use absolute paths from root:

```typescript
// ✅ Good - absolute path
<img src="/images/logo.png" />

// ❌ Bad - relative path (harder to track)
<img src="../../images/logo.png" />
```

### 3. Avoid Duplicate Images
Don't maintain images in both `images/` and `public/images/`:
- **Single source**: Store in `public/` only
- **Symlink**: Or symlink `public/images/` → `images/` (for backwards compatibility)

### 4. Use Image Import for Small Assets
For small images that should be inlined/optimized:

```typescript
import logo from './logo.png';  // Vite will handle this
<img src={logo} />              // Works in both dev and production
```

## Tauri-Specific Considerations

### Asset Protocol (Advanced)
Tauri v2 has an asset protocol for accessing bundled resources:

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';

// For resources bundled in tauri.conf.json
const assetUrl = convertFileSrc('/path/to/resource', 'asset');
```

**However**, for standard web images in your UI:
- Use `public/` folder (simpler)
- Asset protocol is for non-web resources (executables, data files, etc.)

### CSP Configuration
If using asset protocol, update `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "csp": "img-src 'self' data: https: blob: asset: http://asset.localhost"
    }
  }
}
```

## Debugging Image Issues

### Symptoms
- Images load in dev (`npm run tauri:dev`) ✅
- Images don't load in production (`npm run tauri build`) ❌
- Console shows 404 errors for image paths

### Diagnosis
1. **Check production build**: Extract the `.app`/`.exe` and inspect `dist/` folder
2. **Verify public folder**: Ensure images are in `public/` before build
3. **Check paths**: Ensure code uses `/images/...` not `images/...`

### Quick Fix
```bash
# Copy images from root to public
cp -r images/* public/images/

# Rebuild
npm run tauri build
```

## Migration Checklist

Moving from broken images to working production:

- [ ] Identify all images referenced in code (see audit script)
- [ ] Copy images to `public/` folder with correct structure
- [ ] Update image paths in code (if needed)
- [ ] Create tests to prevent regression (see test template)
- [ ] Build and test production app
- [ ] Remove duplicate images from root (optional)

## See Also

- Vite Static Asset Handling: https://vitejs.dev/guide/assets.html
- Tauri Asset Protocol: https://v2.tauri.app/reference/javascript/core/#convertfilesrc
