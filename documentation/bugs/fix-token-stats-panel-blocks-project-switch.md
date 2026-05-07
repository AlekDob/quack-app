---
type: bug
project: quack-app
created: 2026-05-06
last_verified: 2026-05-06
tags: [performance, sidebar, token-stats, sqlite, accordion, project-switch]
---
# Token Stats panel slows cross-project session switch (~2-3s)

## Symptom
Switching to a session in a different project takes 2-3s. Switching between sessions inside the same project is instant. Reported after commit `7a8b733`, but the actual culprit is commit `57133fd` (token stats SQLite, 2026-04-24).

## Root Cause
`SidePanelAccordion` renders all `AccordionSection` children regardless of `isExpanded` (line 110 just toggles a CSS class, no conditional mount). So `AgentTokenStatsPanel` is always mounted under the "Token Stats" section, even when the section is collapsed and the user can't see it.

The panel's effect runs on `[normalizedPath, ...]`:
```ts
useEffect(() => {
  if (!normalizedPath) return;
  setLoading(true);
  refreshProjectAgents(normalizedPath).finally(() => setLoading(false));
}, [normalizedPath, refreshProjectAgents]);
```

Every cross-project switch changes `rootPath` → effect fires → `invoke('get_project_agent_stats')` → SQLite `GROUP BY agent_id, model, agent_deleted` over `token_events` for that project. The Rust command holds `db.0.lock()`, which contends with `recordUsage` calls dispatched by `handleClaudeEvent` for any active session receiving messages. Combined cost: 2-3s of perceived freeze.

Same-project switches don't change `rootPath`, so the effect doesn't fire — matches the reported symptom exactly.

## Fix
Gate the effect on an `enabled` prop, set true only when the accordion section is the focused one:

```tsx
// AgentTokenStatsPanel.tsx
useEffect(() => {
  if (!normalizedPath || !enabled) return;
  setLoading(true);
  refreshProjectAgents(normalizedPath).finally(() => setLoading(false));
}, [normalizedPath, refreshProjectAgents, enabled]);
```

```tsx
// SidePanelAccordion.tsx
<AgentTokenStatsPanel
  projectPath={rootPath}
  enabled={focusedSection === "token-stats"}
/>
```

The component still mounts (preserves expanded-row state across open/close cycles), but the SQLite refresh runs only while the user is actually looking at the panel. First open after a project switch triggers exactly one refresh.

## Why not lazy-mount the children of every AccordionSection?
Other panels (Sessions, Brain, Context, Changes) may rely on early mount to pre-fetch or stay subscribed. Auditing all of them is high blast radius — chirurgical gating per panel is safer until a pattern emerges across multiple expensive sections.

## Files
- `src/components/AgentTokenStatsPanel.tsx` — added `enabled` prop, gated effect
- `src/components/SidePanelAccordion.tsx` — passes `enabled={focusedSection === "token-stats"}`

## Related
- `documentation/decisions/decision-project-token-stats-sqlite.md` — original architecture
- `documentation/bugs/bug-delayed-agent-message-stale-closure.md` — same commit context
