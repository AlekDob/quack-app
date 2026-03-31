/**
 * IDE Context Builder
 *
 * Gathers context from Quack's internal state (preview file, editor selection)
 * and/or from an external IDE via the Claude Code extension WebSocket connection,
 * then formats it as XML tags to prepend to agent chat prompts.
 *
 * Mirrors the tag format used by Claude Code CLI:
 * - <ide_opened_file> for the currently active file
 * - <ide_selection> for selected code
 * - <ide_diagnostics> for LSP diagnostics
 *
 * Note: Git status is NOT injected — the agent can run git commands itself,
 * and cached git state goes stale (causing incorrect branch info).
 */

import { invoke } from '@tauri-apps/api/core';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { isMacOS } from './platform';

export interface IdeContext {
  openedFile: string | null;
  selection: {
    filePath: string;
    language: string;
    selectedText: string;
    startLine: number;
    endLine: number;
  } | null;
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
    start_char: number;
    end_char: number;
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
export function gatherInternalContext(): IdeContext {
  const { previewFile, editorSelection } = useFileSystemStore.getState();
  return {
    openedFile: previewFile,
    selection: editorSelection,
  };
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
    parts.push(
      `<ide_selection file_path="${ctx.selection.filePath}" language="${ctx.selection.language}" start_line="${ctx.selection.startLine}" end_line="${ctx.selection.endLine}" />`
    );
  }

  if (parts.length === 0) return '';

  return parts.join('\n') + '\n';
}

/**
 * Format external IDE context as XML tags.
 * Includes diagnostics from the IDE when available.
 */
function formatExternalContextPrefix(
  ctx: ExternalIdeContext
): string {
  const parts: string[] = [];

  if (ctx.active_file) {
    parts.push(
      `<ide_opened_file>The user has the file ${ctx.active_file} open in their ${ctx.ide_name} editor. This may or may not be relevant to their request.</ide_opened_file>`
    );
  }

  if (ctx.selection && ctx.selection.text.trim()) {
    parts.push(
      `<ide_selection file_path="${ctx.selection.file_path}" language="${ctx.selection.language}" start_line="${ctx.selection.start_line}" start_char="${ctx.selection.start_char}" end_line="${ctx.selection.end_line}" end_char="${ctx.selection.end_char}" />`
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

  if (parts.length === 0) return '';

  return parts.join('\n') + '\n';
}

/**
 * Build the context prefix string from Quack's internal state.
 * This is the synchronous version (fallback when no external IDE is connected).
 */
export function buildInternalContextPrefix(): string {
  const ctx = gatherInternalContext();
  return formatContextPrefix(ctx);
}

/**
 * Build the context prefix, trying external IDE first, falling back to internal.
 * This is the async version used when a workspace path is available.
 *
 * Priority: External IDE (WebSocket) > Quack internal (file preview/selection)
 */
export async function buildContextPrefix(
  workspacePath: string | null
): Promise<string> {
  // Check if IDE context injection is enabled
  const { ideContextEnabled } = useFileSystemStore.getState();
  if (!ideContextEnabled) return '';

  // External IDE context is Mac-only
  if (!isMacOS()) {
    return buildInternalContextPrefix();
  }

  // Try external IDE context first
  if (workspacePath) {
    try {
      const externalCtx = await invoke<ExternalIdeContext | null>(
        'get_ide_context',
        { workspacePath }
      );
      if (externalCtx) {
        return formatExternalContextPrefix(externalCtx);
      }
    } catch (e) {
      console.debug('[IDE Context] External IDE not available, using internal:', e);
    }
  }

  // Fall back to internal context
  return buildInternalContextPrefix();
}
