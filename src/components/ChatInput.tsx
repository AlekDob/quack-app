import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getAgentAvatar } from '../utils/agentAvatars';
import { parseAgentMentions, matchMentionsToAgents } from '../utils/agentMentions';
import duckAvatar from '../../images/duck.png';
import type { ChatAttachment, AgentInfo } from '../types';
import type { ChatSendOptions } from '../hooks/useClaudeChat';
import './ChatInput.css';

const MAX_ATTACHMENTS = 6;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_PREVIEW_SIZE = 3 * 1024 * 1024;

// Agent color mapping
const AGENT_COLORS: Record<string, string> = {
  blue: "#4A9EFF",
  purple: "#A855F7",
  green: "#10B981",
  orange: "#F59E0B",
  yellow: "#EAB308",
  red: "#EF4444",
  pink: "#EC4899",
};

interface FileStatResult {
  size: number;
  is_dir: boolean;
  is_symlink: boolean;
}

interface ChatInputProps {
  onSend: (message: string, options?: ChatSendOptions) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  agents?: AgentInfo[];
  onSelectAgent?: (agent: AgentInfo) => void;
  activeAgent?: AgentInfo | null;
  onClearAgent?: () => void;
  pendingAgentMention?: AgentInfo | null;
  onMentionInserted?: () => void;
}

