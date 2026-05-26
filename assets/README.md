---
type: slot-readme
slot: assets        # "data" or "assets"
project: quack-app
updated: 2026-05-26
---

# assets/

One paragraph: what this slot holds in this project, and the line between
`data/` and `assets/` for this project. (E.g. "Tabular vendor inputs and exports
here; raw binary source files in `assets/`.")

## Subfolders

| Path | Contents | Source | Consumed by | Retention |
|---|---|---|---|---|
| `example-subfolder/` | Replace with real entries | Where the files come from | Who/what reads them | archive forever |

## Conventions

- Free-form rules per project — naming patterns, file-format rules, things not to store here.
- Example: "Vendor input data lives under `vendors/<vendor-slug>/`."
- Example: "Exports we generate are date-prefixed: `YYYY-MM-DD-<purpose>.csv`."
- Example: "Don't store secrets, PII, or credential dumps in this slot."

<!--
Retention values:
  archive forever     — never delete (historical record)
  rotate <period>     — replace at known cadence (e.g. "rotate quarterly")
  delete after import — transient, removed once consumed
  keep until <cond>   — bounded by external condition

See ~/.claude/skills/project-ops/references/data-vs-assets.md for the full reference.
-->
