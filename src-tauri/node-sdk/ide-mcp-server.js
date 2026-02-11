#!/usr/bin/env node

/**
 * IDE MCP Server (stdio-based)
 *
 * Universal MCP server for interacting with any IDE installed on the system.
 * This is a "bridge" that translates universal commands into IDE-specific CLI calls.
 *
 * Supported IDEs:
 * - VS Code, Cursor, Windsurf, Zed
 * - JetBrains: IntelliJ, WebStorm, PyCharm, GoLand, RubyMine
 * - Sublime Text
 *
 * Tools provided:
 * - ide_detect_installed: Detect all installed IDEs
 * - ide_get_config: Get current IDE configuration
 * - ide_set_preferred: Set preferred IDE
 * - ide_open: Open file in IDE (with optional line/column)
 * - ide_open_multiple: Open multiple files in tabs
 * - ide_open_project: Open project folder
 * - ide_show_diff: Show diff between two files
 * - ide_reveal_in_explorer: Reveal file in IDE sidebar
 * - ide_focus: Bring IDE to foreground
 * - ide_arrange_side_by_side: Arrange Quack and IDE windows
 * - ide_sync_focus: Bring both apps to foreground
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync, spawn, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir, platform } from 'os';

// =============================================================================
// STORAGE PATH
// =============================================================================

function getTauriStorePath() {
  const os = platform();
  const home = homedir();

  if (os === 'darwin') {
    return join(home, 'Library', 'Application Support', 'com.quack.terminal');
  } else if (os === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'com.quack.terminal');
  } else {
    return join(home, '.local', 'share', 'com.quack.terminal');
  }
}

const IDE_CONFIG_PATH = join(getTauriStorePath(), 'ide-config.json');

// =============================================================================
// IDE REGISTRY - Universal IDE definitions
// =============================================================================

const IDE_REGISTRY = {
  // VS Code Family
  vscode: {
    name: 'Visual Studio Code',
    bundleId: 'com.microsoft.VSCode',
    cli: 'code',
    appPath: '/Applications/Visual Studio Code.app',
    cliStyle: 'vscode', // --goto file:line:col
    supportsDiff: true,
  },
  cursor: {
    name: 'Cursor',
    bundleId: 'com.todesktop.230313mzl4w4u92',
    cli: 'cursor',
    appPath: '/Applications/Cursor.app',
    cliStyle: 'vscode',
    supportsDiff: true,
  },
  windsurf: {
    name: 'Windsurf',
    bundleId: 'com.codeium.windsurf',
    cli: 'windsurf',
    appPath: '/Applications/Windsurf.app',
    cliStyle: 'vscode',
    supportsDiff: false,
  },

  // Zed
  zed: {
    name: 'Zed',
    bundleId: 'dev.zed.Zed',
    cli: 'zed',
    appPath: '/Applications/Zed.app',
    cliStyle: 'zed', // file:line
    supportsDiff: false,
  },

  // JetBrains Family
  intellij: {
    name: 'IntelliJ IDEA',
    bundleId: 'com.jetbrains.intellij',
    cli: 'idea',
    appPath: '/Applications/IntelliJ IDEA.app',
    cliStyle: 'jetbrains', // --line N file
    supportsDiff: true,
  },
  webstorm: {
    name: 'WebStorm',
    bundleId: 'com.jetbrains.WebStorm',
    cli: 'webstorm',
    appPath: '/Applications/WebStorm.app',
    cliStyle: 'jetbrains',
    supportsDiff: true,
  },
  pycharm: {
    name: 'PyCharm',
    bundleId: 'com.jetbrains.pycharm',
    cli: 'pycharm',
    appPath: '/Applications/PyCharm.app',
    cliStyle: 'jetbrains',
    supportsDiff: true,
  },
  goland: {
    name: 'GoLand',
    bundleId: 'com.jetbrains.goland',
    cli: 'goland',
    appPath: '/Applications/GoLand.app',
    cliStyle: 'jetbrains',
    supportsDiff: true,
  },
  rubymine: {
    name: 'RubyMine',
    bundleId: 'com.jetbrains.rubymine',
    cli: 'rubymine',
    appPath: '/Applications/RubyMine.app',
    cliStyle: 'jetbrains',
    supportsDiff: true,
  },

  // Sublime
  sublime: {
    name: 'Sublime Text',
    bundleId: 'com.sublimetext.4',
    cli: 'subl',
    appPath: '/Applications/Sublime Text.app',
    cliStyle: 'sublime', // file:line
    supportsDiff: false,
  },
};

// =============================================================================
// CONFIGURATION MANAGEMENT
// =============================================================================

function loadConfig() {
  try {
    if (!existsSync(IDE_CONFIG_PATH)) {
      return { preferredIDE: null, autoLaunch: false, syncFocus: true };
    }
    return JSON.parse(readFileSync(IDE_CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error(`[IDE-MCP] Error loading config: ${error.message}`);
    return { preferredIDE: null, autoLaunch: false, syncFocus: true };
  }
}

function saveConfig(config) {
  try {
    const dir = getTauriStorePath();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(IDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`[IDE-MCP] Error saving config: ${error.message}`);
    return false;
  }
}

// =============================================================================
// IDE DETECTION
// =============================================================================

function detectInstalledIDEs() {
  const installed = [];

  for (const [id, ide] of Object.entries(IDE_REGISTRY)) {
    // Check if app exists
    const appExists = existsSync(ide.appPath);

    // Check if CLI is available
    let cliAvailable = false;
    try {
      execSync(`which ${ide.cli}`, { stdio: 'pipe' });
      cliAvailable = true;
    } catch {
      cliAvailable = false;
    }

    if (appExists || cliAvailable) {
      installed.push({
        id,
        name: ide.name,
        appPath: ide.appPath,
        cli: ide.cli,
        cliAvailable,
        appExists,
        supportsDiff: ide.supportsDiff,
      });
    }
  }

  return installed;
}

// =============================================================================
// FILE OPERATIONS (Universal)
// =============================================================================

function buildOpenCommand(ideId, filePath, line, column) {
  const ide = IDE_REGISTRY[ideId];
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`);

  const args = [];

  switch (ide.cliStyle) {
    case 'vscode':
      // VS Code, Cursor, Windsurf: code --goto file:line:column
      if (line) {
        args.push('--goto', `${filePath}:${line}${column ? ':' + column : ''}`);
      } else {
        args.push(filePath);
      }
      break;

    case 'zed':
      // Zed: zed file:line
      if (line) {
        args.push(`${filePath}:${line}`);
      } else {
        args.push(filePath);
      }
      break;

    case 'jetbrains':
      // JetBrains: idea --line N file
      if (line) {
        args.push('--line', line.toString(), filePath);
      } else {
        args.push(filePath);
      }
      break;

    case 'sublime':
      // Sublime: subl file:line
      if (line) {
        args.push(`${filePath}:${line}`);
      } else {
        args.push(filePath);
      }
      break;

    default:
      args.push(filePath);
  }

  return { cli: ide.cli, args };
}

function openFileInIDE(ideId, filePath, line, column) {
  const { cli, args } = buildOpenCommand(ideId, filePath, line, column);

  console.error(`[IDE-MCP] Opening: ${cli} ${args.join(' ')}`);

  const proc = spawn(cli, args, {
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();

  const ide = IDE_REGISTRY[ideId];
  return `Opened ${filePath}${line ? `:${line}` : ''} in ${ide.name}`;
}

function openMultipleFiles(ideId, paths) {
  const ide = IDE_REGISTRY[ideId];
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`);

  // Most IDEs accept multiple file arguments
  const args = [...paths];

  console.error(`[IDE-MCP] Opening multiple: ${ide.cli} ${args.join(' ')}`);

  const proc = spawn(ide.cli, args, {
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();

  return `Opened ${paths.length} files in ${ide.name}`;
}

function openProject(ideId, projectPath) {
  const ide = IDE_REGISTRY[ideId];
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`);

  console.error(`[IDE-MCP] Opening project: ${ide.cli} ${projectPath}`);

  const proc = spawn(ide.cli, [projectPath], {
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();

  return `Opened project ${projectPath} in ${ide.name}`;
}

function showDiff(ideId, file1, file2) {
  const ide = IDE_REGISTRY[ideId];
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`);

  if (!ide.supportsDiff) {
    return `${ide.name} does not support diff command. Open files manually to see Git diff.`;
  }

  let args = [];
  switch (ide.cliStyle) {
    case 'vscode':
      args = ['--diff', file1, file2];
      break;
    case 'jetbrains':
      args = ['diff', file1, file2];
      break;
    default:
      return `Diff not supported for ${ide.name}`;
  }

  console.error(`[IDE-MCP] Showing diff: ${ide.cli} ${args.join(' ')}`);

  const proc = spawn(ide.cli, args, {
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();

  return `Opened diff view in ${ide.name}`;
}

// =============================================================================
// WINDOW MANAGEMENT (macOS)
// =============================================================================

function focusIDE(ideId) {
  const ide = IDE_REGISTRY[ideId];
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`);

  if (platform() !== 'darwin') {
    return 'Window management only supported on macOS';
  }

  const script = `tell application "${ide.name}" to activate`;

  try {
    execSync(`osascript -e '${script}'`);
    return `${ide.name} brought to foreground`;
  } catch (error) {
    return `Failed to focus ${ide.name}: ${error.message}`;
  }
}

function arrangeWindowsSideBySide(ideId) {
  const ide = IDE_REGISTRY[ideId];
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`);

  if (platform() !== 'darwin') {
    return 'Window arrangement only supported on macOS';
  }

  // Use a more reliable approach: NSScreen for screen size, separate commands for each window
  // This avoids issues with Finder's desktop bounds which can fail in some configurations
  const script = `
    use framework "Foundation"
    use framework "AppKit"
    use scripting additions

    -- Get screen size using NSScreen (more reliable than Finder)
    set mainScreen to current application's NSScreen's mainScreen()
    set screenFrame to mainScreen's frame()
    set screenWidth to (item 1 of item 2 of screenFrame) as integer
    set screenHeight to (item 2 of item 2 of screenFrame) as integer

    -- Menu bar height offset
    set menuBarHeight to 25

    -- Calculate window dimensions
    set halfWidth to screenWidth / 2
    set windowHeight to screenHeight - menuBarHeight

    -- First, activate Quack to ensure it has a window
    tell application "Quack" to activate
    delay 0.2

    -- Position Quack on left half
    tell application "System Events"
      try
        tell process "Quack"
          if exists window 1 then
            set position of window 1 to {0, menuBarHeight}
            set size of window 1 to {halfWidth, windowHeight}
          end if
        end tell
      on error errMsg
        log "Quack positioning error: " & errMsg
      end try
    end tell

    -- Activate and position IDE on right half
    tell application "${ide.name}" to activate
    delay 0.2

    tell application "System Events"
      try
        tell process "${ide.name}"
          if exists window 1 then
            set position of window 1 to {halfWidth, menuBarHeight}
            set size of window 1 to {halfWidth, windowHeight}
          end if
        end tell
      on error errMsg
        log "IDE positioning error: " & errMsg
      end try
    end tell

    -- Bring Quack back to front
    delay 0.1
    tell application "Quack" to activate

    return "arranged"
  `;

  try {
    // Use spawn for better handling of the AppleScript
    const { execSync } = require('child_process');
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 10000,
      encoding: 'utf8',
    });
    console.error(`[IDE-MCP] AppleScript result: ${result}`);
    return `Windows arranged: Quack (left) | ${ide.name} (right)`;
  } catch (error) {
    console.error(`[IDE-MCP] AppleScript error: ${error.message}`);
    // Check for common issues
    if (error.message.includes('assistive') || error.message.includes('not allowed')) {
      return `Failed to arrange windows: macOS requires Accessibility permission for Quack. Go to System Preferences > Security & Privacy > Privacy > Accessibility and add Quack.`;
    }
    return `Failed to arrange windows: ${error.message}`;
  }
}

function syncFocus(ideId) {
  const ide = IDE_REGISTRY[ideId];
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`);

  if (platform() !== 'darwin') {
    return 'Focus sync only supported on macOS';
  }

  // Bring both apps to foreground (IDE behind, Quack in front)
  const script = `
    tell application "${ide.name}" to activate
    delay 0.1
    tell application "Quack" to activate
  `;

  try {
    execSync(`osascript -e '${script}'`);
    return `Both Quack and ${ide.name} brought to foreground`;
  } catch (error) {
    return `Failed to sync focus: ${error.message}`;
  }
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  // === CONFIGURATION ===
  {
    name: 'ide_detect_installed',
    description: 'Detect all installed IDEs on the system. Returns a list of available IDEs with their CLI availability.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ide_get_config',
    description: 'Get current IDE configuration including preferred IDE and settings.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ide_set_preferred',
    description: 'Set the preferred IDE for all operations. Use ide_detect_installed first to see available options.',
    inputSchema: {
      type: 'object',
      properties: {
        ideId: {
          type: 'string',
          description: 'IDE identifier: vscode, cursor, windsurf, zed, intellij, webstorm, pycharm, goland, rubymine, sublime',
        },
        autoLaunch: {
          type: 'boolean',
          description: 'Auto-launch IDE when Quack starts',
        },
        syncFocus: {
          type: 'boolean',
          description: 'Sync focus between Quack and IDE',
        },
      },
      required: ['ideId'],
    },
  },

  // === FILE OPERATIONS ===
  {
    name: 'ide_open',
    description: 'Open a file in the preferred IDE. Optionally jump to a specific line and column. Works with any configured IDE.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the file',
        },
        line: {
          type: 'number',
          description: 'Line number to jump to (1-based)',
        },
        column: {
          type: 'number',
          description: 'Column number (1-based)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'ide_open_multiple',
    description: 'Open multiple files in IDE tabs. Useful after an agent makes changes to several files.',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of absolute file paths to open',
        },
      },
      required: ['paths'],
    },
  },
  {
    name: 'ide_open_project',
    description: 'Open a project folder in the IDE.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the project folder',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'ide_show_diff',
    description: 'Open diff view between two files in the IDE. Not all IDEs support this.',
    inputSchema: {
      type: 'object',
      properties: {
        file1: {
          type: 'string',
          description: 'First file path (original)',
        },
        file2: {
          type: 'string',
          description: 'Second file path (modified)',
        },
      },
      required: ['file1', 'file2'],
    },
  },

  // === WINDOW MANAGEMENT ===
  {
    name: 'ide_focus',
    description: 'Bring the IDE window to foreground (macOS only).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ide_arrange_side_by_side',
    description: 'Arrange Quack and IDE windows side-by-side. Quack on left, IDE on right (macOS only).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ide_sync_focus',
    description: 'Bring both Quack and IDE windows to foreground together (macOS only).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // === IDE CONTEXT ===
  {
    name: 'ide_get_context',
    description: 'Get current IDE context: which IDE extensions are running, which workspaces they have open. NOTE: The active file, selection, and diagnostics are automatically injected into your prompt at message send time. Use this tool to check IDE connectivity or refresh context mid-conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: {
          type: 'string',
          description: 'Optional workspace path to filter results. If omitted, returns all connected IDEs.',
        },
      },
    },
  },
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================

async function handleDetectInstalled() {
  const installed = detectInstalledIDEs();

  return JSON.stringify({
    installedCount: installed.length,
    ides: installed,
    recommendation: installed.length > 0 ? installed[0].id : null,
  }, null, 2);
}

async function handleGetConfig() {
  const config = loadConfig();
  const installed = detectInstalledIDEs();

  return JSON.stringify({
    ...config,
    installedIDEs: installed.map(i => i.id),
    preferredIDEInfo: config.preferredIDE ? IDE_REGISTRY[config.preferredIDE] : null,
  }, null, 2);
}

async function handleSetPreferred(args) {
  const { ideId, autoLaunch, syncFocus } = args;

  // Validate IDE exists
  if (!IDE_REGISTRY[ideId]) {
    return `Error: Unknown IDE "${ideId}". Valid options: ${Object.keys(IDE_REGISTRY).join(', ')}`;
  }

  // Check if installed
  const installed = detectInstalledIDEs();
  const isInstalled = installed.some(i => i.id === ideId);

  if (!isInstalled) {
    return `Warning: ${IDE_REGISTRY[ideId].name} does not appear to be installed. Setting preference anyway.`;
  }

  const config = loadConfig();
  config.preferredIDE = ideId;
  if (autoLaunch !== undefined) config.autoLaunch = autoLaunch;
  if (syncFocus !== undefined) config.syncFocus = syncFocus;

  const saved = saveConfig(config);

  if (!saved) {
    return 'Error: Failed to save configuration';
  }

  return `Preferred IDE set to ${IDE_REGISTRY[ideId].name}`;
}

async function handleOpen(args) {
  const config = loadConfig();
  const ideId = config.preferredIDE;

  if (!ideId) {
    return 'Error: No preferred IDE set. Use ide_set_preferred first.';
  }

  return openFileInIDE(ideId, args.path, args.line, args.column);
}

async function handleOpenMultiple(args) {
  const config = loadConfig();
  const ideId = config.preferredIDE;

  if (!ideId) {
    return 'Error: No preferred IDE set. Use ide_set_preferred first.';
  }

  return openMultipleFiles(ideId, args.paths);
}

async function handleOpenProject(args) {
  const config = loadConfig();
  const ideId = config.preferredIDE;

  if (!ideId) {
    return 'Error: No preferred IDE set. Use ide_set_preferred first.';
  }

  return openProject(ideId, args.path);
}

async function handleShowDiff(args) {
  const config = loadConfig();
  const ideId = config.preferredIDE;

  if (!ideId) {
    return 'Error: No preferred IDE set. Use ide_set_preferred first.';
  }

  return showDiff(ideId, args.file1, args.file2);
}

async function handleFocus() {
  const config = loadConfig();
  const ideId = config.preferredIDE;

  if (!ideId) {
    return 'Error: No preferred IDE set. Use ide_set_preferred first.';
  }

  return focusIDE(ideId);
}

async function handleArrangeSideBySide() {
  const config = loadConfig();
  const ideId = config.preferredIDE;

  if (!ideId) {
    return 'Error: No preferred IDE set. Use ide_set_preferred first.';
  }

  return arrangeWindowsSideBySide(ideId);
}

async function handleSyncFocus() {
  const config = loadConfig();
  const ideId = config.preferredIDE;

  if (!ideId) {
    return 'Error: No preferred IDE set. Use ide_set_preferred first.';
  }

  return syncFocus(ideId);
}

// =============================================================================
// IDE CONTEXT DISCOVERY (Claude Code extension lock files)
// =============================================================================

/**
 * Check if a PID is alive.
 */
