---
type: decision
project: quack-desktop
created: 2026-06-28
last_verified: 2026-06-28
tags: [styling, css-variables, tailwind, shadcn, ai-elements, light-mode, theming, rebrand]
status: accepted
---

# Decision: Rebrand on CSS variables — NOT a Tailwind/shadcn rewrite

## Context
An external suggestion (Astronaut) proposed re-doing the UI with Tailwind v4 + shadcn/ui + AI Elements + Vercel AI SDK + Geist + Motion. Alek evaluated it and chose to stay light.

## Decision
1. **Keep Codetta's plain CSS + BEM + CSS-variable architecture.** No Tailwind, no shadcn, no CSS-in-JS, no second styling system.
2. **Rebrand by rewriting token VALUES in `src/App.css`** (and adding any missing tokens) to the Quack design system. The architecture stays; only values change.
3. **Ship light mode now.** `:root` (dark) + `:root[data-theme="light"]` already exist — fill both with Quack values and add a theme toggle. Dark stays the default (brand is dark-first).
4. **Keep Codetta's agent chat.** It already streams via the Claude Code CLI bridge (`claude_code.rs` + `chatStream`). No AI Elements / Vercel AI SDK — those would replace a working core and aren't plug-and-play with the CLI bridge.
5. Font is Quack's **General Sans / Inter + JetBrains Mono** — NOT Geist (Geist is Astronave/Studio Futuro).

## Why
- Premise from day one: Codetta is liked *because* it's light (~30MB); port **only** the visual identity. The proposed stack is a rewrite (shadcn/AI Elements replace hand-written components, they don't layer on top), contradicting that premise and AGENTS.md.
- The CSS-variable setup is already ideal for multi-theme — Tailwind adds nothing for theming here.
- The proposal was internally inconsistent (recommended Vercel AI SDK while also saying "start clean, no AI SDK") and mixed Astronave's brand (Geist) into a Quack rebrand.

## Rejected
- Tailwind v4 + shadcn rewrite — weeks of work, dual styling during transition.
- AI Elements + Vercel AI SDK chat — re-plumbs a working streaming pipeline onto the CLI bridge.
- Hybrid (Tailwind for new screens only) — two coexisting systems long-term.
