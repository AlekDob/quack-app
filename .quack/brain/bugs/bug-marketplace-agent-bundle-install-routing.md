---
type: bug_fix
project: quack-app
created: 2026-02-10
tags: [marketplace, agent-bundles, routing, mac, windows]
---

# Bug: Agent Bundle Install Failed - Wrong Function Called

## Problem

Users (both Mac and Windows) couldn't install agent bundles (Agent Jack, Agent Fredric, Agent Roberta, etc.) from the Quack Store Featured section. Clicking "Get" showed "Failed to install" toast.

**Visible in screenshot**: User tried installing "Agent Fredric" and "Agent Roberta" from Featured grid — both failed.

**Root cause**: `QuackStoreDrawer.tsx` called `installResource()` for ALL resources, including agent bundles. But `installResource()` only handles individual resources with `_skillPath`, `_commandPath`, `_agentPath`, or `_rulePath`. Agent bundles have `_agentTemplate` instead.

```typescript
// In installResource() - line 459
} else {
  throw new Error('Unknown resource type');  // ❌ Agent bundles hit this
}
```

Agent bundles (category `agent-bundles`) don't fit any of the if/else branches, so they fall through to `else` → throw error → catch shows "Failed to install".

## Solution

Updated `handleInstall` in `QuackStoreDrawer.tsx` to detect agent bundles and route to the correct function:

```typescript
const handleInstall = async (resource: MarketplaceResource, scope: 'global' | 'project' = 'global') => {
  const projectPath = selectedSession?.projectPath;
  const projectName = selectedSession?.projectName || 'default';
  const toastId = toast.loading(`Installing ${resource.name}...`);

  try {
    // ✅ NEW: Detect agent bundles and use installAgentBundle()
    if (resource.category === 'agent-bundles') {
      if (!projectPath) {
        toast.error('Open a project first to install agent bundles', { id: toastId });
        return false;
      }
      await installAgentBundle(resource, projectPath, projectName);
      toast.success(`${resource.name} installed`, { id: toastId, duration: 4000 });
      onRefresh?.();
      return true;
    }

    // Regular resources: skills, commands, agents (droids), rules
    const success = await installResource(resource, scope, projectPath);
    // ...
  }
}
```

## Why Agent Bundles Are Different

| Resource Type | Category | Install Function | What It Does |
|--------------|----------|------------------|--------------|
| Skill | `skills` | `installResource` | Downloads 1 SKILL.md file |
| Command | `commands` | `installResource` | Downloads 1 .md file |
| Droid | `droids` or `agents` | `installResource` | Downloads 1 .md file |
| Rule | `rules` | `installResource` | Downloads 1 .md file |
| **Agent Bundle** | `agent-bundles` | `installAgentBundle` | Downloads multiple skills + rules + creates UnifiedAgent |

Agent bundles require:
- `projectPath` and `projectName` (bundles create agents tied to projects)
- Download and install multiple bundled plugins (skills/rules)
- Create a `UnifiedAgent` with personality, color, avatar, etc.

## Files Changed

**File**: `src/components/QuackStoreDrawer.tsx`

1. Import `installAgentBundle` from hook (line 21)
2. Updated `handleInstall` function (lines 62-86)
3. Check for `resource.category === 'agent-bundles'`
4. Require active project or show clear error message

## User Experience

**Before**:
- Click "Get" on Agent Jack → "Failed to install" (cryptic error)

**After**:
- Click "Get" on Agent Jack with project open → Agent installed with skills/rules
- Click "Get" on Agent Jack without project → "Open a project first to install agent bundles" (clear guidance)

## Testing

- TypeScript compiles without errors
- Featured bundles now installable when project is open
- Clear error when no project selected

## Related

Agent bundles are featured resources (`r.featured === true`) and appear in:
- Hero banner (first featured)
- Featured grid (remaining featured)

Individual droids/agents (non-bundle) still use `installResource()` correctly.
