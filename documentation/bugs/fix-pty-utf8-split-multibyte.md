---
type: bug
project: quack-app
created: 2026-05-29
last_verified: 2026-05-29
tags: [terminal, pty, utf8, encoding, rust, xterm, embedded-cli]
---

# PTY output: caratteri `���` (U+FFFD) nelle righe box-drawing — UTF-8 multi-byte spezzato sul confine del flush

## Sintomo

Nel terminale (sia quello normale sia il CLI embedded `AgentTerminalView`) le lunghe righe di box-drawing o braille di una TUI — es. il separatore `──────────` di Claude Code, o lo spinner — mostrano **caratteri di sostituzione** `���` / quadratini (tofu) sparsi, in modo **intermittente**. Il testo ASCII e le righe corte sono sempre puliti.

## Causa

`start_output_thread` in `src-tauri/src/terminal.rs` accumula i byte letti dal PTY e li flusha (timer adattivo 1-8ms, carattere critico, o buffer ≥64KB) chiamando:

```rust
let text = String::from_utf8_lossy(&accumulated_bytes).to_string();
```

`from_utf8_lossy` sostituisce con **U+FFFD** ogni sequenza UTF-8 non valida — incluse le sequenze **incomplete in coda**. Un carattere multi-byte come `─` (U+2500 = `E2 94 80`, 3 byte) può finire spezzato: il flush parte tra il 1°/2° byte e il 3°. Risultato: i byte in coda del chunk N diventano `�`, e i byte di continuazione in testa al chunk N+1 diventano altri `�`. Con una riga di centinaia di `─` la probabilità che un confine di flush/lettura (64KB) cada a metà carattere è alta → corruzione visibile. È intermittente perché dipende da dove cade il confine.

## Fix

Decodificare solo l'UTF-8 **completo**, **trattenendo la sequenza incompleta in coda** per il chunk successivo:

```rust
fn drain_valid_utf8(buf: &mut Vec<u8>) -> String {
  match std::str::from_utf8(buf) {
    Ok(_) => String::from_utf8(std::mem::take(buf)).unwrap_or_default(),
    Err(e) => {
      let valid = e.valid_up_to();
      match e.error_len() {
        None => { // incompleto in coda → emetti prefisso valido, tieni la coda
          let s = std::str::from_utf8(&buf[..valid]).unwrap_or_default().to_string();
          buf.drain(..valid);
          s
        }
        Some(_) => { // byte realmente invalidi a metà → lossy e pulisci (raro)
          let s = String::from_utf8_lossy(buf).to_string();
          buf.clear();
          s
        }
      }
    }
  }
}
```

Usato nei due flush "in volo" (should_flush + timeout). Il flush finale a **EOF** resta `from_utf8_lossy` (non arriveranno altri byte, una coda incompleta va comunque resa).

## Note

- Si trattiene al massimo ~3 byte: il buffer non cresce, e l'ASCII (input utente) non è mai spezzato → nessun impatto su latenza di digitazione.
- È un fix **condiviso**: vale per tutti i terminali, non solo il CLI embedded. La TUI di claude lo scatenava solo perché emette tanti box-drawing.
- I tofu *residui* di glifi davvero assenti nel font (es. braille esotici in Menlo) sono un problema diverso (font fallback), NON questo.
