import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import './TelegramSetup.css';

interface TelegramSetupProps {
  onClose?: () => void;
}

interface UserLinkedPayload {
  unique_id: string;
  telegram_chat_id: number;
}

export default function TelegramSetup({ onClose }: TelegramSetupProps) {
  const [uniqueId, setUniqueId] = useState<string>('');
  const [deepLink, setDeepLink] = useState<string>('');
  const [isLinked, setIsLinked] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);

  // Generate unique ID on mount and initialize bot token
  useEffect(() => {
    const init = async () => {
      try {
        console.log('🦆 [TelegramSetup] Initializing...');

        // Initialize Quack Central Bot token (JackTheDuck_bot)
        await invoke('initialize_central_bot_token');
        console.log('🦆 [TelegramSetup] Bot token initialized');

        // Check if user is already linked
        const [savedUniqueId, savedChatId] = await invoke<[string | null, number | null]>('get_telegram_link');

        if (savedUniqueId && savedChatId) {
          // User is already linked, restore state
          console.log('🦆 [TelegramSetup] Found existing link:', savedUniqueId, savedChatId);
          setUniqueId(savedUniqueId);
          setChatId(savedChatId);
          setIsLinked(true);

          // Generate deep link for the saved ID (for display purposes)
          const link = await invoke<string>('generate_telegram_deep_link', { uniqueId: savedUniqueId });
          setDeepLink(link);

          // Check if polling is active
          // Note: polling state is managed globally, so we just assume it's running if linked
          setIsPolling(true);
        } else {
          // Generate new unique ID for this installation
          const id = await invoke<string>('generate_unique_id');
          console.log('🦆 [TelegramSetup] Generated new unique ID:', id);
          setUniqueId(id);

          // Generate deep link
          const link = await invoke<string>('generate_telegram_deep_link', { uniqueId: id });
          console.log('🦆 [TelegramSetup] Generated deep link:', link);
          setDeepLink(link);
        }
      } catch (err) {
        console.error('🦆 [TelegramSetup] Initialization error:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    init();
  }, []);

  // Listen for user linked event
  useEffect(() => {
    const unlisten = listen<UserLinkedPayload>('telegram-user-linked', async (event) => {
      if (event.payload.unique_id === uniqueId) {
        setIsLinked(true);
        setChatId(event.payload.telegram_chat_id);
        setError(null);

        // Save to preferences
        try {
          await invoke('save_telegram_link', {
            uniqueId: event.payload.unique_id,
            chatId: event.payload.telegram_chat_id,
          });
          console.log('🦆 Telegram link saved to preferences');
        } catch (err) {
          console.error('Failed to save Telegram link:', err);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [uniqueId]);

  // Listen for polling status
  useEffect(() => {
    const unlistenStart = listen('telegram-polling-started', () => {
      console.log('🦆 [TelegramSetup] Polling started event received');
      setIsPolling(true);
    });

    const unlistenStop = listen('telegram-polling-stopped', () => {
      console.log('🦆 [TelegramSetup] Polling stopped event received');
      setIsPolling(false);
    });

    return () => {
      unlistenStart.then((fn) => fn());
      unlistenStop.then((fn) => fn());
    };
  }, []);

  const handleStartPolling = async () => {
    console.log('🦆 [TelegramSetup] Starting polling...');
    try {
      await invoke('start_telegram_polling');
      console.log('🦆 [TelegramSetup] Polling command sent successfully');
      setError(null);
    } catch (err) {
      console.error('🦆 [TelegramSetup] Error starting polling:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStopPolling = async () => {
    try {
      await invoke('stop_telegram_polling');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenTelegram = async () => {
    try {
      await open(deepLink);
    } catch (err) {
      setError('Failed to open Telegram link. Please copy and paste it manually.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(deepLink);
    // Could add a toast notification here
  };

  return (
    <div className="telegram-setup-drawer open" role="dialog" aria-modal="true">
      <div
        className="telegram-setup-drawer-backdrop"
        onClick={onClose}
        role="presentation"
      />
      <div className="telegram-setup-drawer-panel">
        <div className="telegram-setup-header">
        <div className="telegram-setup-header-content">
          <svg className="telegram-setup-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.38 15.84 14.22 15.51 15.99C15.37 16.74 15.09 16.99 14.83 17.01C14.25 17.07 13.81 16.64 13.25 16.27C12.37 15.69 11.87 15.33 11.02 14.77C10.03 14.12 10.67 13.76 11.24 13.18C11.39 13.03 13.95 10.7 14 10.49C14.0069 10.4582 14.006 10.4252 13.9973 10.3938C13.9886 10.3624 13.9724 10.3337 13.95 10.31C13.89 10.26 13.81 10.28 13.74 10.29C13.65 10.31 12.25 11.24 9.52 13.08C9.12 13.35 8.76 13.49 8.44 13.48C8.08 13.47 7.4 13.28 6.89 13.11C6.26 12.91 5.77 12.8 5.81 12.45C5.83 12.27 6.08 12.09 6.55 11.9C9.47 10.63 11.41 9.79 12.38 9.39C15.16 8.23 15.73 8.03 16.11 8.03C16.19 8.03 16.38 8.05 16.5 8.15C16.6 8.23 16.63 8.34 16.64 8.42C16.63 8.48 16.65 8.66 16.64 8.8Z" fill="currentColor"/>
          </svg>
          <h2>Connect Telegram</h2>
        </div>
        {onClose && (
          <button className="telegram-setup-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      <div className="telegram-setup-content">
        {!isLinked ? (
          <>
            <div className="telegram-setup-step">
              <div className="telegram-setup-step-number">1</div>
              <div className="telegram-setup-step-content">
                <h3>Start Polling Service</h3>
                <p>First, start the Telegram polling service to receive messages.</p>
                <button
                  className={`telegram-setup-button ${isPolling ? 'telegram-setup-button-stop' : ''}`}
                  onClick={isPolling ? handleStopPolling : handleStartPolling}
                >
                  {isPolling ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/>
                      </svg>
                      Stop Polling
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M5 3L13 8L5 13V3Z" fill="currentColor"/>
                      </svg>
                      Start Polling
                    </>
                  )}
                </button>
                {isPolling && (
                  <div className="telegram-setup-status">
                    <span className="telegram-setup-status-indicator"></span>
                    Polling active
                  </div>
                )}
              </div>
            </div>

            <div className="telegram-setup-step">
              <div className="telegram-setup-step-number">2</div>
              <div className="telegram-setup-step-content">
                <h3>Open Telegram</h3>
                <p>Click the button below to open Telegram and start the bot.</p>
                <button
                  className="telegram-setup-button telegram-setup-button-primary"
                  onClick={handleOpenTelegram}
                  disabled={!isPolling}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1C4.134 1 1 4.134 1 8C1 11.866 4.134 15 8 15C11.866 15 15 11.866 15 8C15 4.134 11.866 1 8 1ZM11.093 5.867C10.993 7.12 10.493 10.147 10.253 11.493C10.153 12.093 9.933 12.293 9.72 12.307C9.267 12.347 8.92 12.013 8.467 11.72C7.78 11.293 7.387 11.02 6.72 10.58C5.953 10.08 6.447 9.807 6.9 9.347C7.02 9.227 9.033 7.447 9.067 7.287C9.067 7.267 9.073 7.24 9.06 7.22C9.047 7.2 9.02 7.207 9 7.213C8.973 7.22 8.267 7.673 6.907 8.72C6.627 8.9 6.373 8.993 6.147 8.987C5.893 8.98 5.413 8.853 5.053 8.74C4.607 8.607 4.247 8.533 4.273 8.3C4.287 8.18 4.473 8.06 4.833 7.933C6.58 7.087 7.74 6.527 8.32 6.26C9.973 5.487 10.38 5.353 10.64 5.353C10.693 5.353 10.827 5.367 10.913 5.433C10.987 5.487 11.007 5.56 11.013 5.613C11.007 5.653 11.02 5.773 11.093 5.867Z" fill="currentColor"/>
                  </svg>
                  Open Telegram
                </button>
              </div>
            </div>

            <div className="telegram-setup-step">
              <div className="telegram-setup-step-number">3</div>
              <div className="telegram-setup-step-content">
                <h3>Or Copy Link</h3>
                <p>Alternatively, copy this link and open it in Telegram:</p>
                <div className="telegram-setup-link-box">
                  <code className="telegram-setup-link">{deepLink}</code>
                  <button
                    className="telegram-setup-copy-button"
                    onClick={handleCopyLink}
                    title="Copy link"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      <path d="M3 11V3C3 2.44772 3.44772 2 4 2H10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="telegram-setup-your-id">
              <strong>Your ID:</strong> <code>{uniqueId}</code>
            </div>

            {error && (
              <div className="telegram-setup-error">
                <svg className="telegram-setup-error-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M10 6V10M10 13H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <div className="telegram-setup-waiting">
              <div className="telegram-setup-spinner"></div>
              <p>Waiting for connection...</p>
            </div>
          </>
        ) : (
          <div className="telegram-setup-success">
            <div className="telegram-setup-success-icon-wrapper">
              <svg className="telegram-setup-success-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="url(#successGradient)" opacity="0.1"/>
                <circle cx="24" cy="24" r="22" stroke="url(#successGradient)" strokeWidth="2"/>
                <path d="M16 24L22 30L32 18" stroke="url(#successGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="successGradient" x1="0" y1="0" x2="48" y2="48">
                    <stop offset="0%" stopColor="#10b981"/>
                    <stop offset="100%" stopColor="#059669"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h3>Successfully Connected</h3>
            <p>Your Quack app is now linked to Telegram</p>
            <div className="telegram-setup-info">
              <div className="telegram-setup-info-item">
                <span className="telegram-setup-info-label">User ID</span>
                <code className="telegram-setup-info-value">{uniqueId}</code>
              </div>
              <div className="telegram-setup-info-divider"></div>
              <div className="telegram-setup-info-item">
                <span className="telegram-setup-info-label">Chat ID</span>
                <code className="telegram-setup-info-value">{chatId}</code>
              </div>
            </div>
            <p className="telegram-setup-next-steps">
              Start receiving real-time notifications from your agents
            </p>
            {onClose && (
              <button className="telegram-setup-button telegram-setup-button-primary" onClick={onClose}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13 8L3 8M8 3L13 8L8 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Continue
              </button>
            )}
          </div>
        )}
      </div>

        <div className="telegram-setup-footer">
          <p className="telegram-setup-footer-text">
            Quack Central Bot · One bot for all your agents
          </p>
        </div>
      </div>
    </div>
  );
}
