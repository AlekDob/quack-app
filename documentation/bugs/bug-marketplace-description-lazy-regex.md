---
type: gotcha
project: quack-app
created: 2026-02-19
last_verified: 2026-02-19
tags: [marketplace, regex, useMarketplace, frontmatter, description]
---
# Bug: Marketplace Description Shows Single Character

## Trigger
Opening the Quack Store — most items displayed only a single letter as their description (e.g. "A" instead of "AI-powered code review assistant").

## Root Cause
In `useMarketplace.ts` → `enrichSkillDescriptions`, the regex for extracting the `description` field from YAML frontmatter used a **lazy quantifier**:

```ts
// BROKEN — (.+?) captures only 1 character, then [\s\S]*?--- consumes the rest
const fmDescMatch = content.match(/^---[\s\S]*?description:\s*(.+?)[\s\S]*?---/);
```

The lazy `(.+?)` matched the **minimum** (1 char), and the following `[\s\S]*?---` happily consumed the rest of the line and the closing `---`.

## Fix
Replace the lazy quantifier with a character class that captures until end-of-line:

```ts
// FIXED — ([^\n]+) captures the entire description line
const fmDescMatch = content.match(/^---[\s\S]*?description:\s*([^\n]+)[\s\S]*?---/);
```

## Lesson
When extracting a value from a known line in a multiline regex, **never use `(.+?)` surrounded by `[\s\S]*?`** — the lazy quantifiers compete and the shortest match wins. Use `([^\n]+)` to anchor to a single line.

## Additional Guard
Added a filter in `StoreItemCard.tsx` to hide descriptions shorter than 5 chars or matching the generic pattern `"from X plugin"`:

```tsx
{resource.description && resource.description.length > 5 &&
 !/from .+ plugin$/i.test(resource.description) && (
  <div className="store-item-description">{resource.description}</div>
)}
```
