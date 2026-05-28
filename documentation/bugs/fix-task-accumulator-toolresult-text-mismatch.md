---
type: bug
project: quack-app
created: 2026-05-27
last_verified: 2026-05-27
tags: [sdk-0.3, task-tools, todowrite, react, rendering, type-mismatch]
---

# Bug: TodoWrite widget mostra righe vuote (SDK 0.3.150 task tools)

## Sintomo

Dopo l'upgrade `@anthropic-ai/claude-agent-sdk` 0.2.138 → 0.3.150, il widget TodoWrite renderizza correttamente i task `pending` (con il loro `subject`) ma i task `in_progress` e `completed` appaiono come righe vuote. Lo screenshot tipico mostra "3/7 completed, 1 active" dove le prime 3 righe (pending) hanno testo e le 4 righe colorate sotto sono visivamente vuote.

## Root cause

`src/components/StreamMessage.tsx` ha sempre costruito `toolResults` come `Map<string, any>` salvando l'intero blocco `tool_result` (serve per `extractImageData`, ecc.). Quando WS01 ha introdotto `taskAccumulator.ts` per supportare i nuovi Task tools dell'SDK 0.3.x, la firma è stata dichiarata come `Map<string, string>` perché internamente chiama `JSON.parse(toolResults.get(c.id))` sul payload di `TaskCreate`/`TaskList` per leggere `task.id` e `tasks[]`.

Risultato del type mismatch:

1. `JSON.parse` riceve un oggetto block, lo coerce a stringa → `"[object Object]"` → parse error → `parsed` è `null`.
2. In `TaskCreate` l'id ricade sul fallback `pending-${c.id}` (dove `c.id` è il tool-use-id, non il task-id vero).
3. Quando arriva `TaskUpdate` con `input.taskId` (il vero `task-abc...`), non matcha nessuna entry in `byId`, quindi il ramo:
   ```ts
   const prev = byId.get(id) ?? { content: '', status: 'pending', activeForm: '' };
   byId.set(id, {
     content: (input.subject as string) ?? prev.content,  // input.subject è undefined su update di solo status
     ...
   });
   if (!order.includes(id)) order.push(id);
   ```
   crea una **nuova** voce con `content: ''`.
4. Le voci `pending-${c.id}` originali restano in `order` con il loro subject corretto ma status `pending`; le voci `task-abc...` create dagli update appaiono dopo, con status corretto ma content vuoto.

## Fix

`src/components/StreamMessage.tsx`: nello stesso `useMemo` che costruisce `toolResults`, costruisco anche `toolResultTexts: Map<string, string>` estraendo robustamente il testo (`string | array di block | block singolo`) come fa già `ChatView.tsx:807-821`. `accumulateTodos` riceve `toolResultTexts`, non `toolResults`.

Diff essenziale:

```ts
const { toolResults, toolResultTexts } = useMemo(() => {
  const results = new Map<string, any>();
  const texts = new Map<string, string>();

  streamMessages.forEach((msg) => {
    if (msg.type === 'user' && msg.message?.content && Array.isArray(msg.message.content)) {
      msg.message.content.forEach((content: any) => {
        if (content.type === 'tool_result' && content.tool_use_id) {
          results.set(content.tool_use_id, content);
          const raw = content.content;
          const text = typeof raw === 'string'
            ? raw
            : Array.isArray(raw)
              ? raw.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('')
              : typeof raw?.text === 'string'
                ? raw.text
                : '';
          texts.set(content.tool_use_id, text);
        }
      });
    }
  });

  return { toolResults: results, toolResultTexts: texts };
}, [streamMessages]);

const { todos: accumulatedTodos, lastTaskToolId } = useMemo(
  () => accumulateTodos(streamMessages, toolResultTexts),
  [streamMessages, toolResultTexts]
);
```

## Schema SDK 0.3.150 (per riferimento)

`@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts`:

- `TaskCreateOutput = { task: { id: string; subject: string } }`
- `TaskUpdateInput = { taskId: string; subject?: string; status?: ...; ... }`  ← `subject` è opzionale, gli update di solo `status` NON lo includono
- `TaskListOutput = { tasks: { id, subject, status, owner?, blockedBy }[] }`

L'accumulator deve quindi:
1. Estrarre il vero `task.id` dal `tool_result` di `TaskCreate` per agganciarci poi i `TaskUpdate`.
2. Preservare `prev.content` quando `TaskUpdate.subject` è undefined (l'attuale `?? prev.content` lo fa, ma solo se `prev` viene trovato → vedi root cause).

## Regola

Quando una utility consuma una `Map<...>` costruita altrove con tipo dichiarato `string`, **non riusare** un'altra Map pensata per altri scopi: o si dichiara `Map<string, unknown>` e si normalizza dentro l'utility, oppure si costruisce una Map dedicata. Mescolare type guarantee fra moduli porta a `JSON.parse([object Object])` silenzioso.

## Related files

- `src/components/StreamMessage.tsx:432-461` — costruzione di entrambe le map
- `src/components/StreamMessage.tsx:524-527` — chiamata accumulator
- `src/components/ChatView.tsx:807-821` — riferimento dell'estrazione text che era già giusta
- `src/utils/taskAccumulator.ts:49-144` — accumulator (non modificato)
- `src-tauri/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts:2186-2988` — schema ufficiale Task tools

## Verifica

1. Avviare una sessione che usa Task tools sequenziali: l'agente chiama `TaskCreate` 4-7 volte poi `TaskUpdate` per spostarli in `in_progress` / `completed`.
2. Il widget TodoWrite deve mostrare il `subject` corretto su TUTTE le righe, in qualunque stato.
3. Il counter "X/Y completed" deve corrispondere al numero reale di task, senza inflate da duplicati.
