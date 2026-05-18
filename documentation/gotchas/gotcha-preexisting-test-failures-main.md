---
type: gotcha
project: quack-app
created: 2026-05-15
last_verified: 2026-05-15
tags: [testing, cargo-test, regression-gate, ci, false-positive]
---

# 2 test Rust falliscono GIA' su main — non sono una tua regressione

## Sintomo

`cd src-tauri && cargo test` chiude con `FAILED` e questi 2 fallimenti:

```
claude_usage::tests::test_parse_usage_output
  assertion `left == right` failed  (left: None, right: Some("sonnet"))
telegram_obfuscation::tests::test_xor_token
  Failed to decode XOR token: invalid utf-8 sequence ... from index 0
```

Tipico esito lib: `35 passed; 2 failed` (il numero di `passed` cresce man mano
che si aggiungono test; i 2 `failed` restano questi due).

## Causa

Sono fallimenti **environment/data-dependent preesistenti**, NON introdotti dal
lavoro corrente:

- `test_parse_usage_output` si aspetta `Some("sonnet")` ma ottiene `None` —
  dipende dall'output/config locale del CLI `claude`.
- `test_xor_token` decodifica un token XOR che dipende da una variabile
  d'ambiente di build (token Telegram) assente in locale.

**Verificato il 2026-05-15**: entrambi falliscono **identici** sul commit base
`daec7fd` (Merge `037-anthropic-compatible-providers`) in un worktree pulito,
senza alcuna modifica applicata. Quindi falliscono su `main` di per sé.

## Implicazione (gate zero-regressione)

Quando un task richiede "nessuna regressione su `cargo test`" (es. wrapper di
backend, refactor daemon), il criterio corretto NON è "suite tutta verde" — è:
**nessun test che passava alla baseline inizia a fallire**. La baseline reale di
questo repo è `N passed; 2 failed` con ESATTAMENTE quei 2 nomi.

Prima di un gate zero-regressione: misura la baseline (`cargo test` sul branch
PRIMA della modifica), poi confronta. Se dopo la modifica i fallimenti sono solo
quei 2 nomi → nessuna regressione. Se ne compare un terzo o uno dei passati
diventa rosso → STOP, è una regressione vera.

Non "aggiustare" questi 2 test dentro un task non correlato: è scope creep.
Vanno trattati a parte (o forniti gli env/fixture mancanti) come lavoro dedicato.

## Trigger

`cargo test` nel repo quack-app mostra `test_parse_usage_output` e/o
`test_xor_token` rossi → è lo stato noto di `main`, non una tua regressione.
Confronta col conteggio `passed`, non con "tutto verde".
