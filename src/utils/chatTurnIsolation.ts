import type { ChatMessage, ClaudeEvent } from '../types';

export interface BufferedClaudeEvent {
  turnId?: string;
  event: ClaudeEvent;
}

export interface RouteClaudeEventResult {
  action: 'applied' | 'buffered';
  sessionMessages: ChatMessage[];
  bufferedEvents: BufferedClaudeEvent[];
  flushedBufferedCount: number;
  discardedBufferedCount: number;
}

export function createChatTurnId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getChatMessageTurnId(message?: ChatMessage): string | undefined {
  const turnId = message?.metadata?.turnId;
  return typeof turnId === 'string' && turnId.length > 0 ? turnId : undefined;
}

export function shouldRejectClaudeEvent(
  activeTurnId?: string,
  incomingTurnId?: string,
  abortedTurnIds?: ReadonlySet<string>,
): boolean {
  if (incomingTurnId && abortedTurnIds?.has(incomingTurnId)) {
    return true;
  }

  return Boolean(activeTurnId && incomingTurnId && activeTurnId !== incomingTurnId);
}

export function appendMessagesToSession(
  prevSessions: Map<string, ChatMessage[]>,
  sessionKey: string,
  messagesToAdd: ChatMessage[],
): Map<string, ChatMessage[]> {
  const nextSessions = new Map(prevSessions);
  const latestMessages = nextSessions.get(sessionKey) ?? [];
  nextSessions.set(sessionKey, [...latestMessages, ...messagesToAdd]);
  return nextSessions;
}

export function findAssistantMessageIndexForTurn(messages: ChatMessage[], turnId?: string): number {
  if (!turnId) {
    return -1;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant' && getChatMessageTurnId(message) === turnId) {
      return index;
    }
  }

  return -1;
}

export function routeClaudeEventToSession(args: {
  sessionMessages: ChatMessage[];
  bufferedEvents: BufferedClaudeEvent[];
  claudeEvent: ClaudeEvent;
  turnId?: string;
  now?: number;
}): RouteClaudeEventResult {
  const {
    sessionMessages,
    bufferedEvents,
    claudeEvent,
    turnId,
    now = Date.now(),
  } = args;

  const lastMessage = sessionMessages[sessionMessages.length - 1];
  const matchingTurnIndex = findAssistantMessageIndexForTurn(sessionMessages, turnId);
  const targetIndex =
    matchingTurnIndex >= 0
      ? matchingTurnIndex
      : lastMessage && lastMessage.role === 'assistant' && lastMessage.status === 'streaming' && !turnId
        ? sessionMessages.length - 1
        : -1;

  if (targetIndex < 0) {
    return {
      action: 'buffered',
      sessionMessages,
      bufferedEvents: [...bufferedEvents, { turnId, event: claudeEvent }],
      flushedBufferedCount: 0,
      discardedBufferedCount: 0,
    };
  }

  const matchingBufferedEvents: ClaudeEvent[] = [];
  let discardedBufferedCount = 0;

  for (const bufferedEvent of bufferedEvents) {
    if (!turnId) {
      matchingBufferedEvents.push(bufferedEvent.event);
      continue;
    }

    if (bufferedEvent.turnId === turnId) {
      matchingBufferedEvents.push(bufferedEvent.event);
    } else {
      discardedBufferedCount += 1;
    }
  }

  const allEvents = [...matchingBufferedEvents, claudeEvent];
  const updatedMessages = [...sessionMessages];
  const targetMessage = updatedMessages[targetIndex];
  const isFirstAssistantResponse =
    claudeEvent.type === 'assistant' &&
    Boolean(claudeEvent.message?.content?.length) &&
    targetMessage.timestamp === 0;

  updatedMessages[targetIndex] = {
    ...targetMessage,
    events: [...(targetMessage.events ?? []), ...allEvents],
    timestamp: isFirstAssistantResponse ? now : targetMessage.timestamp,
  };

  return {
    action: 'applied',
    sessionMessages: updatedMessages,
    bufferedEvents: [],
    flushedBufferedCount: matchingBufferedEvents.length,
    discardedBufferedCount,
  };
}
