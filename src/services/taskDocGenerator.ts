/**
 * Task Documentation Generator Service
 *
 * Generates markdown documentation from completed Kanban tasks by analyzing
 * chat messages, tool calls, and task metadata.
 */

import type { KanbanTask, ChatMessage, ChatToolCall } from '../types';

/**
 * Summary extracted from task chat messages
 */
export interface TaskSummary {
  objective: string;        // from task.prompt
  summary: string;          // AI-generated summary of what was done
  keyDecisions: string[];   // extracted decisions from conversation
  filesModified: string[];  // extracted file paths from tool calls
  toolsUsed: string[];      // unique tools used
}

/**
 * Extracts key information from chat messages to create a summary
 */
export function generateTaskSummary(messages: ChatMessage[]): TaskSummary {
  const keyDecisions: string[] = [];
  const filesModified: Set<string> = new Set();
  const toolsUsed: Set<string> = new Set();
  const assistantMessages: string[] = [];

  // Analyze each message
  for (const msg of messages) {
    // Extract assistant messages for summary generation
    if (msg.role === 'assistant' && msg.content) {
      assistantMessages.push(msg.content);

      // Look for decision indicators
      const decisionPatterns = [
        /(?:decided|choosing|selected|using|opting for)\s+([^.!?\n]+)/gi,
        /(?:will|let's)\s+(?:use|implement|create|build)\s+([^.!?\n]+)/gi,
        /(?:approach|strategy|pattern):\s+([^.!?\n]+)/gi,
      ];

      for (const pattern of decisionPatterns) {
        const matches = msg.content.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const decision = match[1].trim();
            // Only add non-trivial decisions (more than 10 chars)
            if (decision.length > 10 && !keyDecisions.includes(decision)) {
              keyDecisions.push(decision);
            }
          }
        }
      }
    }

    // Extract file paths from tool calls
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const toolCall of msg.toolCalls) {
        // Track tool usage
        toolsUsed.add(toolCall.name);

        // Extract file paths from tool inputs
        extractFilePaths(toolCall, filesModified);
      }
    }
  }

  // Generate a concise summary from assistant messages
  const summary = generateSummaryFromMessages(assistantMessages);

  return {
    objective: '', // Will be set from task.prompt by caller
    summary,
    keyDecisions,
    filesModified: Array.from(filesModified).sort(),
    toolsUsed: Array.from(toolsUsed).sort(),
  };
}

/**
 * Extracts file paths from tool call inputs
 */
function extractFilePaths(toolCall: ChatToolCall, filesModified: Set<string>): void {
  const input = toolCall.input;

  // Common file path parameters across different tools
  const filePathKeys = [
    'file_path',
    'path',
    'filePath',
    'notebook_path',
    'notebookPath',
  ];

  for (const key of filePathKeys) {
    if (input[key] && typeof input[key] === 'string') {
      filesModified.add(input[key] as string);
    }
  }

  // Special case: Bash commands might contain file paths
  if (toolCall.name === 'Bash' && input.command && typeof input.command === 'string') {
    const command = input.command as string;
    // Extract paths that look like absolute paths
    const pathMatches = command.matchAll(/\/[\w\-./]+\.\w+/g);
    for (const match of pathMatches) {
      filesModified.add(match[0]);
    }
  }
}

/**
 * Generates a concise summary from assistant messages
 */
function generateSummaryFromMessages(messages: string[]): string {
  if (messages.length === 0) {
    return 'Task completed successfully.';
  }

  // Take key points from messages
  const points: string[] = [];

  for (const msg of messages) {
    // Look for action statements
    const actionPatterns = [
      /(?:I've|I will|I'll|Created|Implemented|Fixed|Updated|Added|Removed|Refactored)\s+([^.!?\n]{20,100})/gi,
    ];

    for (const pattern of actionPatterns) {
      const matches = msg.matchAll(pattern);
      for (const match of matches) {
        if (match[0] && points.length < 5) {
          points.push(match[0].trim());
        }
      }
    }
  }

  if (points.length > 0) {
    return points.join('. ') + '.';
  }

  // Fallback: use first assistant message (truncated)
  const firstMessage = messages[0];
  if (firstMessage.length > 200) {
    return firstMessage.substring(0, 200).trim() + '...';
  }
  return firstMessage.trim();
}

