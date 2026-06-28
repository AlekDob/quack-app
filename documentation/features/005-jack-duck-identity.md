---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-06-28
tags: [branding, jack, duck, mascot, avatar, persona, ai-chat, agents, quack-v1, system-prompt]
---

## Jack & the Duck Identity

**Purpose:** The AI assistant in Quack IS **Jack**, a duck "project manager" you talk to (Quack v1
identity). Every agent/chat affordance carries the duck mascot, and the model self-identifies as Jack.
This is the single place that defines the persona, the brand mark, and where ducks appear.
**Stack:** React 19, a shared `AIIcon` component, a system-prompt persona line, duck image assets.

### The persona
- System prompt (first block in `AIChatPanel.sendUserText` → `sysParts[0]`) opens with:
  *"You are Jack, the project manager and coding agent embedded in Quack… Speak as Jack… never invent another name."*
- Reaches **all** providers: for Claude Code it's flattened into the `[System]` block on turn 1
  (`providers/claudeCode.ts` `flattenMessages`); other providers get it as the `system` message.
- **Gotcha:** the "Agent Alex" greeting seen in some screenshots came from a *different project's*
  `CLAUDE.md` (Astronave), not from Quack — Quack's persona is Jack.

### The brand mark (`AIIcon`)
- `src/components/AIIcon.tsx` is the **single source of truth** for the AI/agent/chat mark. It renders
  Jack's duck avatar (`/jack.jpeg`) as a rounded square that scales 12px→28px.
- Because it's one component, swapping the duck updates **every** surface at once:
  Agents toggle (TopBar), "New AI"/"New chat" buttons, AI tab icons, side-panel header, activity bar,
  Agent Mode shell + empty state, welcome modal.
- The old orange-sparkle `app-logo` mark is gone from these AI affordances.

### The chat identity header
- Assistant messages render an avatar + **Jack** (14px) over **Project Manager** (10px) instead of a
  generic "AI" label (`AIChatPanel` `.ai-msg-role` → `.ai-msg-identity` / `.ai-msg-name` / `.ai-msg-title`).
- User messages still read "You". Breathing room via `margin: 6px 0 10px` on the assistant role header.

### Files
| Type | Path | Purpose |
|---|---|---|
| Component | `src/components/AIIcon.tsx` | Duck brand mark used across all agent/chat surfaces |
| Component | `src/components/AIChatPanel.tsx` | Jack persona in system prompt + assistant identity header |
| Asset | `public/jack.jpeg` | Jack's avatar (duck in a blazer = the PM); swap to restyle the mark everywhere |
| Assets | `public/images/ducks/duck1..35.jpeg` | duck pool for per-subagent avatars (see `features/004`) |
| Styles | `src/App.css` | `.ai-msg-identity`, `.ai-msg-name`, `.ai-msg-title`, `.ai-msg-avatar` |

### Related
- Per-subagent duck avatars + the `@`-mention/transcript flow: `features/004-subagent-mentions.md`
  (`subagents.ts` `duckAvatarFor` assigns a stable duck per agent name).
- Tab/composer styling that frames all this: `features/003-design-system.md`.

### Gotchas
- **One avatar, one file:** `AIIcon` and the chat header both point at `/jack.jpeg`. Replace that file
  to rebrand Jack everywhere; no code change needed.
- **`sparkle` prop** on `AIIcon` is kept for API compatibility but ignored (the duck needs no accent badge).