function isPidAlive(pid) {
  try {
    if (platform() === 'win32') {
      const result = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8' });
      return result.stdout && result.stdout.includes(String(pid));
    }
    // Unix: kill -0 checks existence without sending a signal
    const result = spawnSync('kill', ['-0', String(pid)], { encoding: 'utf8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Discover Claude Code IDE extension instances from lock files.
 * Lock files are at ~/.claude/ide/[port].lock
 */
function discoverIdeInstances(workspacePath) {
  const ideDir = join(homedir(), '.claude', 'ide');

  if (!existsSync(ideDir)) {
    return { instances: [], message: 'No ~/.claude/ide/ directory found. Is the Claude Code IDE extension installed?' };
  }

  let files;
  try {
    files = readdirSync(ideDir).filter(f => f.endsWith('.lock'));
  } catch {
    return { instances: [], message: 'Could not read ~/.claude/ide/ directory.' };
  }

  if (files.length === 0) {
    return { instances: [], message: 'No IDE extension instances found. Make sure VSCode/Cursor has the Claude Code extension active.' };
  }

  const instances = [];

  for (const file of files) {
    const port = parseInt(basename(file, '.lock'), 10);
    if (isNaN(port)) continue;

    try {
      const content = readFileSync(join(ideDir, file), 'utf8');
      const lock = JSON.parse(content);

      // Validate PID
      if (!isPidAlive(lock.pid)) {
        console.error(`[IDE-MCP] Stale lock file ${file} (pid ${lock.pid} not alive)`);
        continue;
      }

      const instance = {
        port,
        pid: lock.pid,
        ideName: lock.ideName || 'Unknown IDE',
        workspaceFolders: lock.workspaceFolders || [],
        transport: lock.transport || 'ws',
      };

      // Filter by workspace if provided
      if (workspacePath) {
        const normalized = workspacePath.replace(/\/$/, '');
        const matches = instance.workspaceFolders.some(folder => {
          const folderNorm = folder.replace(/\/$/, '');
          return normalized === folderNorm || normalized.startsWith(folderNorm + '/');
        });
        if (!matches) continue;
      }

      instances.push(instance);
    } catch (e) {
      console.error(`[IDE-MCP] Failed to parse lock file ${file}: ${e.message}`);
    }
  }

  return {
    instances,
    message: instances.length > 0
      ? `Found ${instances.length} connected IDE instance(s).`
      : workspacePath
        ? `No IDE extension found for workspace: ${workspacePath}`
        : 'No active IDE extension instances found.',
  };
}

async function handleGetContext(args) {
  const result = discoverIdeInstances(args?.workspacePath);

  return JSON.stringify({
    ...result,
    note: 'Active file, selection, and diagnostics are automatically injected into your prompt. This tool shows IDE connectivity status.',
  }, null, 2);
}

// =============================================================================
// MAIN SERVER
// =============================================================================

const server = new Server(
  {
    name: 'ide-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'ide_detect_installed':
        result = await handleDetectInstalled();
        break;
      case 'ide_get_config':
        result = await handleGetConfig();
        break;
      case 'ide_set_preferred':
        result = await handleSetPreferred(args);
        break;
      case 'ide_open':
        result = await handleOpen(args);
        break;
      case 'ide_open_multiple':
        result = await handleOpenMultiple(args);
        break;
      case 'ide_open_project':
        result = await handleOpenProject(args);
        break;
      case 'ide_show_diff':
        result = await handleShowDiff(args);
        break;
      case 'ide_focus':
        result = await handleFocus();
        break;
      case 'ide_arrange_side_by_side':
        result = await handleArrangeSideBySide();
        break;
      case 'ide_sync_focus':
        result = await handleSyncFocus();
        break;
      case 'ide_get_context':
        result = await handleGetContext(args);
        break;
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[IDE-MCP] Server started - Universal IDE integration ready');
}

main().catch(console.error);