/**
 * Generates markdown documentation from a task and its summary
 */
export function generateDocMarkdown(task: KanbanTask, summary: TaskSummary): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${task.title}`);
  lines.push('');

  // Metadata table
  lines.push('**Date**: ' + formatDate(task.completedAt || task.createdAt));
  lines.push(`**Project**: ${task.projectName}`);
  if (task.branch) {
    lines.push(`**Branch**: ${task.branch}`);
  }
  if (task.assignedAgent) {
    lines.push(`**Agent**: ${task.assignedAgent.name}`);
  }
  if (task.startedAt && task.completedAt) {
    const duration = formatDuration(task.completedAt - task.startedAt);
    lines.push(`**Duration**: ${duration}`);
  }
  lines.push('');

  // Objective
  lines.push('## Objective');
  lines.push('');
  lines.push(task.prompt);
  lines.push('');

  // Summary
  if (summary.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(summary.summary);
    lines.push('');
  }

  // Key Decisions
  if (summary.keyDecisions.length > 0) {
    lines.push('## Key Decisions');
    lines.push('');
    for (const decision of summary.keyDecisions) {
      lines.push(`- ${decision}`);
    }
    lines.push('');
  }

  // Files Modified
  if (summary.filesModified.length > 0) {
    lines.push('## Files Modified');
    lines.push('');
    for (const file of summary.filesModified) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  // Tools Used
  if (summary.toolsUsed.length > 0) {
    lines.push('## Tools Used');
    lines.push('');
    lines.push(summary.toolsUsed.join(', '));
    lines.push('');
  }

  // Cost information (if available)
  if (task.totalCost && task.totalCost > 0) {
    lines.push('## Cost');
    lines.push('');
    lines.push(`**Total Cost**: $${task.totalCost.toFixed(4)}`);
    if (task.inputTokens || task.outputTokens) {
      lines.push('');
      lines.push('**Token Usage**:');
      if (task.inputTokens) {
        lines.push(`- Input: ${task.inputTokens.toLocaleString()}`);
      }
      if (task.outputTokens) {
        lines.push(`- Output: ${task.outputTokens.toLocaleString()}`);
      }
      if (task.cacheCreationTokens) {
        lines.push(`- Cache Creation: ${task.cacheCreationTokens.toLocaleString()}`);
      }
      if (task.cacheReadTokens) {
        lines.push(`- Cache Read: ${task.cacheReadTokens.toLocaleString()}`);
      }
    }
    lines.push('');
  }

  // Completion Note
  if (task.completionNote) {
    lines.push('## Notes');
    lines.push('');
    lines.push(task.completionNote);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*Generated by Quack Task Completion Hook*');

  return lines.join('\n');
}

/**
 * Converts a title to a filename-safe slug
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^\w-]+/g, '')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns the full path for the documentation file
 */
export function getDocFilePath(task: KanbanTask): string {
  const timestamp = formatDateForFilename(task.completedAt || task.createdAt);
  const slug = slugify(task.title);
  const filename = `${timestamp}-${slug}.md`;

  // Store in project-specific docs folder
  const projectSlug = slugify(task.projectName);
  return `/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/kanban-tasks/${projectSlug}/${filename}`;
}

/**
 * Formats a timestamp to YYYY-MM-DD
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a timestamp for use in filenames (YYYY-MM-DD)
 */
function formatDateForFilename(timestamp: number): string {
  return formatDate(timestamp);
}

/**
 * Formats duration in milliseconds to human-readable string
 */
function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}
