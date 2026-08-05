# Recap: Default Provider Per Project

## Cosa cambia

Ogni progetto può avere un provider predefinito. La scelta vive nel campo già presente
`defaultModelSelection`, quindi non servono migrazioni del database né modifiche al
protocollo.

La scelta compare in **Create project** e in **Edit project**. Il menu usa l'ordine dei
provider visibili nelle impostazioni. Per i nuovi progetti parte dal provider globale se
visibile, altrimenti dal primo provider visibile.

Per i provider con modello standard viene salvato quel modello. Per Pi il salvataggio
chiede il catalogo dei modelli nella cartella del progetto e salva il primo risultato.
Se il catalogo è vuoto, il dialog mostra l'errore e non crea o aggiorna il progetto.

## Priorità delle chat nuove

Le chat nuove scelgono in questo ordine:

1. provider esplicito dell'azione, come **New Codex**;
2. provider predefinito del progetto;
3. provider globale dell'app.

Dopo il provider, il modello viene scelto così:

1. slot del Papero per lo stesso provider;
2. modello salvato dal progetto;
3. modello standard del provider.

Uno slot di un altro provider viene ignorato. Thread e bozze già esistenti non cambiano.

## Provider non disponibile

Chat normali e azioni Kanban aggiornano una volta lo stato del provider del progetto.
Se non è disponibile, provano il provider globale e mostrano un avviso. La preferenza
del progetto resta invariata. Se anche il globale non è disponibile, l'azione si ferma.

Le automazioni non fanno questo ripiego: falliscono sul provider configurato, così un
progetto di lavoro non usa per errore l'abbonamento personale.

## File principali

- `apps/web/src/lib/projectDefaultProvider.ts`: provider visibili, fallback e modello Pi.
- `apps/web/src/components/CreateProjectDialog.tsx`: scelta durante la creazione.
- `apps/web/src/components/ProjectSettingsDialog.tsx`: nome e provider durante la modifica.
- `apps/web/src/components/Sidebar.tsx`: salvataggio e integrazione del dialog.
- `apps/web/src/hooks/useHandleNewThread.ts`: priorità provider e slot Papero.
- `apps/web/src/components/ChatView.tsx`: fallback per il primo invio manuale.
- `apps/web/src/components/kanban/`: stesso comportamento per creazione e dispatch delle task.

## Verifica

Test mirati: 61 test passati nei flussi di creazione progetto, provider predefinito,
composer e Kanban. La build web Vite passa.

Non sono stati modificati i file già sporchi relativi a release e transcript.
