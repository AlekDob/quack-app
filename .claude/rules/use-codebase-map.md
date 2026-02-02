---
description: "Use Codebase Map for fast navigation - read .quack/codebase-map.md before exploring code"
---
# Codebase Map - Fast Code Navigation

You have access to a **Codebase Map** at `.quack/codebase-map.md` in the project root. This is an auto-generated index of all TypeScript/JavaScript exports in the project.

## When to Use

**ALWAYS read the codebase map BEFORE doing exploratory searches.** This saves multiple Glob/Grep/Read tool calls.

Instead of:
```
Glob "src/**/*.ts" -> Grep "functionName" -> Read 3-4 files -> find the right one
```

Do this:
```
Read ".quack/codebase-map.md" -> find exact file:export -> Read that one file
```

## Rules

1. **Read map first**: Before any code exploration, check if `.quack/codebase-map.md` exists and read it
2. **Go direct**: Once you find the export you need, read that specific file
3. **Map may not exist**: If the file doesn't exist, fall back to normal Glob/Grep exploration
4. **Map is auto-updated**: A PostToolUse hook keeps it current when files are written
5. **One Read saves many**: Reading the map (~200-400 lines) is cheaper than 5-10 exploratory tool calls

## When to Skip the Map

- You already know the exact file path
- You're looking for content inside a file (not exports)
- The task is about non-code files (config, docs, etc.)
