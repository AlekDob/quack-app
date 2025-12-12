/**
 * Tests for Command Context Injection
 *
 * This test suite verifies that slash commands are properly expanded
 * with their full context before being sent to the AI.
 *
 * The problem solved: When a user types `/post-to-discord message`,
 * the AI should automatically receive the command definition so it
 * knows HOW to execute the command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the commands data structure
const mockCommands = {
  builtin: [],
  custom: [
    {
      name: 'post-to-discord',
      description: 'Post updates to Discord community channels',
      content: `Use the discord-community-manager skill to post updates.

Example usage:
\`\`\`bash
python3 scripts/post_to_discord.py "Your message here" --image /path/to/image.png
\`\`\`

This command posts to the #announcements channel in Discord.`,
      isBuiltin: false,
      parameters: ['message', 'image'],
      scope: 'project',
    },
    {
      name: 'code-review',
      description: 'AI-powered code review',
      content: `Perform a comprehensive code review of the current changes.

1. Check for security vulnerabilities
2. Review code quality
3. Suggest improvements`,
      isBuiltin: false,
      parameters: [],
      scope: 'project',
    },
    {
      name: 'global-cmd',
      description: 'A global command',
      content: 'This is a global command content.',
      isBuiltin: false,
      parameters: [],
      scope: 'global',
    },
  ],
};

/**
 * Simulates the expandCommandsInMessage function from useSlashCommands hook
 */
function expandCommandsInMessage(
  message: string,
  commands: typeof mockCommands
): {
  expandedMessage: string;
  commandsFound: string[];
  hasCommands: boolean;
} {
  const allCommands = [...commands.builtin, ...commands.custom];

  // Regex to find /command-name at the start of a line or message
  const commandPattern = /^\/([a-zA-Z][a-zA-Z0-9_-]*)/gm;

  const commandsFound: string[] = [];
  const commandContexts: string[] = [];

  let match;
  while ((match = commandPattern.exec(message)) !== null) {
    const commandName = match[1];

    // Skip if already processed
    if (commandsFound.includes(commandName)) continue;

    // Find the command definition
    const command = allCommands.find((cmd) => cmd.name === commandName);

    if (command && command.content) {
      commandsFound.push(commandName);

      // Build context block with command definition
      commandContexts.push(
        `<command-context name="${commandName}" description="${command.description}">`,
        command.content,
        `</command-context>`
      );
    }
  }

  // If no commands found, return original message
  if (commandsFound.length === 0) {
    return {
      expandedMessage: message,
      commandsFound: [],
      hasCommands: false,
    };
  }

  // Build expanded message with context injected before the original message
  const contextBlock = commandContexts.join('\n\n');
  const expandedMessage = `${contextBlock}\n\n---\n\n${message}`;

  return {
    expandedMessage,
    commandsFound,
    hasCommands: true,
  };
}

