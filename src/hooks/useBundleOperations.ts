import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import type { SavedAgent } from '../types';
import {
  exportAgentBundleAsZip,
  importAgentBundle,
} from '../services/bundleService';
import { saveAgent } from '../utils/agentStorage';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';

interface BundleOperationsState {
  exporting: boolean;
  importing: boolean;
  error: string | null;
  success: string | null;
}

interface BundleOperations {
  exporting: boolean;
  importing: boolean;
  error: string | null;
  success: string | null;
  exportAgent: (agent: SavedAgent) => Promise<void>;
  importBundle: () => Promise<SavedAgent | null>;
  clearError: () => void;
}

/** Read a file from disk via Tauri, return content or empty string */
async function readFileContent(path: string): Promise<string> {
  try {
    return await invoke<string>('read_file_content', { path });
  } catch {
    return '';
  }
}

// Brain: bug-marketplace-install-windows-path-separators
// getHome() removed — was broken on Windows (hardcoded '/'). Use homeDir() + join() instead.

/**
 * Hook for bundle export/import operations
 *
 * Provides functions to:
 * - Export an agent as a .quack bundle (ZIP with real file contents)
 * - Import an agent from a .quack bundle and install files to ~/.claude/
 */
export function useBundleOperations(): BundleOperations {
  const [state, setState] = useState<BundleOperationsState>({
    exporting: false,
    importing: false,
    error: null,
    success: null,
  });

  /**
   * Export an agent as a downloadable .quack bundle
   * Reads real skill, rule, and command files from disk
   */
  async function exportAgent(agent: SavedAgent): Promise<void> {
    setState((prev) => ({ ...prev, exporting: true, error: null }));

    try {
      const home = await homeDir();

      // Read real skill files from disk
      const skillNames = agent.personality?.selectedSkills || agent.personality?.skills || [];
      const skills = await Promise.all(
        skillNames.map(async (name) => {
          const dirPath = await join(home, '.claude', 'skills', name, 'SKILL.md');
          const flatPath = await join(home, '.claude', 'skills', `${name}.md`);
          let content = await readFileContent(dirPath);
          if (!content) content = await readFileContent(flatPath);
          return { id: name, content };
        })
      );

      // Read real rule files from disk
      const rulePaths = agent.personality?.selectedRules || [];
      const rules = await Promise.all(
        rulePaths.map(async (rulePath) => {
          const name = rulePath.split('/').pop()?.replace('.md', '') || rulePath;
          const content = await readFileContent(rulePath);
          return { id: name, content };
        })
      );

      // Read real command files from disk
      const commandNames = agent.personality?.toolkit?.commands || [];
      const commands = await Promise.all(
        commandNames.map(async (name) => {
          const cmdPath = await join(home, '.claude', 'commands', `${name}.md`);
          const content = await readFileContent(cmdPath);
          return { id: name, content };
        })
      );

      // Read avatar file if present
      let avatarData: Uint8Array | undefined;
      if (agent.avatar) {
        try {
          const avatarPath = await join(home, '.claude', 'avatars', agent.avatar);
          const data = await invoke<number[]>('read_binary_file', { path: avatarPath });
          avatarData = new Uint8Array(data);
        } catch {
          // Avatar not found, export without it
        }
      }

      // Export as ZIP with real contents
      const zipData = await exportAgentBundleAsZip(
        agent,
        skills.filter(s => s.content),
        [], // droids
        rules.filter(r => r.content),
        commands.filter(c => c.content),
        avatarData
      );

      const filename = `${agent.name.toLowerCase().replace(/\s+/g, '-')}.quack`;

      // Use Tauri's native save dialog
      const savePath = await saveDialog({
        defaultPath: filename,
        filters: [{
          name: 'Quack Agent Bundle',
          extensions: ['quack', 'zip']
        }]
      });

      if (!savePath) {
        setState((prev) => ({ ...prev, exporting: false }));
        return;
      }

      await invoke('write_binary_file', { path: savePath, data: Array.from(zipData) });
      setState((prev) => ({ ...prev, exporting: false, success: 'Agent bundle exported successfully' }));
      setTimeout(() => setState((prev) => ({ ...prev, success: null })), 3000);
    } catch (err) {
      console.error('Failed to export agent bundle:', err);
      setState((prev) => ({
        ...prev,
        exporting: false,
        error: `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    }
  }

  /**
   * Import an agent from a .quack bundle file
   * Installs skills, rules, and commands to ~/.claude/
   */
  async function importBundle(): Promise<SavedAgent | null> {
    setState((prev) => ({ ...prev, importing: true, error: null }));

    try {
      const selectedPath = await openDialog({
        multiple: false,
        filters: [{
          name: 'Quack Agent Bundle',
          extensions: ['quack', 'zip']
        }]
      });

      if (!selectedPath) {
        setState((prev) => ({ ...prev, importing: false }));
        return null;
      }

      const rawData = await invoke<number[]>('read_binary_file', { path: selectedPath as string });
      const bundleData = new Uint8Array(rawData);
      const result = await importAgentBundle(bundleData);
      const home = await homeDir();

      // Install skills to ~/.claude/skills/
      for (const skill of result.skills) {
        if (!skill.content) continue;
        const targetDir = await join(home, '.claude', 'skills', skill.id);
        try { await invoke('create_directory', { path: targetDir }); } catch { /* exists */ }
        await invoke('write_file_content', {
          path: await join(targetDir, 'SKILL.md'),
          content: skill.content,
        });
      }

      // Install rules to ~/.claude/rules/
      for (const rule of result.rules) {
        if (!rule.content) continue;
        const targetDir = await join(home, '.claude', 'rules');
        try { await invoke('create_directory', { path: targetDir }); } catch { /* exists */ }
        await invoke('write_file_content', {
          path: await join(targetDir, `${rule.id}.md`),
          content: rule.content,
        });
      }

      // Install commands to ~/.claude/commands/
      for (const cmd of result.commands) {
        if (!cmd.content) continue;
        const targetDir = await join(home, '.claude', 'commands');
        try { await invoke('create_directory', { path: targetDir }); } catch { /* exists */ }
        await invoke('write_file_content', {
          path: await join(targetDir, `${cmd.id}.md`),
          content: cmd.content,
        });
      }

      // Update rule paths to point to installed location
      const installedRulePaths: string[] = [];
      for (const r of result.rules.filter(r => r.content)) {
        installedRulePaths.push(await join(home, '.claude', 'rules', `${r.id}.md`));
      }

      // Save agent with correct references
      saveAgent({
        name: result.agent.name,
        avatar: result.agent.avatar,
        color: result.agent.color,
        workingOn: result.agent.workingOn,
        personality: {
          ...result.agent.personality,
          selectedRules: installedRulePaths,
          selectedSkills: result.skills.filter(s => s.content).map(s => s.id),
        },
      });

      setState((prev) => ({ ...prev, importing: false, success: 'Agent bundle imported successfully' }));
      setTimeout(() => setState((prev) => ({ ...prev, success: null })), 3000);
      return result.agent;
    } catch (err) {
      console.error('Failed to import agent bundle:', err);
      setState((prev) => ({
        ...prev,
        importing: false,
        error: `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
      return null;
    }
  }

  function clearError() {
    setState((prev) => ({ ...prev, error: null }));
  }

  return {
    exporting: state.exporting,
    importing: state.importing,
    error: state.error,
    success: state.success,
    exportAgent,
    importBundle,
    clearError,
  };
}
