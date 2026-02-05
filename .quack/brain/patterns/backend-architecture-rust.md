---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Backend Architecture Rust

Core: /src-tauri/src/lib.rs (32K LOC) - App init, HTTP hook server (Axum port 6768)

45 Rust modules total

Key modules: terminal.rs (PTY), fs.rs (file ops), git.rs (Git CLI), mcp.rs (MCP servers), claude_cli.rs (Claude integration)

brain/ subfolder: db.rs, types.rs, commands.rs, watcher.rs (SQLite + Obsidian sync)

Key crates: Tauri 2.9, portable-pty 0.8, Axum 0.7, rusqlite 0.32, tokio 1, notify 8.2

## Il Cuore Rust: lib.rs

`/src-tauri/src/lib.rs` e il punto di ingresso del backend (32K righe). Fa tre cose principali:

1. **Inizializza Tauri** con plugin e state management
2. **Avvia un HTTP server Axum** sulla porta 6768 per webhook hooks
3. **Registra tutti i comandi** esposti al frontend

## I Moduli Piu Importanti

| Modulo | LOC | Cosa Fa |
|--------|-----|---------|
| `terminal.rs` | 19.7K | Gestisce PTY con portable-pty |
| `fs.rs` | 50.5K | File operations (read, write, list) |
| `git.rs` | 39.1K | Wrapper per git CLI |
| `mcp.rs` | 42.6K | Gestisce processi MCP server |
| `claude_cli.rs` | 61.2K | Integrazione Claude CLI |

## Come Aggiungere un Nuovo Comando Tauri

```rust
// In src-tauri/src/mymodule.rs
#[tauri::command]
pub async fn my_command(param: String) -> Result<String, String> {
    Ok(format!("Hello {}", param))
}

// In lib.rs, aggiungi al generate_handler![]
.invoke_handler(tauri::generate_handler![
    // ... altri comandi
    mymodule::my_command,
])
```

## Il Sistema Brain

La cartella `brain/` contiene il backend del Second Brain:
- `db.rs` - Schema SQLite e CRUD
- `types.rs` - Strutture dati Entity, Observation
- `commands.rs` - Comandi Tauri per il brain
- `watcher.rs` - File watcher per sync Obsidian