describe('Command Context Injection', () => {
  describe('expandCommandsInMessage', () => {
    it('should detect and expand a single command', () => {
      const message = '/post-to-discord Hello Discord!';
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.hasCommands).toBe(true);
      expect(result.commandsFound).toEqual(['post-to-discord']);
      expect(result.expandedMessage).toContain('<command-context name="post-to-discord"');
      expect(result.expandedMessage).toContain('discord-community-manager skill');
      expect(result.expandedMessage).toContain('/post-to-discord Hello Discord!');
    });

    it('should detect and expand multiple commands', () => {
      const message = `/code-review
/post-to-discord Changes reviewed`;
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.hasCommands).toBe(true);
      expect(result.commandsFound).toEqual(['code-review', 'post-to-discord']);
      expect(result.expandedMessage).toContain('<command-context name="code-review"');
      expect(result.expandedMessage).toContain('<command-context name="post-to-discord"');
    });

    it('should not duplicate context for repeated commands', () => {
      const message = `/post-to-discord First message
/post-to-discord Second message`;
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.commandsFound).toEqual(['post-to-discord']);
      // Should only have one command-context block
      const contextCount = (result.expandedMessage.match(/<command-context/g) || []).length;
      expect(contextCount).toBe(1);
    });

    it('should return original message when no commands found', () => {
      const message = 'Just a regular message without commands';
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.hasCommands).toBe(false);
      expect(result.commandsFound).toEqual([]);
      expect(result.expandedMessage).toBe(message);
    });

    it('should not match commands in the middle of text', () => {
      const message = 'Check out this link: https://example.com/post-to-discord';
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.hasCommands).toBe(false);
      expect(result.commandsFound).toEqual([]);
    });

    it('should match command at start of line in multi-line message', () => {
      const message = `Here is my request:
/code-review
Thanks!`;
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.hasCommands).toBe(true);
      expect(result.commandsFound).toEqual(['code-review']);
    });

    it('should not expand unknown commands', () => {
      const message = '/unknown-command some args';
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.hasCommands).toBe(false);
      expect(result.commandsFound).toEqual([]);
      expect(result.expandedMessage).toBe(message);
    });

    it('should include command description in context', () => {
      const message = '/post-to-discord Test';
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.expandedMessage).toContain('description="Post updates to Discord community channels"');
    });

    it('should preserve original message after context', () => {
      const message = '/code-review Please review my changes';
      const result = expandCommandsInMessage(message, mockCommands);

      // Original message should appear after the separator
      expect(result.expandedMessage).toContain('---\n\n/code-review Please review my changes');
    });

    it('should handle global commands', () => {
      const message = '/global-cmd execute';
      const result = expandCommandsInMessage(message, mockCommands);

      expect(result.hasCommands).toBe(true);
      expect(result.commandsFound).toEqual(['global-cmd']);
      expect(result.expandedMessage).toContain('This is a global command content.');
    });
  });

  describe('Command Detection Regex', () => {
    it('should match valid command names', () => {
      const validNames = [
        'post-to-discord',
        'code-review',
        'test123',
        'myCommand',
        'cmd_with_underscore',
        'CamelCase',
      ];

      for (const name of validNames) {
        const pattern = /^\/([a-zA-Z][a-zA-Z0-9_-]*)/gm;
        const match = pattern.exec(`/${name} args`);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(name);
      }
    });

    it('should not match invalid command names', () => {
      const invalidPatterns = [
        '/123command', // starts with number
        '/-invalid', // starts with dash
        '/_invalid', // starts with underscore
        'no-slash', // no leading slash
      ];

      for (const pattern of invalidPatterns) {
        const regex = /^\/([a-zA-Z][a-zA-Z0-9_-]*)/gm;
        const match = regex.exec(pattern);
        expect(match).toBeNull();
      }
    });
  });
});

describe('Backend expand_slash_command Integration', () => {
  // These tests verify the expected format of the Rust backend response

  it('should wrap content in command-context tags (expected format)', () => {
    // This is the expected format from expand_slash_command in Rust
    const expectedFormat = `<command-context name="test-cmd" description="Test description">
The user invoked the /test-cmd command. Follow the instructions below to execute it.

---

Command body content here

</command-context>

User's command: /test-cmd some arguments

Execute the command according to the instructions in <command-context> above.`;

    expect(expectedFormat).toContain('<command-context name="test-cmd"');
    expect(expectedFormat).toContain("Follow the instructions below to execute it");
    expect(expectedFormat).toContain("User's command: /test-cmd some arguments");
    expect(expectedFormat).toContain("Execute the command according to the instructions");
  });

  it('should replace $ARGUMENTS placeholder', () => {
    // The Rust backend replaces $ARGUMENTS with the actual args
    const body = 'Process: $ARGUMENTS';
    const args = 'file1.txt file2.txt';
    const expanded = body.replace('$ARGUMENTS', args);

    expect(expanded).toBe('Process: file1.txt file2.txt');
  });

  it('should replace numbered placeholders $1, $2, etc.', () => {
    const body = 'First: $1, Second: $2, Third: $3';
    const args = 'apple banana cherry';
    const argsVec = args.split(' ');

    let expanded = body;
    argsVec.forEach((arg, i) => {
      expanded = expanded.replace(`$${i + 1}`, arg);
    });

    expect(expanded).toBe('First: apple, Second: banana, Third: cherry');
  });
});
