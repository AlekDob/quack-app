---
type: gotcha
project: quack-app
created: 2026-02-25
last_verified: 2026-02-25
tags: [pwa, ios, icon, apple-touch-icon, safari]
---

# Gotcha: PWA Icons Must Be Full-Bleed Squares on iOS

## Problem

When adding a PWA to iOS home screen, the icon shows white borders/corners around the actual image.

## Root Cause

The Tauri-generated icons (`src-tauri/icons/`) have **pre-baked rounded corners with transparent pixels**. iOS Safari applies its own rounded-rect mask on top. The transparent corner pixels become white, creating an ugly double-border effect.

## Solution

Generate **full-bleed square PNGs** with NO rounded corners and NO transparency. Fill the entire canvas with the background color, then composite the original icon on top.

```python
from PIL import Image

src = Image.open("icons/icon.png").convert("RGBA")
bg_color = (10, 22, 40, 255)  # match icon's background
out = Image.new("RGBA", src.size, bg_color)
out = Image.alpha_composite(out, src)
out.convert("RGB").save("icon-180.png")  # RGB, no alpha
```

Key requirements:
- **No alpha channel** — convert to RGB
- **No rounded corners** — iOS applies its own mask
- **180x180** for `apple-touch-icon` (iOS standard size)
- **192x192 + 512x512** for PWA manifest

## Serving from Rust

Icons are embedded via `include_bytes!()` and served as routes:

```rust
.route("/icon-180.png", get(handle_icon_180))

async fn handle_icon_180() -> Response {
    (StatusCode::OK,
     [(header::CONTENT_TYPE, "image/png"),
      (header::CACHE_CONTROL, "public, max-age=86400")],
     include_bytes!("../static/icon-180.png").as_slice())
    .into_response()
}
```

## HTML

```html
<link rel="apple-touch-icon" href="/dashboard/icon-180.png">
```

Do NOT specify `sizes` on `apple-touch-icon` — Safari picks the best match automatically. One 180x180 icon is sufficient.

## Files

- `src-tauri/static/icon-180.png` — apple-touch-icon (180x180, full-bleed)
- `src-tauri/static/icon-192.png` — PWA manifest (192x192)
- `src-tauri/static/icon-512.png` — PWA manifest (512x512)
- `src-tauri/src/remote_dashboard.rs` — routes serving icons