export default function ChatInput({ onSend, disabled, placeholder = 'Ask Claude anything...', agents, pendingAgentMention, onMentionInserted }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Agent autocomplete state
  const [showAgentAutocomplete, setShowAgentAutocomplete] = useState(false);
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
  const [atMentionStart, setAtMentionStart] = useState(-1);

  const generateId = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  const getAgentColor = useCallback((colorName: string): string => {
    return AGENT_COLORS[colorName.toLowerCase()] || "#6B7280";
  }, []);

  // Filter agents based on current @ mention
  const filteredAgents = useMemo(() => {
    if (!agents || !showAgentAutocomplete) return [];

    const filter = agentFilter.toLowerCase();
    return agents.filter(agent => {
      const name = agent.name.toLowerCase().replace(/-/g, ' ');
      const description = agent.description.toLowerCase();
      return name.includes(filter) || description.includes(filter);
    });
  }, [agents, showAgentAutocomplete, agentFilter]);

  // Handle input change and detect @ mentions
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    setInput(newValue);

    // Check for @ mention
    if (!agents || agents.length === 0) {
      setShowAgentAutocomplete(false);
      return;
    }

    // Find the last @ before cursor
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's a space or we're at the start before @
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      const isAtWordBoundary = charBeforeAt === ' ' || charBeforeAt === '\n';

      if (isAtWordBoundary) {
        // Extract text after @ until cursor (no spaces allowed in mention)
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          // Valid @ mention
          setShowAgentAutocomplete(true);
          setAgentFilter(textAfterAt);
          setAtMentionStart(lastAtIndex);
          setSelectedAgentIndex(0);
          return;
        }
      }
    }

    // No valid @ mention found
    setShowAgentAutocomplete(false);
  }, [agents]);

  // Select an agent from autocomplete
  const selectAgent = useCallback((agent: AgentInfo) => {
    if (!textareaRef.current) return;

    // Replace the partial @mention with full agent name
    const beforeMention = input.substring(0, atMentionStart);
    const afterMention = input.substring(textareaRef.current.selectionStart);
    const fullMention = `@${agent.name} `;
    const newInput = beforeMention + fullMention + afterMention;

    setInput(newInput);
    setShowAgentAutocomplete(false);
    setAgentFilter('');
    setAtMentionStart(-1);

    // Focus back to textarea and position cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = beforeMention.length + fullMention.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [input, atMentionStart]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 50)}px`;
  }, [input]);

  // Insert agent mention when requested from panel
  useEffect(() => {
    if (!pendingAgentMention || !textareaRef.current) return;

    // Insert @mention at current cursor position
    const cursorPos = textareaRef.current.selectionStart;
    const beforeCursor = input.substring(0, cursorPos);
    const afterCursor = input.substring(cursorPos);

    // Add space before @ if needed
    const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
    const prefix = needsSpaceBefore ? ' ' : '';
    const mention = `${prefix}@${pendingAgentMention.name} `;
    const newInput = beforeCursor + mention + afterCursor;

    setInput(newInput);

    // Position cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = beforeCursor.length + mention.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);

    // Notify parent that mention was inserted
    if (onMentionInserted) {
      onMentionInserted();
    }
  }, [pendingAgentMention, onMentionInserted, input]);

  const guessMimeType = useCallback((filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
      case 'bmp':
      case 'svg':
        return `image/${extension === 'jpg' ? 'jpeg' : extension}`;
      case 'pdf':
        return 'application/pdf';
      case 'txt':
      case 'md':
      case 'log':
        return 'text/plain';
      case 'json':
        return 'application/json';
      default:
        return undefined;
    }
  }, []);

  const buildPreviewUrl = useCallback(async (path: string, mimeType?: string, size?: number) => {
    if (!mimeType || !mimeType.startsWith('image/')) {
      return undefined;
    }

    if (typeof size === 'number' && size > MAX_PREVIEW_SIZE) {
      return undefined;
    }

    try {
      const base64 = await invoke<string>('read_file_preview', { path });
      if (!base64) {
        return undefined;
      }
      return `data:${mimeType};base64,${base64}`;
    } catch (previewError) {
      console.warn('Unable to load attachment preview', previewError);
      return undefined;
    }
  }, []);

  const createAttachmentFromPath = useCallback(
    async (path: string): Promise<ChatAttachment | null> => {
      try {
        const metadata = await invoke<FileStatResult>('stat_file', { path });

        if (metadata.is_dir) {
          setError('Cannot attach directories.');
          return null;
        }

        if (metadata.size && metadata.size > MAX_FILE_SIZE) {
          setError(`File ${path.split(/[\\/]/).pop() ?? path} is larger than 15MB.`);
          return null;
        }

        const name = path.split(/[\\/]/).pop() ?? path;
        const mimeType = guessMimeType(name);
        const previewUrl = await buildPreviewUrl(path, mimeType, metadata.size ?? undefined);

        return {
          id: generateId(),
          name,
          path,
          size: metadata.size ?? 0,
          mimeType,
          previewUrl,
        };
      } catch (err) {
        console.warn('Unable to read attachment metadata', err);
        setError('Failed to add one or more files.');
        return null;
      }
    },
    [buildPreviewUrl, generateId, guessMimeType]
  );

  const handleAttach = useCallback(async () => {
    if (disabled) {
      return;
    }

    try {
      const selection = await openDialog({
        multiple: true,
        directory: false,
      });

      if (!selection) {
        return;
      }

      const paths = Array.isArray(selection) ? selection : [selection];
      if (attachments.length + paths.length > MAX_ATTACHMENTS) {
        setError(`Quack! Max ${MAX_ATTACHMENTS} attachments per message.`);
        return;
      }

      const entries: ChatAttachment[] = [];
      for (const path of paths) {
        const entry = await createAttachmentFromPath(path);
        if (entry) {
          entries.push(entry);
        }
      }

      if (entries.length > 0) {
        setAttachments((prev) => [...prev, ...entries]);
        setError(null);
      }
    } catch (err) {
      console.error('Attachment selection failed', err);
      setError('Unable to select attachments.');
    }
  }, [attachments.length, createAttachmentFromPath, disabled]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const readFileAsBase64 = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const commaIndex = result.indexOf(',');
          resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        } else {
          reject(new Error('Unsupported clipboard data'));
        }
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error('Unable to read clipboard data'));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const mimeToExtension = useCallback((mime?: string): string | undefined => {
    if (!mime) return undefined;
    const lower = mime.toLowerCase();
    switch (lower) {
      case 'image/png':
        return 'png';
      case 'image/jpeg':
        return 'jpg';
      case 'image/jpg':
        return 'jpg';
      case 'image/gif':
        return 'gif';
      case 'image/webp':
        return 'webp';
      case 'image/bmp':
        return 'bmp';
      case 'image/svg+xml':
        return 'svg';
      default:
        return undefined;
    }
  }, []);

  const handlePaste = useCallback(
    async (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled) {
        return;
      }

      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const files = Array.from(clipboardData.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (files.length === 0) {
        return;
      }

      event.preventDefault();

      const entries: ChatAttachment[] = [];

      for (const file of files) {
        if (attachments.length + entries.length >= MAX_ATTACHMENTS) {
          setError(`Quack! Max ${MAX_ATTACHMENTS} attachments per message.`);
          break;
        }

        if (file.size > MAX_FILE_SIZE) {
          setError(`Clipboard file ${file.name || '(unnamed)'} is larger than 15MB.`);
          continue;
        }

        try {
          const extensionFromMime = mimeToExtension(file.type);
          const nameExtension = (() => {
            const parts = file.name?.split('.') ?? [];
            if (parts.length > 1) {
              return parts.pop();
            }
            return undefined;
          })();
          const extension = extensionFromMime ?? nameExtension ?? 'png';
          const base64 = await readFileAsBase64(file);

          const tempPath = await invoke<string>('save_clipboard_file', {
            dataBase64: base64,
            extension,
            suggestedName: file.name ?? null,
          });

          const entry = await createAttachmentFromPath(tempPath);
          if (entry) {
            entries.push(entry);
          }
        } catch (err) {
          console.error('Failed to process pasted file', err);
          const message =
            err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
          setError(`Unable to attach pasted image: ${message}`);
        }
      }

      if (entries.length > 0) {
        setAttachments((prev) => [...prev, ...entries]);
        setError(null);
      }
    },
    [attachments.length, createAttachmentFromPath, disabled, mimeToExtension, readFileAsBase64]
  );

  const formatSize = useCallback((size: number) => {
    if (!size) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;

    await onSend(trimmed, { attachments });
    setInput('');
    setAttachments([]);
    setError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle agent autocomplete navigation
    if (showAgentAutocomplete && filteredAgents.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAgentIndex((prev) => (prev + 1) % filteredAgents.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAgentIndex((prev) => (prev - 1 + filteredAgents.length) % filteredAgents.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selectedAgent = filteredAgents[selectedAgentIndex];
        if (selectedAgent) {
          selectAgent(selectedAgent);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAgentAutocomplete(false);
        return;
      }
    }

    // Normal behavior when autocomplete is not active
    // Send on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSend();
    }
    // Send on Enter (without Shift)
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      {/* Agent autocomplete dropdown */}
      {showAgentAutocomplete && filteredAgents.length > 0 && (
        <div className="agent-autocomplete">
          {filteredAgents.map((agent, index) => (
            <button
              key={agent.name}
              type="button"
              className={`agent-autocomplete-item ${selectedAgentIndex === index ? 'selected' : ''}`}
              onClick={() => selectAgent(agent)}
              onMouseEnter={() => setSelectedAgentIndex(index)}
            >
              <div
                className="agent-autocomplete-badge"
                style={{ backgroundColor: getAgentColor(agent.color) }}
              />
              <div className="agent-autocomplete-info">
                <div className="agent-autocomplete-name">
                  {agent.name.replace(/-/g, ' ')}
                </div>
                <div className="agent-autocomplete-description">
                  {agent.description.length > 50
                    ? `${agent.description.substring(0, 50)}...`
                    : agent.description}
                </div>
              </div>
              <div className="agent-autocomplete-model">{agent.model}</div>
            </button>
          ))}
        </div>
      )}
      <div className="chat-input-wrapper">
        {/* Show agent mention chips */}
        {(() => {
          const mentions = parseAgentMentions(input);
          if (mentions.length === 0 || !agents) return null;

          const matchedAgents = matchMentionsToAgents(input, agents);
          if (matchedAgents.length === 0) return null;

          return (
            <div className="chat-input-mentions">
              {matchedAgents.map((agent, idx) => {
                const avatarPath = getAgentAvatar(agent.name) || duckAvatar;
                return (
                  <div key={idx} className="chat-input-mention-chip">
                    <img
                      src={avatarPath}
                      alt={agent.name}
                      className="chat-input-mention-avatar"
                    />
                    <span className="chat-input-mention-name">@{agent.name}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        <div className="chat-input-field-row">
          <textarea
            ref={textareaRef}
            className="chat-input-field"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
          />
          <div className="chat-input-actions">
          <button
            type="button"
            className="chat-input-action-btn"
            onClick={handleAttach}
            disabled={disabled}
            data-tooltip="Attach files"
            aria-label="Attach files"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.5 3.5a2.5 2.5 0 0 1 5 0V11h-1V3.5a1.5 1.5 0 0 0-3 0V12a3 3 0 1 1-6 0V3h1v9a2 2 0 1 0 4 0V3.5Z"/>
            </svg>
          </button>
          <button
            type="button"
            className="chat-input-action-btn"
            disabled={disabled}
            data-tooltip="AI Assistant"
            aria-label="AI Assistant"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1Z" opacity="0.8"/>
              <path d="M12 2l0.5 1.5L14 4l-1.5 0.5L12 6l-0.5-1.5L10 4l1.5-0.5L12 2Z" opacity="0.6"/>
            </svg>
          </button>
          <button
            type="button"
            className="chat-input-action-btn"
            disabled={disabled}
            data-tooltip="Voice input"
            aria-label="Voice input"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2Z"/>
              <path d="M4 7v1a4 4 0 0 0 8 0V7h1v1a5 5 0 0 1-4.5 4.975V15h3v1h-7v-1h3v-2.025A5 5 0 0 1 3 8V7h1Z"/>
            </svg>
          </button>
          <button
            type="button"
            className="chat-input-send"
            onClick={() => {
              void handleSend();
            }}
            disabled={disabled || (!input.trim() && attachments.length === 0)}
            data-tooltip="Send (⌘+Enter)"
            aria-label="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 8L14 2L8 14L6.5 9.5L2 8Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          </div>
        </div>
      </div>
      {attachments.length > 0 && (
        <div className="chat-attachments">
          {attachments.map((attachment) => {
            const isImage = attachment.previewUrl !== undefined;
            return (
              <div key={attachment.id} className="chat-attachment">
                <div className="chat-attachment-preview">
                  {isImage ? (
                    <img src={attachment.previewUrl} alt={attachment.name} />
                  ) : (
                    <svg className="chat-attachment-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7Z" opacity="0.5"/>
                      <path d="M13 2v7h7"/>
                    </svg>
                  )}
                </div>
                <div className="chat-attachment-meta">
                  <span className="chat-attachment-name">{attachment.name}</span>
                  <span className="chat-attachment-size">{formatSize(attachment.size)}</span>
                </div>
                <button
                  type="button"
                  className="chat-attachment-remove"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  aria-label="Remove attachment"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
      {error && <div className="chat-input-error">{error}</div>}
    </div>
  );
}
