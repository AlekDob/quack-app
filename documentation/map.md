---
type: map
project: synara
created: 2026-08-03
last_verified: 2026-08-05
tags: [map, navigation]
---

# Documentation map

## Start here

- `.docs/encyclopedia.md` — domain glossary (legacy path still authoritative)
- `.docs/architecture.md` — system architecture
- `documentation/features/` — living feature map (components, not changes)
- `documentation/bugs/` — incident records for fixed/open regressions

## Feature map

| Doc                                                              | Component                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `documentation/features/001-pending-user-input.md`               | Pending user input / AskUserQuestion composer card                  |
| `documentation/features/002-brand-mark.md`                       | Quack brand mark / app icons / `SynaraLogo`                         |
| `documentation/features/003-paperi.md`                           | Paperi composer agents / Tab cycling                                |
| `documentation/features/004-quack-completion-sound.md`           | Quack completion sound / task notifications                         |
| `documentation/features/006-usage-notch-monitor.md`              | macOS notch provider usage and limits monitor                       |
| `documentation/features/008-sidebar-thread-creation-skeleton.md` | Sidebar placeholder while a new thread is being created             |
| `documentation/features/009-background-browser-automation.md`    | Agent browser runtime without automatic focus or pane switching     |
| `documentation/features/010-sidebar-thread-archive.md`           | Sidebar archive / already-archived races / optimistic hide          |
| `documentation/features/011-thread-detail-subscriptions.md`      | EventRouter detail lease identity under streaming                   |
| `documentation/features/012-pending-interaction-claim.md`        | Shared pending-interaction claim + stale turn settle                |
| `documentation/features/015-composer-activity-strip.md`          | Unified composer strip: subagents + background browser/command work |
| `documentation/features/017-astronaut-remote-provider.md`        | Astronaut remoto con sessioni, memoria e import da Tailscale        |

## Recent bugs

| Doc                                                              | Topic                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| `documentation/bugs/2026-08-05-archive-stuck-spinner.md`         | Archive spinner + false failure toast                 |
| `documentation/bugs/2026-08-05-thread-visibility-regressions.md` | Invisible replies / missing new threads until restart |

## Recent recaps

| Doc                                                       | Topic                                       |
| --------------------------------------------------------- | ------------------------------------------- |
| `documentation/recaps/thread-visibility-regressions.md`   | Archive + upstream thread visibility ports  |
| `documentation/recaps/pending-user-input-other-option.md` | Synthetic Other option on pending questions |
| `documentation/recaps/quack-brand-mark-duck-assets.md`    | Duck mark raster assets + theme swap        |

## Historical (do not use as live source)

- `docs/RECAP-*.md` — older ad-hoc recaps; prefer `documentation/recaps/` going forward
- `.plans/`, `advisor-plans/`, `audit/` — execution history; not the knowledge map
