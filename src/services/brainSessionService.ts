/**
 * Brain Session Service
 *
 * Handles Brain diary auto-append when sessions are marked as Done.
 * This bridges the gap between Quack UI actions and Brain hooks.
 *
 * @module services/brainSessionService
 */

// Brain: pattern-brain-hooks
import { invoke } from '@tauri-apps/api/core';
import type { AgentSession } from '../types';

const DIARY_DIR = 'documentation/diary';

/**
 * Append a summary line to the Brain diary when a session
 * is marked as "Done" from the Quack UI.
 */
export async function appendBrainDiaryOnDone(
  session: AgentSession
): Promise<void> {
  if (!session.projectPath) return;

  const docsPath = `${session.projectPath}/${DIARY_DIR}`;
  const today = new Date().toISOString().slice(0, 10);
  const time = new Date().toTimeString().slice(0, 5);
  const diaryPath = `${docsPath}/${today}.md`;

  // Build summary from session metadata
  const title = session.title || session.id;
  const msgCount = session.messageCount || 0;
  const duration = session.completedAt && session.createdAt
    ? formatDuration(session.completedAt - session.createdAt)
    : null;

  const parts: string[] = [];
  parts.push(`sessione "${title}"`);
  if (msgCount > 0) parts.push(`${msgCount} messaggi`);
  if (duration) parts.push(duration);

  const line = `- [${time}] (Auto) Sessione completata: ${parts.join(', ')}`;

  try {
    // Check if diary file exists
    const exists = await fileExists(diaryPath);

    if (!exists) {
      // Check if documentation/diary/ exists
      const dirExists = await fileExists(docsPath);
      if (!dirExists) return; // No Brain = no diary

      // Create new diary with frontmatter
      const projectName = detectProjectName(session.projectPath);
      const content = [
        '---',
        'type: diary',
        `project: ${projectName}`,
        `date: ${today}`,
        '---',
        '',
        line,
        '',
      ].join('\n');

      await invoke('write_file_content', {
        path: diaryPath,
        content,
      });
    } else {
      // Append to existing diary
      const existing = await invoke<string>(
        'read_file_content',
        { path: diaryPath }
      );
      const newContent = existing.endsWith('\n')
        ? existing + line + '\n'
        : existing + '\n' + line + '\n';

      await invoke('write_file_content', {
        path: diaryPath,
        content: newContent,
      });
    }

    console.log('[brainSession] Diary entry appended:', line);
  } catch (err) {
    // Never block session completion
    console.warn('[brainSession] Failed to append diary:', err);
  }
}

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function detectProjectName(projectPath: string): string {
  const parts = projectPath.split('/');
  return parts[parts.length - 1] || 'unknown';
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await invoke('read_file_content', { path });
    return true;
  } catch {
    return false;
  }
}
