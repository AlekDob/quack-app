---
type: bug
created: 2026-01-12
tags: [macos, webview, standby, recovery, ui]
---

# bug-white-screen-after-macos-standby

**Problema**: App Quack diventa completamente bianca dopo wake da standby macOS, mentre terminal-window-app continua a funzionare normalmente

**Root Cause**: 1) `visibilitychange` event non affidabile per wake da standby prolungato, 2) Re-render React insufficiente per recuperare rendering WebView, 3) Timeout 2000ms troppo lungo

**File modificato**: `src/hooks/useSystemWakeHandler.ts`

**Fix 1 - pageshow/pagehide events**: Piu affidabili di `visibilitychange` per rilevare wake. `event.persisted` indica quando pagina ripristinata da BFCache

**Fix 2 - forceRepaint()**: Toggle `display:none` su root element forza reflow CSS che aiuta WebView a recuperare rendering

**Fix 3 - isWebViewCorrupted() detection**: Rileva stato corrupted controllando: root element esiste, ha children, display/visibility OK, non bianco con height 0. Triggera recovery anche con hide brevi se WebView corrotta

**Fix 4 - Timeout ridotto**: Da 2000ms a 500ms per recovery piu veloce

**Fix 5 - Prevenzione duplicati**: `recoveryInProgressRef` previene tentativi multipli simultanei

**Recovery sequence**: 1) Force CSS repaint (display:none toggle), 2) React re-render (setRenderTick), 3) Dopo 500ms: se ancora corrupted -> window.location.reload()

**Test**: 13 test passano in `src/tests/systemWakeHandler.test.ts`, TypeScript check OK
