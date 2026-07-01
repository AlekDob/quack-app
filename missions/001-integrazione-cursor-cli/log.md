# Log — integrazione-cursor-cli

## 2026-07-01

- Backend: `cursor_code.rs` — `cursor_code_check`, `cursor_code_chat`, `cursor_code_kill`; rileva `cursor-agent` e fallback `cursor agent`; eventi `cursor-stream:<id>`.
- Frontend: `cursorCode.ts` provider + `cliStreamJson.ts` / `cliPrompt.ts` condivisi.
- UI: tab Cursor CLI in ModelBrowser, toggle `--force` in Settings → Cursor CLI — Force mode.
- Build: `npm run build` + `cargo check` OK. Smoke test in `tauri dev` pending (richiede `cursor-agent login`).
