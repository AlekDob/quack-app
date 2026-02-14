# Quack Brain - Panoramica

Il Brain e' il sistema di memoria di Quack. Tutto quello che i tuoi agenti AI imparano lavorando sul progetto viene salvato qui, in file markdown leggibili sia dall'AI che da te.

## Il concetto in 30 secondi

Quando un agente trova un bug subdolo, scopre un pattern utile, o prende una decisione architetturale, lo salva nel Brain. La prossima volta che un agente (anche diverso) lavora sullo stesso progetto, trova subito quella conoscenza senza ripartire da zero.

## Due livelli di memoria

| Livello | Dove | Cosa contiene | Esempio |
|---------|------|---------------|---------|
| **Progetto** | `{progetto}/documentation/` | Conoscenza specifica del progetto | "Tauri splitta gli argomenti con split_whitespace" |
| **Globale** | `~/.quack/brain/` | Conoscenza cross-progetto | "Pattern per gestire gli errori in React" |

Il livello **Progetto** vive nel repo Git — si committa, si condivide con il team. Il livello **Globale** e' personale, sul tuo Mac.

## Come si collega all'agente

Ogni progetto ha un `CLAUDE.md` che l'agente legge automaticamente. Dentro c'e' una sezione **Knowledge Base** con i link agli entry piu' critici del Brain. L'agente vede subito le cose importanti senza doverle cercare.

Il flusso completo e' spiegato in [Access Chain](./access-chain.md).

## Cosa trovi in questa guida

| Pagina | Contenuto |
|--------|-----------|
| [Access Chain](./access-chain.md) | Come l'AI accede alla conoscenza (i 3 livelli) |
| [Tipi di Entry](./entry-types.md) | Gotcha, Pattern, Decision, Diary — quando usare cosa |
| [Brain UI](./brain-ui.md) | La finestra visuale: Timeline, Knowledge, Graph |
| [Scrivere Entry](./writing-entries.md) | Formato, regole, esempi pratici |
