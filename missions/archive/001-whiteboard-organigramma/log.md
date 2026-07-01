# Log — whiteboard-organigramma

- (Debugger) [16:10] Fix DnD whiteboard: usavo MIME custom "text/skill-name" su dataTransfer, WKWebView (Tauri/macOS) lo filtra da types su dragover → guard types.includes("text/skill-name") false → preventDefault non scatta sull'agent → browser non lo riconosce come drop target → drop mai fired → canvas muto. Fix: nuova costante SKILL_DT_MIME = "text/plain" condivisa da chip.dragstart e agent.dragover/drop, + wrapper chip da <span> a <div> per affidabilità dragstart su inline in WKWebView. Build verde. Doc 018 aggiornata.
