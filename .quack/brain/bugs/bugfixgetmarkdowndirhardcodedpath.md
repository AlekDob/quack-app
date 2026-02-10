---
type: bug_fix
project: quack-app
created: 2026-01-07
migrated: true
---

# bug_fix_get_markdown_dir_hardcoded_path

[2025-01-07] La funzione get_markdown_dir() in commands.rs era hardcoded a ~/.quack/brain/markdown e ignorava le settings vault_path

Fix: modificata per leggere vault_path e sync_structure dal database brain_settings

Ora crea i file .md nel path configurato dall'utente invece del path di default

Supporta sia modalita subfolder (crea QuackBrain/) che flat (direttamente nel vault)

File: src-tauri/src/brain/commands.rs linea 869-911
