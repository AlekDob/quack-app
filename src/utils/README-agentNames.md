# Agent Names Module

International collection of agent names for Quack App's terminal and agent creation.

## Overview

This module provides **140+ agent names** from various countries and cultures, used throughout the application for random agent name generation.

## Features

- 🌍 **International Coverage**: Names from 15+ countries including:
  - 🇬🇧 English
  - 🇮🇹 Italian
  - 🇫🇷 French
  - 🇪🇸 Spanish
  - 🇩🇪 German
  - 🇵🇹 Portuguese
  - 🇳🇱 Dutch
  - 🇸🇪 Scandinavian
  - 🇷🇺 Russian
  - 🇯🇵 Japanese
  - 🇰🇷 Korean
  - 🇨🇳 Chinese
  - 🇸🇦 Arabic
  - 🇮🇳 Indian

- 🎲 **Smart Random Selection**: Avoids duplicate names when creating agents
- 🔍 **Search Functionality**: Search for names matching a query
- ♻️ **Automatic Fallback**: If all names are taken, appends numbers (e.g., "Agent Jack 2")

## Usage

### Get Random Unique Agent Name

```typescript
import { getRandomAgentName } from './utils/agentNames';

// Get random name (checks for duplicates)
const name = getRandomAgentName(existingAgents, 'project');
// Returns: "Agent Marco" (or any available name)
```

### Get Random Name (No Uniqueness Check)

```typescript
import { getRandomName } from './utils/agentNames';

// Get random name without duplicate checking
const name = getRandomName();
// Returns: "Agent Sakura" (random from list)
```

### Get All Names

```typescript
import { getAllAgentNames } from './utils/agentNames';

const allNames = getAllAgentNames();
// Returns: ["Agent Jack", "Agent Mike", ...]
```

### Search Names

```typescript
import { searchAgentNames } from './utils/agentNames';

const italianNames = searchAgentNames('Marco');
// Returns: ["Agent Marco"]
```

## Where It's Used

1. **NewAgentModal** (`src/components/NewAgentModal.tsx`):
   - Auto-suggests random agent name when creating AI agents
   - Checks for duplicates within scope (global/project)

2. **App.tsx** (`src/App.tsx`):
   - Generates default names for new terminal sessions
   - Provides international variety for terminal agents

3. **NewTerminalModal** (`src/components/NewTerminalModal.tsx`):
   - Can be extended to provide name suggestions for terminals

## Architecture

```
src/utils/agentNames.ts
├── AGENT_NAMES[]           // 140+ international names
├── getRandomAgentName()    // Smart unique selection
├── getRandomName()         // Simple random selection
├── getAllAgentNames()      // Get full list
└── searchAgentNames()      // Search by query
```

## Adding New Names

To add more names, edit `AGENT_NAMES` array in `src/utils/agentNames.ts`:

```typescript
export const AGENT_NAMES = [
  // ... existing names ...

  // Your new names
  'Agent NewName',
  'Agent AnotherName',
];
```

## Migration Notes

This module replaces the old scattered name lists:
- ✅ Replaces `AGENT_NAMES` in `src/components/NewAgentModal.tsx`
- ✅ Replaces `AGENT_NAMES` in `src/App.tsx`
- ✅ Centralized in one reusable module

---

**Quack quack!** 🦆 Built with love by the Quack Agency team!
