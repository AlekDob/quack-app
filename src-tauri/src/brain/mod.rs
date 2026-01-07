// Quack Brain - Standalone SQLite-based memory system
// 🧠 Local-first knowledge graph with MCP Memory compatibility

pub mod db;
pub mod types;
pub mod commands;
pub mod watcher;

pub use db::init_database;
pub use types::*;
pub use commands::*;
pub use watcher::*;
