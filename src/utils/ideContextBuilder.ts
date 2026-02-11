/**
 * IDE Context Builder
 *
 * Gathers context from Quack's internal state (preview file, editor selection, git status)
 * and formats it as XML tags to prepend to agent chat prompts.
 *
 * Mirrors the tag format used by Claude Code CLI:
 * - <ide_opened_file> for the currently active file
 * - <ide_selection> for selected code
 * - gitStatus: for git state
 */

import { useFileSystemStore } from '../stores/fileSystemStore';
import type { GitStatusSummary } from '../types';

const MAX_SELECTION_LINES = 200;
const MAX_SELECTION_CHARS = 8000;
const MAX_GIT_CHANGED_FILES = 20;

export interface IdeContext {
  openedFile: string | null;
  selection: {
    filePath: string;
    language: string;
    selectedText: string;
    startLine: number;
    endLine: number;
  } | null;
  gitStatus: GitStatusSummary | null;
}

/**
 * Gather IDE context from Quack's internal state.
 */
export function gatherInternalContext(
  gitSummary: GitStatusSummary | null
): IdeContext {
  const { previewFile, editorSelection } = useFileSystemStore.getState();
  return {
    openedFile: previewFile,
    selection: editorSelection,
    gitStatus: gitSummary,
  };
}

/**
 * Truncate selection text if it exceeds limits.
 */
function truncateSelection(text: string): string {
  const lines = text.split('\n');
  if (lines.length > MAX_SELECTION_LINES) {
    return lines.slice(0, MAX_SELECTION_LINES).join('\n')
      + `\n... (truncated, ${lines.length - MAX_SELECTION_LINES} more lines)`;
  }
  if (text.length > MAX_SELECTION_CHARS) {
    return text.slice(0, MAX_SELECTION_CHARS)
      + `\n... (truncated, ${text.length - MAX_SELECTION_CHARS} more characters)`;
  }
  return text;
}

/**
 * Format IDE context as XML tags to prepend to the user prompt.
 * Uses the same tag format as Claude Code CLI.
 */
export function formatContextPrefix(ctx: IdeContext): string {
  const parts: string[] = [];

  if (ctx.openedFile) {
    parts.push(
      `<ide_opened_file>The user has the file ${ctx.openedFile} open in their editor. This may or may not be relevant to their request.</ide_opened_file>`
    );
  }

  if (ctx.selection && ctx.selection.selectedText.trim()) {
    const truncated = truncateSelection(ctx.selection.selectedText);
    parts.push(
      `<ide_selection file_path="${ctx.selection.filePath}" language="${ctx.selection.language}" start_line="${ctx.selection.startLine}" end_line="${ctx.selection.endLine}">`,
      truncated,
      `</ide_selection>`
    );
  }

  if (ctx.gitStatus) {
    const gs = ctx.gitStatus;
    const statusLines: string[] = [];
    statusLines.push(`Current branch: ${gs.branch}`);
    if (gs.upstream) statusLines.push(`Upstream: ${gs.upstream}`);
    if (gs.ahead !== null && gs.ahead > 0) statusLines.push(`Ahead: ${gs.ahead}`);
    if (gs.behind !== null && gs.behind > 0) statusLines.push(`Behind: ${gs.behind}`);

    if (!gs.clean) {
      const changed = gs.entries.filter(e => e.staged_status || e.unstaged_status || e.is_untracked);
      if (changed.length > 0) {
        statusLines.push('');
        statusLines.push('Status:');
        changed.slice(0, MAX_GIT_CHANGED_FILES).forEach(e => {
          const staged = e.staged_status || ' ';
          const unstaged = e.unstaged_status || ' ';
          statusLines.push(`${staged}${unstaged} ${e.path}`);
        });
        if (changed.length > MAX_GIT_CHANGED_FILES) {
          statusLines.push(`... and ${changed.length - MAX_GIT_CHANGED_FILES} more`);
        }
      }
    }

    parts.push(`gitStatus: ${statusLines.join('\n')}`);
  }

  if (parts.length === 0) return '';

  return parts.join('\n') + '\n';
}

/**
 * Build the context prefix string from Quack's internal state.
 * This is the synchronous version used in Phase 1 (no external IDE).
 */
export function buildInternalContextPrefix(
  gitSummary: GitStatusSummary | null
): string {
  const ctx = gatherInternalContext(gitSummary);
  return formatContextPrefix(ctx);
}
