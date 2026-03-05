import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { ClaudeSession } from '../types';

interface TelegramNewAgentPayload {
  prompt: string;
  telegram_chat_id: number;
  telegram_message_id: number;
}

interface TelegramStopAgentPayload {
  session_id: string;
  telegram_chat_id: number;
}

interface TelegramChatPayload {
  session_id: string;
  message: string;
  telegram_chat_id: number;
}

interface TelegramScreenshotPayload {
  session_id: string;
  telegram_chat_id: number;
}

interface TelegramCallbackPayload {
  session_id: string;
}

interface UseTelegramBotProps {
  sessions: ClaudeSession[];
  onNewAgent: (prompt: string, telegramChatId?: number) => Promise<string | null>;
  onStopAgent: (sessionId: string) => Promise<void>;
  onSendMessage: (sessionId: string, message: string) => Promise<void>;
  onRequestScreenshot?: (sessionId: string) => Promise<string | null>;
}

export function useTelegramBot({
  sessions,
  onNewAgent,
  onStopAgent,
  onSendMessage,
  onRequestScreenshot,
}: UseTelegramBotProps) {
  // Send agent status to Telegram
  const sendStatusToTelegram = useCallback(
    async (chatId: number) => {
      try {
        if (sessions.length === 0) {
          await invoke('send_telegram_message', {
            payload: {
              chat_id: chatId,
              text: '🦆 *No Active Agents*\n\nThere are no agents currently running.',
            },
          });
          return;
        }

        const statusLines = sessions.map((session) => {
          const status = session.isStreaming ? '🟡 Working' : '🟢 Idle';
          const name = session.name || 'Unnamed Agent';
          return `• *${name}* (${session.id.slice(0, 8)})\n  Status: ${status}`;
        });

        const message = `🦆 *Active Agents* (${sessions.length})\n\n${statusLines.join('\n\n')}`;

        await invoke('send_telegram_message', {
          payload: {
            chat_id: chatId,
            text: message,
          },
        });
      } catch (error) {
        console.error('🦆 Failed to send status to Telegram:', error);
      }
    },
    [sessions]
  );

  // Send agent notification (start/stop/error)
  const sendAgentNotification = useCallback(async (chatId: number, sessionId: string, message: string, showActions = false) => {
    try {
      await invoke('send_telegram_notification_command', {
        payload: {
          chat_id: chatId,
          session_id: sessionId,
          message,
          show_actions: showActions,
        },
      });
    } catch (error) {
      console.error('🦆 Failed to send Telegram notification:', error);
    }
  }, []);

  // Handle Telegram commands
  useEffect(() => {
    // /status command
    const unlistenStatus = listen('telegram-command-status', async () => {
      console.log('🦆 Telegram: /status command received');
      // Status will be sent by sendStatusToTelegram when requested
    });

    // /new command
    const unlistenNew = listen<TelegramNewAgentPayload>('telegram-command-new', async (event) => {
      console.log('🦆 Telegram: /new command received', event.payload);
      const { prompt, telegram_chat_id } = event.payload;

      try {
        const sessionId = await onNewAgent(prompt, telegram_chat_id);
        if (sessionId) {
          await sendAgentNotification(
            telegram_chat_id,
            sessionId,
            `🦆 *Agent Started*\n\nSession ID: \`${sessionId.slice(0, 8)}\`\nPrompt: ${prompt}`,
            true
          );
        } else {
          await invoke('send_telegram_message', {
            payload: {
              chat_id: telegram_chat_id,
              text: '❌ Failed to start agent. Please try again.',
            },
          });
        }
      } catch (error) {
        console.error('🦆 Failed to start agent from Telegram:', error);
        await invoke('send_telegram_message', {
          payload: {
            chat_id: telegram_chat_id,
            text: `❌ Error starting agent: ${error}`,
          },
        });
      }
    });

    // /stop command
    const unlistenStop = listen<TelegramStopAgentPayload>('telegram-command-stop', async (event) => {
      console.log('🦆 Telegram: /stop command received', event.payload);
      const { session_id, telegram_chat_id } = event.payload;

      try {
        await onStopAgent(session_id);
        await invoke('send_telegram_message', {
          payload: {
            chat_id: telegram_chat_id,
            text: `🦆 *Agent Stopped*\n\nSession ID: \`${session_id.slice(0, 8)}\``,
          },
        });
      } catch (error) {
        console.error('🦆 Failed to stop agent from Telegram:', error);
        await invoke('send_telegram_message', {
          payload: {
            chat_id: telegram_chat_id,
            text: `❌ Error stopping agent: ${error}`,
          },
        });
      }
    });

    // /chat command
    const unlistenChat = listen<TelegramChatPayload>('telegram-command-chat', async (event) => {
      console.log('🦆 Telegram: /chat command received', event.payload);
      const { session_id, message, telegram_chat_id } = event.payload;

      try {
        await onSendMessage(session_id, message);
        await invoke('send_telegram_message', {
          payload: {
            chat_id: telegram_chat_id,
            text: `🦆 *Message Sent*\n\nSession ID: \`${session_id.slice(0, 8)}\`\nMessage: ${message}`,
          },
        });
      } catch (error) {
        console.error('🦆 Failed to send message to agent from Telegram:', error);
        await invoke('send_telegram_message', {
          payload: {
            chat_id: telegram_chat_id,
            text: `❌ Error sending message: ${error}`,
          },
        });
      }
    });

    // /screenshot command
    const unlistenScreenshot = listen<TelegramScreenshotPayload>('telegram-command-screenshot', async (event) => {
      console.log('🦆 Telegram: /screenshot command received', event.payload);
      const { session_id, telegram_chat_id } = event.payload;

      if (!onRequestScreenshot) {
        await invoke('send_telegram_message', {
          payload: {
            chat_id: telegram_chat_id,
            text: '❌ Screenshot feature is not available.',
          },
        });
        return;
      }

      try {
        const screenshotPath = await onRequestScreenshot(session_id);
        if (screenshotPath) {
          await invoke('send_telegram_photo', {
            payload: {
              chat_id: telegram_chat_id,
              photo_path: screenshotPath,
              caption: `🦆 Screenshot from session: \`${session_id.slice(0, 8)}\``,
            },
          });
        } else {
          await invoke('send_telegram_message', {
            payload: {
              chat_id: telegram_chat_id,
              text: `❌ Failed to capture screenshot for session: ${session_id}`,
            },
          });
        }
      } catch (error) {
        console.error('🦆 Failed to send screenshot to Telegram:', error);
        await invoke('send_telegram_message', {
          payload: {
            chat_id: telegram_chat_id,
            text: `❌ Error capturing screenshot: ${error}`,
          },
        });
      }
    });

    // Callback query handlers (inline buttons)
    const unlistenApprove = listen<TelegramCallbackPayload>('telegram-callback-approve', async (event) => {
      console.log('🦆 Telegram: Approve callback received', event.payload);
      // Handle approval action (e.g., continue execution, approve tool use)
      // Implementation depends on your agent logic
    });

    const unlistenCancel = listen<TelegramCallbackPayload>('telegram-callback-cancel', async (event) => {
      console.log('🦆 Telegram: Cancel callback received', event.payload);
      const { session_id } = event.payload;
      await onStopAgent(session_id);
    });

    const unlistenRetry = listen<TelegramCallbackPayload>('telegram-callback-retry', async (event) => {
      console.log('🦆 Telegram: Retry callback received', event.payload);
      // Handle retry action
      // Implementation depends on your agent logic
    });

    return () => {
      unlistenStatus.then((fn) => fn());
      unlistenNew.then((fn) => fn());
      unlistenStop.then((fn) => fn());
      unlistenChat.then((fn) => fn());
      unlistenScreenshot.then((fn) => fn());
      unlistenApprove.then((fn) => fn());
      unlistenCancel.then((fn) => fn());
      unlistenRetry.then((fn) => fn());
    };
  }, [onNewAgent, onStopAgent, onSendMessage, onRequestScreenshot, sendAgentNotification]);

  return {
    sendStatusToTelegram,
    sendAgentNotification,
  };
}
