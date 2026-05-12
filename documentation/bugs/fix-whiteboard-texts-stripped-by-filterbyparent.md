---
type: bug
project: quack-app
created: 2026-05-12
last_verified: 2026-05-12
tags: [whiteboard, feature-map, canvas-text, titoletti, filterByParent, visibleAnnotations, regression, silent-data-loss]
---

# Whiteboard "Title" (titoletti) mode non crea testi — `filterByParent` strippa `texts`

## Sintomo
Nella feature map / whiteboard (feature 026), selezionando il tool "Title" (tasto `7` o bottone con la T nella toolbar) e cliccando sul canvas:
1. L'icona toolbar passa subito a "Select" (freccia)
2. Nessun titoletto compare sul canvas
3. Nessun errore in console

In Office View v2 (feature 063) il flusso analogo (tasto `6` Title) funziona correttamente — sintomo isolato alla whiteboard.

## Causa
`filterByParent(a, componentId)` in `src/hooks/useWhiteboardFile.ts:67-71` filtra le annotation per `parentComponentId` ricostruendo l'oggetto `CanvasAnnotations` field-by-field. Il return originale ometteva `texts`:

```ts
return { postIts: match(a.postIts), groups: match(a.groups), images: match(a.images), mdCards: match(a.mdCards ?? []) };
// → texts undefined ❌
```

`CanvasAnnotations.texts` è un campo opzionale (`texts?: CanvasText[]`), quindi TypeScript strict NON segnalava il return mancante. A runtime:

1. `addText(x,y)` salva correttamente in `file.annotations.texts`
2. `useMemo visibleAnnotations = wb.getVisibleAnnotations(currentComponentId)` chiama `filterByParent` → ritorna oggetto SENZA `texts`
3. `<FeatureMapCanvas annotations={visibleAnnotations}>` riceve `annotations.texts === undefined`
4. Render: `(annotations.texts ?? []).map(...)` produce `[]` → nessun titoletto sul canvas
5. `onResetMode()` chiamato dopo `onTextAdd` → mode torna a `select` → utente vede solo "switch alla freccia"

Bug introdotto quando `CanvasText` è stato aggiunto a `CanvasAnnotations` senza estendere `filterByParent` (le altre 4 collezioni — postIts, groups, images, mdCards — erano già lì).

## Fix
Aggiungere `texts: match(a.texts ?? [])` al return di `filterByParent`:

```ts
function filterByParent(a: CanvasAnnotations, componentId: string | null): CanvasAnnotations {
  const match = <T extends { parentComponentId?: string }>(items: T[]): T[] =>
    items.filter(item => (item.parentComponentId ?? null) === componentId);
  return {
    postIts: match(a.postIts),
    groups: match(a.groups),
    images: match(a.images),
    mdCards: match(a.mdCards ?? []),
    texts: match(a.texts ?? []), // ← AGGIUNTO
  };
}
```

`CanvasText` ha già `parentComponentId?: string` (vedi `annotationTypes.ts:62-69`), quindi è compatibile con `match<T>` senza altre modifiche. Nessun cambio nella firma di `getVisibleAnnotations`, nessun impatto su persistenza file.

## Fix collaterale: `MODES` cycling salta `'text'`
`FeatureMapView.tsx:220` definiva `MODES: AnnotationMode[] = ['select', 'lasso', 'postit', 'group', 'image', 'mdcard']` — senza `'text'`. Il listener Ctrl (linea 248-254) usa questo array per ciclare i modi; quando l'utente premeva Ctrl con mode `'text'`, `MODES.indexOf('text') === -1` → `(-1 + 1) % 6 === 0` → ritorna `'select'`. Effetto: Ctrl con Title attivo cancellava immediatamente il modo. Fix: aggiunto `'text'` all'array.

## Regola generale
**Quando aggiungi un nuovo campo collezione a `CanvasAnnotations`** (o a qualsiasi tipo bag usato come "stato annotation"), aggiorna sempre:

1. `filterByParent` in `useWhiteboardFile.ts` — altrimenti il campo sparisce in tutte le viste filtrate (anche al root level con `componentId === null`)
2. `duplicateAnnotations` (stesso file, ~linea 390-450) — altrimenti Cmd+C/V/D ignora il tipo
3. `MODES` in `FeatureMapView.tsx` — altrimenti Ctrl-cycle salta il nuovo modo
4. `BUTTONS` + `SHORTCUT_MAP` in `AnnotationToolbar.tsx`
5. Branch corrispondente in `FeatureMapCanvas.tsx handleMouseDown`
6. Render block nel canvas

Il TypeScript NON aiuta in questi casi: i campi sono opzionali (`?:`) e l'object literal incompleto è valido.

## Brain breadcrumb
Aggiunto `// Brain: fix-whiteboard-texts-stripped-by-filterbyparent` sopra il return di `filterByParent` in `useWhiteboardFile.ts:70` per linkare il codice al fix.

## Verifica
1. `npm run tauri dev` → aprire la whiteboard di un progetto qualsiasi (Cmd+Shift+W)
2. Premere `7` (o cliccare il bottone Title nella toolbar)
3. Cliccare su un punto del canvas → deve comparire "Title" editabile, in modalità edit con focus automatico (`autoEditOnMount`)
4. Scrivere "ciao" + Enter → titoletto persistente, sopravvive a reload (`.whiteboard.json` deve avere `annotations.texts: [...]`)
5. Entrare dentro un component (double-click su un component) → creare un text → exit → rientrare: deve essere ancora visibile (parentComponentId rispettato)
6. Ctrl press in mode `text` → mode passa a `select` (cycle valido ora, era `select` anche prima ma per il bug-bypass)

## Files toccati
- `src/hooks/useWhiteboardFile.ts` (1 riga aggiunta a `filterByParent`)
- `src/components/featureMap/FeatureMapView.tsx` (1 stringa aggiunta a `MODES`)
- `documentation/features/026-feature-map-whiteboard.md` (changelog)
- `documentation/diary/2026-05-12.md`
- `CLAUDE.md` (Knowledge Base link)
