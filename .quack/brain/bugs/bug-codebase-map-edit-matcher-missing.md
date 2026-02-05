---
type: bug_fix
project: quack-app
created: 2026-02-02
tags: [codebase-map, hooks, posttooluse, matcher, swift]
---

# Bug: Codebase Map Hook Missing Edit Matcher + No Swift Support

## Problema

Il PostToolUse hook per l'auto-update della codebase map aveva **due problemi**:

1. **Matcher incompleto**: registrato solo per `Write`, non per `Edit`
   - Quando un agente usava il tool `Edit` su un file, il hook non scattava
   - Risultato: la mappa non veniva aggiornata dopo edit, solo dopo write

2. **Solo TypeScript**: lo script supportava solo `.ts/.tsx`, ignorando completamente file Swift
   - Per progetti iOS/Swift (es. meow), la mappa era incompleta
   - Gli edit su file `.swift` venivano sempre ignorati

## Soluzione

### Fix 1: Matcher Write|Edit

**File modificato**: `src/components/settings/categories/CodebaseMapSettings.tsx:250`

```diff
- matcher: 'Write',
+ matcher: 'Write|Edit',
```

Questo fa sì che il hook scatti sia per `Write` che per `Edit`.

### Fix 2: Supporto Multi-Language (TypeScript + Swift)

**File modificato**: `~/.quack/scripts/generate-codebase-map.mjs`

1. Aggiunta estensione valida:
```javascript
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.swift']);
```

2. Aggiunto extractor Swift (`extractSwiftDeclarations`):
   - Estrae: `struct`, `class`, `enum`, `protocol`, `func`, `View`
   - Regex-based come per TS, supporta access modifiers (`public`, `internal`, etc.)
   - Estrae anche campi di struct e parametri di funzioni

3. Dispatch per linguaggio:
```javascript
function extractExports(content, filePath) {
  if (filePath && extname(filePath) === '.swift') {
    return extractSwiftDeclarations(content);
  }
  return extractTsExports(content);
}
```

**File modificato**: `scripts/codebase-map-hook.sh`

Aggiunto `.swift` al filtro:
```bash
case "$FILE_PATH" in
  *.ts|*.tsx|*.swift) ;;
  *) exit 0 ;;
esac
```

### Fix 3: Aggiornamento Hook Esistente

**File modificato**: `meow 😻/.quack/hooks-metadata.json`

Hook installato sul progetto meow aveva matcher vecchio:
```diff
- "matcher": "Write"
+ "matcher": "Write|Edit"
```

## Risultato

- **Prima**: progetto meow aveva 29 file / 71 exports (solo TS)
- **Dopo**: progetto meow ha 62 file / 212 exports (TS + Swift)
- L'hook ora scatta correttamente anche sugli Edit, non solo Write

## Pattern Output Swift

Esempio da `MeowApp/Sources/Core/Design/ChatBubble.swift`:
```markdown
- struct `ChatBubble { content, isUser, stats }`
```

Esempio da `MeowApp/Sources/Core/Auth/AuthManager.swift`:
```markdown
- class `AuthManager`
- func `authenticateWithBiometrics()`
- func `setBiometricEnabled(_ enabled: Bool)`
```

## Come Verificare

```bash
cd "{project-path}"
node ~/.quack/scripts/generate-codebase-map.mjs . .quack/codebase-map.md
```

Output expected: `Scanned N files, mapped M files with K exports (Xms)`

## Gotchas

- **PostToolUse matcher syntax**: usa `|` per OR, non `,` o spazi
- **Incremental update**: lo script usa `--update-file` per update singolo file, molto più veloce del full scan
- **Swift extractor limitations**: non gestisce extension methods (solo top-level declarations)
- **SwiftUI Views**: struct che conformano a `View` vengono marcati come `View` invece di `struct`

## File Toccati

| File | Tipo | Cambiamento |
|------|------|-------------|
| `CodebaseMapSettings.tsx:250` | UI | `matcher: 'Write|Edit'` |
| `~/.quack/scripts/generate-codebase-map.mjs` | Script | Swift extractor + `.swift` extension |
| `scripts/codebase-map-hook.sh` | Wrapper | `*.swift` filter |
| `meow 😻/.quack/hooks-metadata.json` | Config | Matcher fix su hook esistente |
| `scripts/generate-codebase-map.mjs` | Local copy | Sync da ~/.quack/scripts |
