---
type: gotcha
project: quack-app
created: 2026-04-06
last_verified: 2026-04-06
tags: [react, hooks, performance, worktree, infinite-loop]
---
# React Rules of Hooks violation in worktree agent rendering

## Trigger
RepositoryGroup.tsx had `useState` and `useEffect` called inside a `.map()` callback
AND inside an IIFE within JSX — both violate React Rules of Hooks.

## What went wrong
- `useState(false)` at the top of `agents.map((agent) => { ... })` for tooltip state
- `useEffect` with `setInterval` inside the same map callback for tooltip pulse
- `useState` + `useEffect` inside `{(() => { ... })()}` IIFE in JSX for avatar loading

React cannot track hook call order when hooks are inside loops, conditions, or nested
functions. If the number of agents changes between renders, React crashes with
"Rendered fewer hooks than expected."

## Fix
Extracted the entire worktree agent card into `WorktreeAgentCard.tsx` (memo'd component).
All hooks are now at the top level of a proper React component.

Split into 4 files to stay under 300-line limit:
- `WorktreeAgentCard.tsx` — orchestrator (hooks + derived state + layout)
- `WorktreeAgentCard.helpers.ts` — pure calc functions for session state
- `WorktreeAgentCardBody.tsx` — avatar, activity bar, action buttons
- `WorktreeGitMenu.tsx` — git operations dropdown

## Rule
Never call hooks inside `.map()`, `.filter()`, `.reduce()`, ternaries, IIFEs,
or any function that isn't the direct body of a React component or custom hook.
If you need per-item state in a list, extract a component.
