import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { ChatAttachment } from '../types';
import type { ChatSendOptions } from '../hooks/useClaudeChat';
import './ChatInput.css';

const MAX_ATTACHMENTS = 6;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_PREVIEW_SIZE = 3 * 1024 * 1024;

interface FileStatResult {
  size: number;
  is_dir: boolean;
  is_symlink: boolean;
}

interface ChatInputProps {
  onSend: (message: string, options?: ChatSendOptions) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder = 'Ask Claude anything...' }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const generateId = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

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
        try {
          const metadata = await invoke<FileStatResult>('stat_file', { path });

          if (metadata.is_dir) {
            setError('Cannot attach directories.');
            continue;
          }

          if (metadata.size && metadata.size > MAX_FILE_SIZE) {
            setError(`File ${path.split(/[\\/]/).pop() ?? path} is larger than 15MB.`);
            continue;
          }

          const name = path.split(/[\\/]/).pop() ?? path;
          const mimeType = guessMimeType(name);
          const previewUrl = await buildPreviewUrl(path, mimeType, metadata.size ?? undefined);
          entries.push({
            id: generateId(),
            name,
            path,
            size: metadata.size ?? 0,
            mimeType,
            previewUrl,
          });
        } catch (err) {
          console.warn('Unable to read attachment metadata', err);
          setError('Failed to add one or more files.');
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
  }, [attachments.length, buildPreviewUrl, disabled, generateId, guessMimeType]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

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
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />
        <div className="chat-input-actions">
          <button
            type="button"
            className="chat-input-attach"
            onClick={handleAttach}
            disabled={disabled}
            title="Attach files"
          >
            📎
          </button>
          <button
            type="button"
            className="chat-input-send"
            onClick={() => {
              void handleSend();
            }}
            disabled={disabled || (!input.trim() && attachments.length === 0)}
            title="Send message (⌘+Enter)"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 10L17 3L10 17L8.5 11.5L3 10Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
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
                    <span className="chat-attachment-icon">📄</span>
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
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
      {error && <div className="chat-input-error">{error}</div>}
      <div className="chat-input-hint">
        <span>Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line</span>
      </div>
    </div>
  );
}
