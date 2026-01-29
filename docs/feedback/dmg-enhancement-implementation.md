# DMG Enhancement Implementation

**Date**: 2026-01-28  
**Status**: ✅ Implemented  
**Related**: [Mindaugas Feedback Analysis](./mindaugas-feedback-analysis.md)

---

## Overview

Implementato miglioramento del layout del DMG per drag & drop con:
- ✅ Link simbolico alla cartella Applications
- ✅ Background image personalizzato
- ✅ Layout ottimizzato e posizionamento professionale
- ✅ Integrazione automatica nel processo di build

---

## Implementation Details

### Script: `scripts/enhance-dmg.sh`

Nuovo script che migliora il DMG dopo la creazione:

1. **Crea link Applications**: Aggiunge un link simbolico a `/Applications` nel DMG
2. **Background Image**: Crea un'immagine di background personalizzata (600x400px)
   - Prova a usare `public/images/quack-agent.jpeg` se disponibile
   - Altrimenti crea un gradient dark theme usando Python/PIL
   - Fallback a colore solido se Python non disponibile
3. **Layout Configuration**: Configura la finestra DMG con:
   - Icon view (no toolbar, no statusbar)
   - Icon size: 100px
   - Posizionamento: Quack.app a (180, 200), Applications a (480, 200)
   - Window size: 660x400px
4. **Hide System Files**: Nasconde tutti i file di sistema (.DS_Store, .background, etc.)

### Integrazione Build

Lo script è integrato automaticamente in:

- **`build-mac.sh`**: Chiamato dopo `npm run tauri:build`
- **`scripts/release-macos.sh`**: Chiamato dopo la creazione del DMG, prima della notarizzazione

### Background

**Simple system background**: Nessuna immagine, nessun gradiente. Usa il colore di sistema bianco che si adatta automaticamente a light/dark mode di macOS.

---

## Usage

### Automatic (Recommended)

Lo script viene chiamato automaticamente durante il build:

```bash
./build-mac.sh
# o
./scripts/release-macos.sh
```

### Manual

Puoi anche chiamarlo manualmente dopo aver creato un DMG:

```bash
./scripts/enhance-dmg.sh <path-to-dmg>
# o senza path (trova automaticamente l'ultimo DMG creato)
./scripts/enhance-dmg.sh
```

---

## Requirements

- **macOS**: Script usa strumenti nativi macOS (`hdiutil`, `sips`, `osascript`)
- **Python 3** (opzionale): Per creare gradient background se PIL disponibile
- **PIL/Pillow** (opzionale): `pip install Pillow` per gradient background

Se Python/PIL non sono disponibili, lo script usa un colore solido come fallback.

---

## Testing

Per testare lo script:

1. Crea un DMG:
   ```bash
   npm run tauri:build
   ```

2. Trova il DMG:
   ```bash
   find src-tauri/target/release/bundle/dmg -name "*.dmg"
   ```

3. Esegui enhancement:
   ```bash
   ./scripts/enhance-dmg.sh <path-to-dmg>
   ```

4. Apri il DMG e verifica:
   - ✅ Applications folder link presente
   - ✅ Background image visibile
   - ✅ Layout corretto (app a sinistra, Applications a destra)
   - ✅ Drag & drop funziona

---

## Future Improvements

Possibili miglioramenti futuri:
- [ ] Aggiungere freccia o testo di istruzioni nel background
- [ ] Supporto per multiple background images (light/dark mode)
- [ ] Animazioni o effetti visivi nel DMG
- [ ] Custom icon per Applications folder link

---

## Notes

- Lo script modifica il DMG **prima** della notarizzazione (in `release-macos.sh`)
- Dopo l'enhancement, il DMG viene re-firmato e notarizzato
- Il background image è nascosto (`.background` folder) ma visibile nella finestra DMG
- Tutti i file di sistema sono nascosti correttamente

---

## Related Files

- `scripts/enhance-dmg.sh` - Main enhancement script
- `build-mac.sh` - Build script (calls enhance-dmg.sh)
- `scripts/release-macos.sh` - Release script (calls enhance-dmg.sh)
- `src-tauri/tauri.conf.json` - DMG configuration (appPosition, etc.)
