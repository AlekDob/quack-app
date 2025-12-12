# Command Context Injection

## Problem

When a user types a slash command like `/post-to-discord message`, the AI assistant would not automatically know how to execute the command because it only received the raw text without the command definition.

**Example of the problem:**
- User types: `/post-to-discord Hello Discord!`
- AI receives: `/post-to-discord Hello Discord!`
- AI doesn't know that there's a Python script to call

## Solution

Modified the command expansion system to wrap command content in `<command-context>` tags, providing the AI with full context about how to execute commands.

### How It Works

1. When a user sends a message starting with `/command-name`, `ChatView.tsx` intercepts it
2. It calls the Rust backend function `expand_slash_command`
3. The backend reads the command file from `.claude/commands/command-name.md`
4. It wraps the content in a structured format that tells the AI exactly what to do

### Expanded Message Format

```xml
<command-context name="post-to-discord" description="Post updates to Discord community channels">
The user invoked the /post-to-discord command. Follow the instructions below to execute it.

---

[Command content from .claude/commands/post-to-discord.md]

</command-context>

User's command: /post-to-discord Hello Discord!

Execute the command according to the instructions in <command-context> above.
```

## Files Modified

### Backend (Rust)
- `src-tauri/src/slash_commands.rs`
  - Updated `expand_slash_command` function to wrap content in `<command-context>` tags
  - Added clear instructions for the AI to follow

### Frontend (TypeScript)
- `src/hooks/useSlashCommands.ts`
  - Added `expandCommandsInMessage` helper function for client-side expansion
  - Useful for scenarios where backend expansion isn't available

### Tests
- `src/tests/commandContextInjection.test.ts`
  - 15 test cases covering:
    - Single command expansion
    - Multiple command expansion
    - Duplicate command handling
    - Unknown command handling
    - Command detection regex
    - Placeholder replacement ($ARGUMENTS, $1, $2, etc.)

## Benefits

1. **Automatic Context**: AI always knows how to execute custom commands
2. **No Manual Reading**: No need to explicitly tell the AI to read command files
3. **Backward Compatible**: Works with existing commands without modification
4. **Clear Structure**: XML tags provide unambiguous context boundaries

## Testing

```bash
# Run command injection tests
npm test -- --run src/tests/commandContextInjection.test.ts

# All 15 tests should pass
```

## Example Usage

Create a command in `.claude/commands/my-command.md`:

```markdown
---
name: my-command
description: Does something useful
parameters: [arg1, arg2]
---

Execute this task:
1. Step one with $1
2. Step two with $2
3. Final step with $ARGUMENTS
```

Then use it:
```
/my-command value1 value2
```

The AI will receive the full context and know exactly how to execute it.
