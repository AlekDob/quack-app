/**
 * IDE Context Builder
 *
 * Gathers context from Quack's internal state (preview file, editor selection, git status)
 * and/or from an external IDE via the Claude Code extension WebSocket connection,
 * then formats it as XML tags to prepend to agent chat prompts.
 *
 * Mirrors the tag format used by Claude Code CLI:
 * - <ide_opened_file> for the currently active file
 * - <ide_selection> for selected code
 * - <ide_diagnostics> for LSP diagnostics
 * - gitStatus: for git state
 */

import { invoke } from '@tauri-apps/api/core';
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

/** Context from an external IDE (via Claude Code extension WebSocket) */
export interface ExternalIdeContext {
  active_file: string | null;
  selection: {
    file_path: string;
    language: string;
    text: string;
    start_line: number;
    end_line: number;
  } | null;
  open_tabs: string[];
  diagnostics: {
    file: string;
    severity: string;
    message: string;
    line: number;
  }[];
  ide_name: string;
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
 * Format git status as a string block.
 */
function formatGitStatus(gs: GitStatusSummary): string {
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

  return `gitStatus: ${statusLines.join('\n')}`;
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
    parts.push(formatGitStatus(ctx.gitStatus));
  }

  if (parts.length === 0) return '';

  return parts.join('\n') + '\n';
}

/**
 * Format external IDE context as XML tags.
 * Includes diagnostics from the IDE when available.
 * Git status always comes from Quack's own state.
 */
function formatExternalContextPrefix(
  ctx: ExternalIdeContext,
  gitSummary: GitStatusSummary | null
): string {
  const parts: string[] = [];

  if (ctx.active_file) {
    parts.push(
      `<ide_opened_file>The user has the file ${ctx.active_file} open in their ${ctx.ide_name} editor. This may or may not be relevant to their request.</ide_opened_file>`
    );
  }

  if (ctx.selection && ctx.selection.text.trim()) {
    const truncated = truncateSelection(ctx.selection.text);
    parts.push(
      `<ide_selection file_path="${ctx.selection.file_path}" language="${ctx.selection.language}" start_line="${ctx.selection.start_line}" end_line="${ctx.selection.end_line}">`,
      truncated,
      `</ide_selection>`
    );
  }

  if (ctx.diagnostics.length > 0) {
    const diagLines = ctx.diagnostics.map(d =>
      `${d.file}:${d.line} [${d.severity}] ${d.message}`
    );
    parts.push(
      `<ide_diagnostics>`,
      ...diagLines,
      `</ide_diagnostics>`
    );
  }

  // Git status always from Quack's own state
  if (gitSummary) {
    parts.push(formatGitStatus(gitSummary));
  }

  if (parts.length === 0) return '';

  return parts.join('\n') + '\n';
}

/**
 * Build the context prefix string from Quack's internal state.
 * This is the synchronous version (fallback when no external IDE is connected).
 */
export function buildInternalContextPrefix(
  gitSummary: GitStatusSummary | null
): string {
  const ctx = gatherInternalContext(gitSummary);
  return formatContextPrefix(ctx);
}

/**
 * Build the context prefix, trying external IDE first, falling back to internal.
 * This is the async version used when a workspace path is available.
 *
 * Priority: External IDE (WebSocket) > Quack internal (file preview/selection)
 * Git status always comes from Quack's own state.
 */
export async function buildContextPrefix(
  gitSummary: GitStatusSummary | null,
  workspacePath: string | null
): Promise<string> {
  // Check if IDE context injection is enabled
  const { ideContextEnabled } = useFileSystemStore.getState();
  if (!ideContextEnabled) return '';

  // Try external IDE context first
  if (workspacePath) {
    try {
      const externalCtx = await invoke<ExternalIdeContext | null>(
        'get_ide_context',
        { workspacePath }
      );
      if (externalCtx) {
        return formatExternalContextPrefix(externalCtx, gitSummary);
      }
    } catch (e) {
      console.debug('[IDE Context] External IDE not available, using internal:', e);
    }
  }

  // Fall back to internal context
  return buildInternalContextPrefix(gitSummary);
}
