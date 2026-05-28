/**
 * Handoff Service
 *
 * Fork a session onto a different agent with an AI-generated summary as bootstrap context.
 * The new session is visually nested under the parent in the sidebar via `parentSessionId`
 * (no runtime semantics — sessions stay independent after the fork).
 *
 * Brain: handoff-agent-fork
 */

import type { AgentSession, ChatMessage } from '../types';
import { streamClaudeMessage } from './claudeSDK';
import { useSessionStore } from '../stores/sessionStore';
import { createLocalSummary } from './conversationRecovery';
import { getSendMessageForTargetAgent } from './sendMessageBridge';

const MAX_MESSAGES_FOR_SUMMARY = 80;
const SUMMARY_TIMEOUT_MS = 90_000;

function serializeMessagesForPrompt(messages: ChatMessage[]): string {
  const trimmed = messages.length > MAX_MESSAGES_FOR_SUMMARY
    ? messages.slice(-MAX_MESSAGES_FOR_SUMMARY)
    : messages;

  return trimmed
    .map((m) => {
      const role = m.role === 'user' ? 'USER' : m.role === 'assistant' ? 'ASSISTANT' : 'SYSTEM';
      const body = (m.content || '').trim();
      if (!body) return null;
      return `[${role}]\n${body}`;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

function buildSummaryPrompt(
  serializedMessages: string,
  fromAgent: string,
  toAgent: string,
): string {
  return `You are preparing a HANDOFF summary so the user can switch the conversation from agent "${fromAgent}" to agent "${toAgent}".

The summary will be used as the very first message that "${toAgent}" sees. It must give them enough context to continue the work without asking the user to re-explain.

Produce a concise markdown summary with exactly these five sections (use the exact headings):

## Contesto
2-4 lines: what is the user working on, what is the broader goal.

## Cosa abbiamo fatto
Bullet list of the concrete steps already completed (files touched, decisions made, ground covered).

## Decisioni prese
Bullet list of any explicit decisions or constraints the user confirmed. Quote the user when meaningful.

## Stato attuale
Where we are right now: last action, what is in flight, any open blocker.

## Prossimo step suggerito
The next move "${toAgent}" should propose. Be concrete and actionable.

Rules:
- Italian language if the original conversation is Italian, otherwise match the original language.
- No preamble, no closing remarks, just the five sections.
- No mentions of "I" or "the assistant" — write in third person ("the user", "we").
- Keep it under 400 words total.

Conversation transcript (most recent ${MAX_MESSAGES_FOR_SUMMARY} messages or fewer):

${serializedMessages}`;
}

/**
 * Generate an AI summary of the current conversation, formatted for handoff.
 *
 * Falls back to `createLocalSummary` if the SDK call fails or times out — the
 * user can always edit the textarea before confirming.
 */
export async function generateHandoffSummary(
  messages: ChatMessage[],
  fromAgent: string,
  toAgent: string,
  options: { workingDirectory?: string; signal?: AbortSignal } = {},
): Promise<string> {
  if (messages.length === 0) {
    return `## Contesto\nNessun messaggio nella sessione corrente — nuova conversazione con ${toAgent}.\n\n## Prossimo step suggerito\nChiedere all'utente cosa vuole fare.`;
  }

  const serialized = serializeMessagesForPrompt(messages);
  const prompt = buildSummaryPrompt(serialized, fromAgent, toAgent);

  try {
    const stream = streamClaudeMessage(prompt, {
      model: 'sonnet',
      permissionMode: 'bypass',
      workingDirectory: options.workingDirectory,
      mcpServers: {},
      signal: options.signal,
      timeout: SUMMARY_TIMEOUT_MS,
      streamId: `handoff-summary-${Date.now()}`,
    });

    let collectedText = '';
    for await (const chunk of stream) {
      if (chunk.type === 'complete' && chunk.result?.text) {
        collectedText = chunk.result.text;
        break;
      }
      if (chunk.type === 'event' && chunk.event?.type === 'assistant') {
        const blocks = (chunk.event as { message?: { content?: Array<{ type: string; text?: string }> } }).message?.content;
        if (Array.isArray(blocks)) {
          for (const b of blocks) {
            if (b.type === 'text' && typeof b.text === 'string') {
              collectedText += b.text;
            }
          }
        }
      }
      if (chunk.type === 'error') {
        throw new Error(chunk.error || 'Stream error during summary generation');
      }
    }

    const trimmed = collectedText.trim();
    if (!trimmed) {
      console.warn('[handoffService] Empty summary from SDK, falling back to local summary');
      return createLocalSummary(messages);
    }
    return trimmed;
  } catch (err) {
    console.error('[handoffService] AI summary failed, using local fallback:', err);
    return createLocalSummary(messages);
  }
}

export interface ExecuteHandoffArgs {
  fromSession: AgentSession;
  targetAgentId: string;
  summary: string;
  targetAgentName?: string;
  fromAgentName?: string;
}

/**
 * Create a new session on the target agent with the summary as initialPrompt.
 * Returns the new AgentSession. Caller is responsible for navigating to it.
 */
export async function executeHandoff(args: ExecuteHandoffArgs): Promise<AgentSession> {
  const { fromSession, targetAgentId, summary, targetAgentName, fromAgentName } = args;

  const wrappedPrompt = [
    `<handoff-context from="${fromAgentName ?? 'previous-agent'}" to="${targetAgentName ?? targetAgentId}">`,
    summary,
    '</handoff-context>',
    '',
    'Read the handoff context above and pick up from "Prossimo step suggerito". Confirm with the user before doing destructive actions.',
  ].join('\n');

  const store = useSessionStore.getState();

  // Create the session with status 'todo' — sendMessageForTargetAgent
  // auto-transitions to 'in_progress' when it fires (see App.tsx:3848).
  // initialPromptConsumed: true so the wrapped prompt is NOT re-shown in the
  // ChatInput when the user opens the session (we send it programmatically).
  const newSession = await store.createSession({
    title: `Handoff: ${fromSession.title}`.slice(0, 80),
    agentId: targetAgentId,
    projectPath: fromSession.projectPath,
    projectName: fromSession.projectName,
    status: 'todo',
    messageCount: 0,
    branch: fromSession.branch,
    useWorktree: fromSession.useWorktree,
    worktreePath: fromSession.worktreePath,
    parentSessionId: fromSession.id,
    initialPromptConsumed: true,
    backend: fromSession.backend,
  });

  store.selectSession(newSession.id);

  // Fire the bootstrap prompt automatically so the new agent starts immediately.
  // Brain: handoff-agent-fork — uses the sendMessageBridge so we don't need to
  // be inside the React tree.
  const send = getSendMessageForTargetAgent();
  if (send) {
    // Don't await — let the user see the message bubble appear, the stream
    // will continue in background even if the dialog/UI moves on.
    void send(newSession.id, wrappedPrompt, {
      workingDirectory: fromSession.worktreePath || fromSession.projectPath,
    });
  } else {
    console.warn('[handoffService] sendMessageForTargetAgent bridge not registered — user will need to press Enter manually');
  }

  return newSession;
}
