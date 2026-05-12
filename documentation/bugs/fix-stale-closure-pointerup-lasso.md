---
type: bug
project: quack-app
created: 2026-05-12
last_verified: 2026-05-12
tags: [react, hooks, stale-closure, useCallback, useRef, lasso, office-v2, whiteboard, pointer-events]
---

# Stale-closure su `onPointerUp` per il lasso (Office V2)

## Sintomo

In Office V2 il **lasso multi-select restituiva sempre 0 hits** (o pochi hits errati) anche se l'utente disegnava un rettangolo visualmente grande sopra le card. I log mostravano:

```
[lasso-office] UP — finalize – {rect: Object, rectSize: {w: 0, h: 0}, hits: [], hitCount: 0}
```

Il `rectSize` era `0×0` (`startCanvasX === currentCanvasX`) anche dopo decine di `setLasso` chiamate dai `pointermove` (registrate nei log MOVE).

## Causa

`onPointerUp` era un `useCallback` con deps `[panning, groupCreation, props]` (senza `lasso`):

```ts
const onPointerUp = useCallback((e: React.PointerEvent) => {
  // ...
  if (lasso) {
    const x0 = Math.min(lasso.startCanvasX, lasso.currentCanvasX);
    // ...
  }
}, [panning, groupCreation, props]);  // ← `lasso` mancante
```

Comportamento:
1. `pointerdown` → `setLasso({start, current = start})` → schedula re-render
2. Re-render: `useCallback` con stesse deps → ritorna la **stessa funzione** del primo render → il closure cattura il `lasso` iniziale (`current === start`).
3. `pointermove` → setLasso functional updater aggiorna `lasso.current` nello state.
4. `pointerup` → il closure di `onPointerUp` legge `lasso` STALE (la versione del primo render) → `startCanvasX === currentCanvasX` → rect 0×0 → 0 hits.

**Perché in alcuni run "funzionava"**: `props` cambia spesso (es. `selectedIds`, `terminals`, `layout`). Quando `props` cambia, `useCallback` ricrea `onPointerUp` con il `lasso` fresco. Quindi il bug era intermittente — dipendeva da quanto il parent rendeva tra il pointerdown e il pointerup.

## Fix

Pattern documentato: **useRef sincronizzato via useEffect**, così l'handler legge sempre il valore corrente via `ref.current` (non c'è closure da invalidare).

```ts
const [lasso, setLasso] = useState<LassoState | null>(null);
const lassoRef = useRef<LassoState | null>(null);
useEffect(() => { lassoRef.current = lasso; }, [lasso]);

const onPointerUp = useCallback((e) => {
  const lasso = lassoRef.current;  // ← always latest, no stale closure
  if (lasso) {
    const x0 = Math.min(lasso.startCanvasX, lasso.currentCanvasX);
    // ...
  }
}, [panning, layout, props]);  // ← no `lasso` needed
```

Pattern applicato a:
- `lassoRef` (era il bug)
- `groupCreationRef` (stesso pattern, per safety)

## Diagnosi: come l'ho trovato

Aggiunti log `[lasso-office] START / MOVE / UP` con coord canvas + viewport + diagnostica per ogni room (cx, cy, inside). I log mostravano `rectSize 0×0` al UP mentre MOVE riportava coord aggiornate. → state stato aggiornato, ma il closure non lo vedeva.

## Riferimenti

- [Be Aware of Stale Closures when Using React Hooks - Dmitri Pavlutin](https://dmitripavlutin.com/react-hooks-stale-closures/)
- [Hooks FAQ – React](https://legacy.reactjs.org/docs/hooks-faq.html)

## Regola generale

> Quando un `useCallback` legge state che cambia ad alta frequenza (es. drag/lasso/animation), e NON è opportuno includerlo nelle deps (perché ricreare l'handler ad ogni cambio sarebbe sub-ottimale o causerebbe bug), usare il **ref pattern**: state-as-ref sincronizzato in `useEffect`, lettura via `ref.current` nell'handler.

Brain: `fix-stale-closure-pointerup-lasso`

## File coinvolti

- `src/components/office/v2/OfficeCanvas.tsx` — `lassoRef`, `groupCreationRef`, `emptyClickRef`
