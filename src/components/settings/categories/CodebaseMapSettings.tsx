import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import { useSessionStore } from '../../../stores/sessionStore';

interface MapStats {
  lastGenerated: string;
  fileCount: number;
  exportCount: number;
}

interface Hook {
  id: string;
  name: string;
  type: string;
  matcher: string;
  command: string;
  enabled: boolean;
  scope: string;
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

interface ProjectMapState {
  projectPath: string;
  projectName: string;
  hookEnabled: boolean;
  mapExists: boolean;
  stats: MapStats;
  isGenerating: boolean;
  feedback: string;
}

const SCRIPT_NAME = 'generate-codebase-map.mjs';
const RULE_FILENAME = 'use-codebase-map.md';
const CODEBASE_MAP_RULE = `---
description: "Use Codebase Map for fast navigation - read .quack/codebase-map.md before exploring code"
---
# Codebase Map - Fast Code Navigation

You have access to a **Codebase Map** at \`.quack/codebase-map.md\` in the project root. This is an auto-generated index of all TypeScript/JavaScript exports in the project.

## When to Use

**ALWAYS read the codebase map BEFORE doing exploratory searches.** This saves multiple Glob/Grep/Read tool calls.

Instead of:
\`\`\`
Glob "src/**/*.ts" -> Grep "functionName" -> Read 3-4 files -> find the right one
\`\`\`

Do this:
\`\`\`
Read ".quack/codebase-map.md" -> find exact file:export -> Read that one file
\`\`\`

## Rules

1. **Read map first**: Before any code exploration, check if \`.quack/codebase-map.md\` exists and read it
2. **Go direct**: Once you find the export you need, read that specific file
3. **Map may not exist**: If the file doesn't exist, fall back to normal Glob/Grep exploration
4. **Map is auto-updated**: A PostToolUse hook keeps it current when files are written
5. **One Read saves many**: Reading the map (~200-400 lines) is cheaper than 5-10 exploratory tool calls

## When to Skip the Map

- You already know the exact file path
- You're looking for content inside a file (not exports)
- The task is about non-code files (config, docs, etc.)
`;

const DEFAULT_STATS: MapStats = {
  lastGenerated: 'Never',
  fileCount: 0,
  exportCount: 0,
};

async function getGlobalScriptPath(): Promise<string> {
  const home = await homeDir();
  const sep = home.endsWith('/') ? '' : '/';
  return `${home}${sep}.quack/scripts/${SCRIPT_NAME}`;
}

async function ensureScript(quackAppPath: string): Promise<string> {
  const home = await homeDir();
  const sep = home.endsWith('/') ? '' : '/';
  const dir = `${home}${sep}.quack/scripts`;
  const target = `${dir}/${SCRIPT_NAME}`;

  try {
    await invoke<string>('read_file_content', { path: target });
    return target;
  } catch {
    await invoke<CommandResult>('execute_command', {
      command: `mkdir -p ${dir}`,
      cwd: quackAppPath,
    });
    await invoke<CommandResult>('execute_command', {
      command: `cp ${quackAppPath}/scripts/${SCRIPT_NAME} ${target}`,
      cwd: quackAppPath,
    });
    return target;
  }
}

function parseStats(content: string): MapStats {
  let lastGenerated = 'Never';
  let fileCount = 0;
  let exportCount = 0;

  for (const line of content.split('\n')) {
    const g = line.match(/^generated:\s*(.+)/);
    if (g) lastGenerated = g[1].trim();
    const f = line.match(/^files:\s*(\d+)/);
    if (f) fileCount = parseInt(f[1], 10);
    const e = line.match(/^exports:\s*(\d+)/);
    if (e) exportCount = parseInt(e[1], 10);
  }
  return { lastGenerated, fileCount, exportCount };
}

/** Deduplicate projects from all sessions */
function getUniqueProjects(
  sessions: { projectPath: string; projectName: string }[]
): { projectPath: string; projectName: string }[] {
  const seen = new Set<string>();
  const result: { projectPath: string; projectName: string }[] = [];

  for (const s of sessions) {
    if (s.projectPath && !seen.has(s.projectPath)) {
      seen.add(s.projectPath);
      result.push({
        projectPath: s.projectPath,
        projectName: s.projectName || s.projectPath.split('/').pop() || '',
      });
    }
  }
  return result;
}

export default function CodebaseMapSettings() {
  const [projectStates, setProjectStates] = useState<
    Record<string, ProjectMapState>
  >({});
  const [scriptPath, setScriptPath] = useState('');

  const sessions = useSessionStore((state) => state.sessions);
  const projects = getUniqueProjects(sessions);

  useEffect(() => {
    getGlobalScriptPath().then(setScriptPath);
  }, []);

  const updateProject = useCallback(
    (path: string, updates: Partial<ProjectMapState>) => {
      setProjectStates((prev) => ({
        ...prev,
        [path]: { ...prev[path], ...updates } as ProjectMapState,
      }));
    },
    []
  );

  const showFeedback = useCallback(
    (path: string, msg: string) => {
      updateProject(path, { feedback: msg });
      setTimeout(() => updateProject(path, { feedback: '' }), 4000);
    },
    [updateProject]
  );

  // Load status for all projects on mount and when sessions change
  useEffect(() => {
    for (const proj of projects) {
      const existing = projectStates[proj.projectPath];
      if (existing) continue; // already loaded

      // Initialize state
      const initial: ProjectMapState = {
        projectPath: proj.projectPath,
        projectName: proj.projectName,
        hookEnabled: false,
        mapExists: false,
        stats: { ...DEFAULT_STATS },
        isGenerating: false,
        feedback: '',
      };
      setProjectStates((prev) => ({
        ...prev,
        [proj.projectPath]: initial,
      }));

      // Load map status
      loadMapStatus(proj.projectPath);
      checkHookEnabled(proj.projectPath);
    }
  }, [sessions.length]);

  const loadMapStatus = async (projPath: string) => {
    try {
      const content = await invoke<string>('read_file_content', {
        path: `${projPath}/.quack/codebase-map.md`,
      });
      updateProject(projPath, {
        stats: parseStats(content),
        mapExists: true,
      });
    } catch {
      updateProject(projPath, { mapExists: false });
    }
  };

  const checkHookEnabled = async (projPath: string) => {
    try {
      const hooks = await invoke<Hook[]>('list_hooks', {
        workingDir: projPath,
      });
      const found = hooks.find(
        (h) =>
          h.id === 'codebase-map-auto-update' ||
          h.name === 'Codebase Map Auto-Update'
      );
      updateProject(projPath, { hookEnabled: !!found?.enabled });
    } catch {
      // not available
    }
  };

  const handleToggle = async (projPath: string) => {
    if (!scriptPath) return;
    const state = projectStates[projPath];
    if (!state) return;
    const enabling = !state.hookEnabled;

    try {
      if (enabling) {
        await invoke('save_hook', {
          workingDir: projPath,
          hook: {
            id: 'codebase-map-auto-update',
            name: 'Codebase Map Auto-Update',
            type: 'PostToolUse',
            matcher: 'Write|Edit',
            command: `node "${scriptPath}" --update-file "$TOOL_INPUT_FILE_PATH" . .quack/codebase-map.md`,
            enabled: true,
            scope: 'project',
            description: 'Auto-updates codebase map on file write',
          },
        });
        try {
          const rulesDir = `${projPath}/.claude/rules`;
          const rulePath = `${rulesDir}/${RULE_FILENAME}`;
          await invoke<CommandResult>('execute_command', {
            command: `mkdir -p ${rulesDir}`,
            cwd: projPath,
          });
          await invoke('write_file_content', {
            path: rulePath,
            content: CODEBASE_MAP_RULE,
          });
        } catch {
          console.warn('Could not install codebase map rule file');
        }
        showFeedback(projPath, 'Hook + rule enabled');
      } else {
        await invoke('delete_hook', {
          workingDir: projPath,
          hookId: 'codebase-map-auto-update',
          scope: 'project',
        });
        try {
          await invoke('remove_file', {
            path: `${projPath}/.claude/rules/${RULE_FILENAME}`,
          });
        } catch {
          // Best-effort removal
        }
        showFeedback(projPath, 'Hook + rule disabled');
      }
      updateProject(projPath, { hookEnabled: enabling });
    } catch (err) {
      console.error('Failed to toggle codebase map hook:', err);
      showFeedback(projPath, 'Error: ' + String(err));
    }
  };

  const handleGenerate = async (projPath: string) => {
    const state = projectStates[projPath];
    if (!state || state.isGenerating) return;
    updateProject(projPath, { isGenerating: true });
    showFeedback(projPath, 'Generating...');

    try {
      const sp = await ensureScript(projPath);
      const result = await invoke<CommandResult>('execute_command', {
        command: `node ${sp} . .quack/codebase-map.md`,
        cwd: projPath,
      });

      if (result.success) {
        await loadMapStatus(projPath);
        showFeedback(
          projPath,
          result.stdout?.trim() || 'Map generated successfully'
        );
      } else {
        showFeedback(projPath, 'Error: ' + (result.stderr || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to generate codebase map:', err);
      showFeedback(projPath, 'Error: ' + String(err));
    } finally {
      updateProject(projPath, { isGenerating: false });
    }
  };

  const handleViewMap = async (projPath: string) => {
    try {
      await invoke('reveal_in_finder', {
        path: `${projPath}/.quack/codebase-map.md`,
      });
    } catch (err) {
      console.error('Failed to reveal map file:', err);
      showFeedback(projPath, 'Map file not found');
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Codebase Map"
        description="Auto-generated index of TypeScript exports for AI navigation"
      />

      {projects.length === 0 ? (
        <div className="settings-group">
          <SettingsRow
            label="No projects found"
            description="Create an agent session to configure codebase maps"
            control={null}
          />
        </div>
      ) : (
        projects.map((proj) => {
          const state = projectStates[proj.projectPath];
          const hookEnabled = state?.hookEnabled ?? false;
          const mapExists = state?.mapExists ?? false;
          const isGenerating = state?.isGenerating ?? false;
          const feedback = state?.feedback ?? '';
          const stats = state?.stats ?? DEFAULT_STATS;

          return (
            <div key={proj.projectPath} style={{ marginBottom: '16px' }}>
              <SectionHeader
                title={proj.projectName}
                description={proj.projectPath}
              />
              <div className="settings-group">
                <SettingsRow
                  label="Auto-update on file changes"
                  description={
                    feedback ? (
                      <span
                        style={{
                          color: feedback.startsWith('Error')
                            ? '#ef4444'
                            : '#4CAF50',
                        }}
                      >
                        {feedback}
                      </span>
                    ) : (
                      'Hook + rule for automatic map updates'
                    )
                  }
                  control={
                    <IOSSwitch
                      checked={hookEnabled}
                      onChange={() => handleToggle(proj.projectPath)}
                    />
                  }
                />

                <SettingsRow
                  label="Status"
                  description={
                    mapExists ? (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: '#8a8f98',
                        }}
                      >
                        {stats.fileCount} files, {stats.exportCount} exports
                        {stats.lastGenerated !== 'Never'
                          ? ` — ${stats.lastGenerated}`
                          : ''}
                      </span>
                    ) : (
                      <span style={{ color: '#8a8f98' }}>
                        No map generated yet
                      </span>
                    )
                  }
                  control={
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="ios-button ios-button-secondary"
                        onClick={() => handleGenerate(proj.projectPath)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? 'Generating...' : 'Generate'}
                      </button>
                      {mapExists && (
                        <button
                          className="ios-button ios-button-secondary"
                          onClick={() => handleViewMap(proj.projectPath)}
                        >
                          View
                        </button>
                      )}
                    </div>
                  }
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
