---
type: bug_fix
project: quack-app
created: 2026-05-28
last_verified: 2026-05-28
tags: [markdown, jack, pm-widgets, streaming, json-parse, error-boundary, react, crash]
---

# Fix: PM widgets streaming JSON.parse crashes app via "Provider Error: Git"

## Symptom

Sporadic full-app fallback during a Jack streaming response:

```
Provider Error: Git
This feature may be unavailable. The app will continue to work.
```

Console:

```
SyntaxError: JSON Parse error: Expected '}'
ErrorBoundary caught an error: …
  componentDidCatch (main-…js)
  vendor-…js (React internals: vf, lo, i0, lw, Nn)
```

Reproduces when Jack streams a PM widget code-block (`ws-board`, `task-suggest`, `agent-grid`, `briefing`) — the crash fires on the first render that includes the fenced block, before the closing `}` of the JSON payload has arrived from the stream.

The "Git" wording is misleading: Git has nothing to do with it — `GitProvider` is just the outermost provider wrapping `{children}` in `src/contexts/index.tsx:39-43`, so its `ErrorBoundary` catches any render-time throw from anywhere in the app.

## Root cause

`src/components/MarkdownText.tsx` rendered PM widgets with `JSON.parse(codeContent)` **directly inline in the JSX**, no try/catch, for four fenced languages introduced by commit `e164235 feat(jack): PM widgets — inline visual tools via code block rendering`:

```tsx
<WorkstreamBoard data={JSON.parse(codeContent)} />
<TaskSuggester  data={JSON.parse(codeContent)} />
<AgentActivityGrid data={JSON.parse(codeContent)} />
<DailyBriefing  data={JSON.parse(codeContent)} />
```

During streaming, the SSE chunks arrive incrementally. React re-renders on every chunk; when the closer of the fence (` ``` `) has been seen but the JSON inside is still incomplete (mid-object, mid-array), `JSON.parse` throws `SyntaxError: JSON Parse error: Expected '}'`. The throw escapes the render path, bypasses `Suspense` (Suspense only catches promises), and bubbles up to the closest `ErrorBoundary` — which is the outer "Git" one.

The temporal correlation with `Answering user question via stdin` in the original repro was coincidental: Jack happened to emit a PM widget right after the user replied to an `AskUserQuestion`.

## Fix

Extract a `safeParseWidgetData` helper at module scope. Return `null` on parse failure and skip rendering the widget for that chunk; the next streaming chunk will re-render with the now-valid JSON and mount the widget normally.

```tsx
// Brain: fix-markdown-pm-widgets-streaming-json-crash
function safeParseWidgetData(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// …inside flushCodeBlock()…
} else if (codeBlockLang === 'ws-board') {
  const data = safeParseWidgetData(codeContent);
  if (data) {
    elements.push(
      <Suspense key={`wsboard-${key}`} fallback={null}>
        <WorkstreamBoard data={data} />
      </Suspense>
    );
  }
}
// same pattern for task-suggest / agent-grid / briefing
```

## Why not wrap in an ErrorBoundary instead

Per-widget ErrorBoundary would *catch* the crash but still show an error UI for ~1 frame on every streaming chunk until the JSON closes. `safeParse → null → skip` is silent and self-healing: the widget appears once the JSON is valid and never flickers.

## Why a guard around `JSON.parse` is enough (no streaming-aware parser)

The current PM widgets all consume small JSON payloads (<5KB) that finish within a single SSE flush after the opening token. Adding a streaming JSON parser would be over-engineered for the actual size. The skip-then-mount pattern is the standard approach for fenced-block widgets in chat UIs.

## Files changed

- `src/components/MarkdownText.tsx` — module-scope `safeParseWidgetData`, all four widget branches now guard the parse.

## Verification

1. Send a Jack prompt that emits any PM widget (e.g. trigger a workstream board).
2. During streaming, no `SyntaxError` in console, no `Provider Error: Git` fallback.
3. Widget appears as soon as the JSON closer arrives.
