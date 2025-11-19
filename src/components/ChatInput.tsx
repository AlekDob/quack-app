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
import { parseAgentMentions, matchMentionsToAgents } from '../utils/agentMentions';
import { AgentMentionChip } from './AgentMentionChip';
import type { ChatAttachment, AgentInfo, SearchResult } from '../types';
import type { ChatSendOptions } from '../hooks/useClaudeChat';
import { useSlashCommands, type SlashCommand } from '../hooks/useSlashCommands';
import { useMicRecorder } from '../hooks/useMicRecorder';
import VoiceRecordingModal from './VoiceRecordingModal';
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
  pendingFileMention?: { name: string; path: string; relativePath: string } | null;
  onFileMentionInserted?: () => void;
  pendingSlashCommand?: { name: string; description: string } | null;
  onCommandInserted?: () => void;
  basePath?: string;
  // Controlled input value
  inputValue?: string;
  onInputChange?: (value: string) => void;
  // Streaming control
  isStreaming?: boolean;
  onAbort?: () => void;
  lastPrompt?: string;
  // OpenAI API key for Whisper
  openaiApiKey?: string;
  // Open Prompt Engineer
  onOpenPromptEngineer?: () => void;
  // Working on field
  workingOn?: string;
  onWorkingOnChange?: (value: string) => void;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = 'Ask Claude anything...',
  agents,
  pendingAgentMention,
  onMentionInserted,
  pendingFileMention,
  onFileMentionInserted,
  pendingSlashCommand,
  onCommandInserted,
  basePath,
  inputValue: controlledInputValue,
  onInputChange: controlledOnInputChange,
  isStreaming = false,
  onAbort,
  lastPrompt,
  openaiApiKey,
  onOpenPromptEngineer,
  workingOn = '',
  onWorkingOnChange,
}: ChatInputProps) {
  // Use local state as fallback if not controlled
  const [localInput, setLocalInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine if controlled or uncontrolled
  const isControlled = controlledInputValue !== undefined && controlledOnInputChange !== undefined;
  const input = isControlled ? controlledInputValue : localInput;
  const setInput = isControlled ? controlledOnInputChange : setLocalInput;

  // Load slash commands
  const { commands: commandsResponse } = useSlashCommands(basePath || '');

  // Flatten commands for autocomplete (builtin + custom)
  const commands = useMemo(() => {
    return [...commandsResponse.builtin, ...commandsResponse.custom];
  }, [commandsResponse]);

  // Agent autocomplete state
  const [showAgentAutocomplete, setShowAgentAutocomplete] = useState(false);
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
  const [atMentionStart, setAtMentionStart] = useState(-1);

  // File search state for @ mentions
  const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([]);
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);
  const fileSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag & drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Working on popover state
  const [showWorkingOnPopover, setShowWorkingOnPopover] = useState(false);
  const [workingOnValue, setWorkingOnValue] = useState(workingOn);
  const workingOnRef = useRef<HTMLDivElement>(null);

  // Sync workingOn prop with local state
  useEffect(() => {
    setWorkingOnValue(workingOn);
  }, [workingOn]);

  // Update workingOn when popover closes (only if value changed)
  useEffect(() => {
    // When popover closes, update the value if it changed
    if (!showWorkingOnPopover && workingOnValue !== workingOn && onWorkingOnChange) {
      onWorkingOnChange(workingOnValue);
    }
  }, [showWorkingOnPopover, workingOnValue, workingOn, onWorkingOnChange]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!showWorkingOnPopover) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (workingOnRef.current && !workingOnRef.current.contains(event.target as Node)) {
        setShowWorkingOnPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWorkingOnPopover]);

  // Slash command autocomplete state
  const [showCommandAutocomplete, setShowCommandAutocomplete] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [slashCommandStart, setSlashCommandStart] = useState(-1);

  // Voice recording state
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // XML tag auto-complete state
  const [xmlTagPair, setXmlTagPair] = useState<{ start: number; end: number; tagName: string } | null>(null);

  // Microphone recorder hook (uses tauri-plugin-mic-recorder + Whisper API)
  const {
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    cancelListening,
    audioLevel,
  } = useMicRecorder({
    lang: 'it', // Italian by default
    apiKey: openaiApiKey,
    onResult: (text, isFinal) => {
      if (isFinal) {
        // Append final transcript to input
        // Handle both controlled and uncontrolled modes
        const currentValue = input || '';
        const needsSpace = currentValue.length > 0 && !currentValue.endsWith(' ') && !currentValue.endsWith('\n');
        const newValue = currentValue + (needsSpace ? ' ' : '') + text;
        setInput(newValue);

        // Close modal automatically after transcription is complete
        setShowVoiceModal(false);

        // Focus back to textarea
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 100);
      }
    },
  });

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

  // Search files when @ mention is active
  useEffect(() => {
    // Clear previous timeout
    if (fileSearchTimeoutRef.current) {
      clearTimeout(fileSearchTimeoutRef.current);
    }

    // Only search files if @ autocomplete is showing and we have basePath
    if (!showAgentAutocomplete || !basePath || !agentFilter.trim()) {
      setFileSearchResults([]);
      setIsSearchingFiles(false);
      return;
    }

    // Debounce file search by 300ms
    fileSearchTimeoutRef.current = setTimeout(() => {
      setIsSearchingFiles(true);

      invoke<SearchResult[]>("search_files_recursive", {
        path: basePath,
        query: agentFilter.trim(),
        maxResults: 20, // Limit to 20 files for @ mentions
        maxDepth: 10,
      })
        .then((results) => {
          setFileSearchResults(results);
        })
        .catch((err) => {
          console.error("File search error:", err);
          setFileSearchResults([]);
        })
        .finally(() => {
          setIsSearchingFiles(false);
        });
    }, 300);

    return () => {
      if (fileSearchTimeoutRef.current) {
        clearTimeout(fileSearchTimeoutRef.current);
      }
    };
  }, [showAgentAutocomplete, agentFilter, basePath]);

  // Filter commands based on current / command
  const filteredCommands = useMemo(() => {
    if (!commands || !showCommandAutocomplete) return [];

    const filter = commandFilter.toLowerCase();
    return commands.filter(command => {
      const name = command.name.toLowerCase();
      const description = command.description.toLowerCase();
      return name.includes(filter) || description.includes(filter);
    });
  }, [commands, showCommandAutocomplete, commandFilter]);

  // Handle input change and detect @ mentions and / commands
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    setInput(newValue);

    const textBeforeCursor = newValue.substring(0, cursorPos);

    // Check for / command first (at start of line or after newline)
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    if (lastSlashIndex !== -1 && commands && commands.length > 0) {
      // Check if / is at start or after newline
      const charBeforeSlash = lastSlashIndex > 0 ? textBeforeCursor[lastSlashIndex - 1] : '\n';
      const isAtLineStart = charBeforeSlash === '\n' || lastSlashIndex === 0;

      if (isAtLineStart) {
        const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1);

        if (!textAfterSlash.includes(' ') && !textAfterSlash.includes('\n')) {
          // Valid / command
          setShowCommandAutocomplete(true);
          setCommandFilter(textAfterSlash);
          setSlashCommandStart(lastSlashIndex);
          setSelectedCommandIndex(0);
          setShowAgentAutocomplete(false); // Hide agent autocomplete
          return;
        }
      }
    }

    // Check for @ mention
    if (!agents || agents.length === 0) {
      setShowAgentAutocomplete(false);
      setShowCommandAutocomplete(false);
      return;
    }

    // Find the last @ before cursor
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
          setShowCommandAutocomplete(false); // Hide command autocomplete
          return;
        }
      }
    }

    // No valid @ mention or / command found
    setShowAgentAutocomplete(false);
    setShowCommandAutocomplete(false);
  }, [agents, commands, setInput]);

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
    setFileSearchResults([]);

    // Focus back to textarea and position cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = beforeMention.length + fullMention.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [input, atMentionStart, setInput]);

  // Select a file from autocomplete
  const selectFile = useCallback((file: SearchResult) => {
    if (!textareaRef.current) return;

    // Replace the partial @mention with file path (use relative_path for cleaner display)
    const beforeMention = input.substring(0, atMentionStart);
    const afterMention = input.substring(textareaRef.current.selectionStart);
    const fullMention = `@file:${file.relative_path} `;
    const newInput = beforeMention + fullMention + afterMention;

    setInput(newInput);
    setShowAgentAutocomplete(false);
    setAgentFilter('');
    setAtMentionStart(-1);
    setFileSearchResults([]);

    // Focus back to textarea and position cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = beforeMention.length + fullMention.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [input, atMentionStart, setInput]);

  // Select a command from autocomplete
  const selectCommand = useCallback((command: SlashCommand) => {
    if (!textareaRef.current) return;

    // Replace the partial /command with full command name
    const beforeCommand = input.substring(0, slashCommandStart);
    const afterCommand = input.substring(textareaRef.current.selectionStart);
    const fullCommand = `/${command.name} `;
    const newInput = beforeCommand + fullCommand + afterCommand;

    setInput(newInput);
    setShowCommandAutocomplete(false);
    setCommandFilter('');
    setSlashCommandStart(-1);

    // Focus back to textarea and position cursor after command
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = beforeCommand.length + fullCommand.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [input, slashCommandStart, setInput]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (isFocused) {
      // When focused, expand to 120px regardless of content
      textarea.style.height = '120px';
    } else {
      // When not focused, remove inline height to let CSS min-height take control
      textarea.style.height = '';
    }
  }, [input, isFocused]);

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
  }, [pendingAgentMention, onMentionInserted, input, setInput]);

  // Insert file mention when requested from FileExplorer
  useEffect(() => {
    if (!pendingFileMention || !textareaRef.current) return;

    // Insert @file:path at current cursor position
    const cursorPos = textareaRef.current.selectionStart;
    const beforeCursor = input.substring(0, cursorPos);
    const afterCursor = input.substring(cursorPos);

    // Add space before @ if needed
    const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
    const prefix = needsSpaceBefore ? ' ' : '';
    const mention = `${prefix}@file:${pendingFileMention.relativePath} `;
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

    // Notify parent that file mention was inserted
    if (onFileMentionInserted) {
      onFileMentionInserted();
    }
  }, [pendingFileMention, onFileMentionInserted, input, setInput]);

  // Insert slash command when requested from panel
  useEffect(() => {
    if (!pendingSlashCommand || !textareaRef.current) return;

    // Insert /command at current cursor position (or at start of line if empty)
    const cursorPos = textareaRef.current.selectionStart;
    const beforeCursor = input.substring(0, cursorPos);
    const afterCursor = input.substring(cursorPos);

    // Check if we're at the start of a line
    const isAtLineStart = beforeCursor.length === 0 || beforeCursor.endsWith('\n');

    // Add newline before / if needed (not at start and not after newline)
    const prefix = !isAtLineStart && beforeCursor.length > 0 ? '\n' : '';
    const command = `${prefix}/${pendingSlashCommand.name} `;
    const newInput = beforeCursor + command + afterCursor;

    setInput(newInput);

    // Position cursor after command
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = beforeCursor.length + command.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);

    // Notify parent that command was inserted
    if (onCommandInserted) {
      onCommandInserted();
    }
  }, [pendingSlashCommand, onCommandInserted, input, setInput]);

  // Auto-update XML closing tag when editing opening tag
  useEffect(() => {
    if (!textareaRef.current || !xmlTagPair) return;

    const cursorPos = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;
    const hasSelection = cursorPos !== selectionEnd;

    // Find the opening tag boundaries
    const openingTagStart = xmlTagPair.start;
    const openingTagEnd = input.indexOf('>', openingTagStart);

    if (openingTagEnd === -1) {
      // Opening tag malformed or incomplete
      setXmlTagPair(null);
      return;
    }

    // Check if cursor is within the opening tag (including selection)
    const isWithinOpeningTag = cursorPos >= openingTagStart && cursorPos <= openingTagEnd + 1;

    if (!isWithinOpeningTag && !hasSelection) {
      // User moved cursor outside the opening tag, stop tracking
      setXmlTagPair(null);
      return;
    }

    // Extract current tag name from opening tag
    const currentOpeningTag = input.substring(openingTagStart, openingTagEnd + 1);
    const tagNameMatch = currentOpeningTag.match(/<(\w+)/);

    if (!tagNameMatch) {
      // Tag name is gone or malformed
      setXmlTagPair(null);
      return;
    }

    const newTagName = tagNameMatch[1];

    // Only update if tag name actually changed
    if (newTagName !== xmlTagPair.tagName) {
      // Find the closing tag
      const expectedClosingTag = `</${xmlTagPair.tagName}>`;
      const closingTagStart = input.lastIndexOf(expectedClosingTag);

      if (closingTagStart !== -1 && closingTagStart > openingTagEnd) {
        // Replace old closing tag with new one
        const beforeClosing = input.substring(0, closingTagStart);
        const afterClosing = input.substring(closingTagStart + expectedClosingTag.length);
        const newInput = beforeClosing + `</${newTagName}>` + afterClosing;

        // Update state
        setInput(newInput);
        setXmlTagPair({
          start: xmlTagPair.start,
          end: xmlTagPair.end,
          tagName: newTagName
        });

        // Preserve cursor/selection position
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            if (hasSelection) {
              // Restore selection if user had text selected
              textareaRef.current.setSelectionRange(cursorPos, selectionEnd);
            } else {
              // Restore cursor position
              textareaRef.current.setSelectionRange(cursorPos, cursorPos);
            }
          }
        }, 0);
      }
    }
  }, [input, xmlTagPair, setInput]);

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
    const trimmed = (input || '').trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;

    await onSend(trimmed, { attachments });
    setInput('');
    setAttachments([]);
    setError(null);
  };

  const handleStop = () => {
    if (onAbort) {
      onAbort();

      // Restore last prompt
      if (lastPrompt) {
        setInput(lastPrompt);

        // Focus textarea and move cursor to end
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const length = lastPrompt.length;
            textareaRef.current.setSelectionRange(length, length);
          }
        }, 0);
      }
    }
  };

  // Voice recording handlers
  const handleVoiceClick = useCallback(() => {
    console.log('[Voice] Microphone clicked. Speech supported:', isSpeechSupported, 'API Key:', openaiApiKey ? 'present' : 'missing');

    if (!isSpeechSupported) {
      const errorMsg = 'Audio recording is not supported in this browser.';
      console.error('[Voice]', errorMsg);
      setError(errorMsg);
      return;
    }

    if (!openaiApiKey) {
      const errorMsg = 'OpenAI API key is required for voice input. Please configure it in Settings > AI Assistant.';
      console.error('[Voice]', errorMsg);
      setError(errorMsg);
      return;
    }

    console.log('[Voice] Opening modal and starting listening...');
    setShowVoiceModal(true);
    startListening();
  }, [isSpeechSupported, openaiApiKey, startListening]);

  const handleVoiceClose = useCallback(() => {
    // Cancel recording without transcription when closing via X button
    if (isListening) {
      cancelListening();
    }
    setShowVoiceModal(false);

    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  }, [isListening, cancelListening]);

  const handleVoiceStop = useCallback(() => {
    stopListening();
  }, [stopListening]);

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    console.log('[DragEnter] Event triggered!', e.dataTransfer.types);
    e.preventDefault(); // Essential to allow drop
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    console.log('[DragOver] Event triggered!', e.dataTransfer.types);
    e.preventDefault(); // Essential to allow drop - DON'T stopPropagation!

    // Check if it's a file being dragged
    const hasQuackFile = e.dataTransfer.types.includes('application/quack-file');
    const hasTextPlain = e.dataTransfer.types.includes('text/plain');

    console.log('[DragOver] Has quack-file:', hasQuackFile, 'Has text/plain:', hasTextPlain);

    if (hasQuackFile || hasTextPlain) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Only set dragOver to false if leaving the container entirely
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // DON'T stopPropagation!
    setIsDragOver(false);

    console.log('[Drop] Event received', e.dataTransfer.types);

    if (!textareaRef.current) return;

    // Check if files are being dropped from Finder (native files)
    const finderFiles = Array.from(e.dataTransfer.files);
    if (finderFiles.length > 0) {
      console.log('[Drop] Native files from Finder:', finderFiles.length);

      // Process each file
      for (const file of finderFiles) {
        // Check if it's an image
        const isImage = file.type.startsWith('image/');
        console.log('[Drop] File:', file.name, 'Type:', file.type, 'Is Image:', isImage);

        if (isImage) {
          // Handle image: add as attachment (like paste)
          if (attachments.length >= MAX_ATTACHMENTS) {
            setError(`Quack! Max ${MAX_ATTACHMENTS} attachments per message.`);
            break;
          }

          if (file.size > MAX_FILE_SIZE) {
            setError(`Image ${file.name} is larger than 15MB.`);
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
              setAttachments((prev) => [...prev, entry]);
              setError(null);
            }
          } catch (err) {
            console.error('Failed to process dropped image', err);
            const message =
              err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
            setError(`Unable to attach image: ${message}`);
          }
        } else {
          // Handle non-image file: insert file path
          // Use the file path from the file object
          // Note: In Tauri, we need to get the real path
          try {
            // Create a temporary path for the dropped file
            // We can read the file and save it temporarily, then get its path
            const fileReader = new FileReader();

            fileReader.onload = async () => {
              try {
                const arrayBuffer = fileReader.result as ArrayBuffer;
                const uint8Array = new Uint8Array(arrayBuffer);
                const base64 = btoa(String.fromCharCode(...uint8Array));

                // Save the file temporarily to get a path
                const tempPath = await invoke<string>('save_clipboard_file', {
                  dataBase64: base64,
                  extension: file.name.split('.').pop() || 'txt',
                  suggestedName: file.name ?? null,
                });

                // Calculate relative path if basePath is available
                let relativePath = tempPath;
                if (basePath && tempPath.startsWith(basePath)) {
                  relativePath = tempPath.substring(basePath.length).replace(/^\//, '');
                }

                // Insert @file:path at cursor position
                const cursorPos = textareaRef.current?.selectionStart || 0;
                const beforeCursor = input.substring(0, cursorPos);
                const afterCursor = input.substring(cursorPos);

                // Add space before @ if needed
                const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
                const prefix = needsSpaceBefore ? ' ' : '';
                const mention = `${prefix}@file:${relativePath} `;
                const newInput = beforeCursor + mention + afterCursor;

                console.log('[Drop] New input with file path:', newInput);
                setInput(newInput);

                // Position cursor after mention
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                    const newCursorPos = beforeCursor.length + mention.length;
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                  }
                }, 0);
              } catch (err) {
                console.error('Failed to save dropped file:', err);
                setError(`Unable to process file: ${file.name}`);
              }
            };

            fileReader.readAsArrayBuffer(file);
          } catch (err) {
            console.error('Failed to read dropped file:', err);
            setError(`Unable to read file: ${file.name}`);
          }
        }
      }
      return;
    }

    // Fallback: handle internal file explorer drops (existing logic)
    // Try to get the dropped file data (try both formats)
    let fileDataStr = e.dataTransfer.getData('application/quack-file');
    console.log('[Drop] application/quack-file data:', fileDataStr);

    // Fallback to text/plain if custom format fails
    if (!fileDataStr) {
      const plainText = e.dataTransfer.getData('text/plain');
      console.log('[Drop] text/plain fallback:', plainText);

      if (plainText) {
        // Try to parse as JSON first
        try {
          const parsed = JSON.parse(plainText);
          if (parsed.type === 'file' && parsed.path) {
            fileDataStr = plainText;
          }
        } catch {
          // If it's just a file path string, create the structure
          fileDataStr = JSON.stringify({
            type: 'file',
            name: plainText.split(/[\\/]/).pop() || 'file',
            path: plainText,
          });
        }
      }
    }

    if (!fileDataStr) {
      console.error('[Drop] No file data found');
      return;
    }

    try {
      const fileData = JSON.parse(fileDataStr) as { type: string; name: string; path: string };
      console.log('[Drop] Parsed file data:', fileData);

      if (fileData.type !== 'file') {
        console.error('[Drop] Invalid file type:', fileData.type);
        return;
      }

      // Calculate relative path if basePath is available
      let relativePath = fileData.path;
      if (basePath && fileData.path.startsWith(basePath)) {
        relativePath = fileData.path.substring(basePath.length).replace(/^\//, '');
      }

      console.log('[Drop] Relative path:', relativePath);

      // Insert @file:path at cursor position
      const cursorPos = textareaRef.current.selectionStart;
      const beforeCursor = input.substring(0, cursorPos);
      const afterCursor = input.substring(cursorPos);

      // Add space before @ if needed
      const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
      const prefix = needsSpaceBefore ? ' ' : '';
      const mention = `${prefix}@file:${relativePath} `;
      const newInput = beforeCursor + mention + afterCursor;

      console.log('[Drop] New input:', newInput);
      setInput(newInput);

      // Position cursor after mention
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursorPos = beforeCursor.length + mention.length;
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    } catch (err) {
      console.error('Failed to parse dropped file data:', err, fileDataStr);
    }
  }, [input, setInput, basePath, attachments.length, mimeToExtension, readFileAsBase64, createAttachmentFromPath]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command autocomplete navigation
    if (showCommandAutocomplete && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selectedCommand = filteredCommands[selectedCommandIndex];
        if (selectedCommand) {
          selectCommand(selectedCommand);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandAutocomplete(false);
        return;
      }
    }

    // Handle agent/file autocomplete navigation
    if (showAgentAutocomplete && (filteredAgents.length > 0 || fileSearchResults.length > 0)) {
      const totalItems = filteredAgents.length + fileSearchResults.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAgentIndex((prev) => (prev + 1) % totalItems);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAgentIndex((prev) => (prev - 1 + totalItems) % totalItems);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();

        // Check if selecting an agent or a file
        if (selectedAgentIndex < filteredAgents.length) {
          const selectedAgent = filteredAgents[selectedAgentIndex];
          if (selectedAgent) {
            selectAgent(selectedAgent);
          }
        } else {
          const fileIndex = selectedAgentIndex - filteredAgents.length;
          const selectedFile = fileSearchResults[fileIndex];
          if (selectedFile) {
            selectFile(selectedFile);
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAgentAutocomplete(false);
        setFileSearchResults([]);
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
    <div
      className={`chat-input-container ${isDragOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Command autocomplete dropdown */}
      {showCommandAutocomplete && filteredCommands.length > 0 && (
        <div className="agent-autocomplete command-autocomplete">
          {filteredCommands.map((command, index) => (
            <button
              key={command.name}
              type="button"
              className={`agent-autocomplete-item ${selectedCommandIndex === index ? 'selected' : ''}`}
              onClick={() => selectCommand(command)}
              onMouseEnter={() => setSelectedCommandIndex(index)}
            >
              <div className="agent-autocomplete-badge command-badge">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M2 4l3 3-3 3M7 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <div className="agent-autocomplete-info">
                <div className="agent-autocomplete-name">
                  /{command.name}
                </div>
                <div className="agent-autocomplete-description">
                  {command.description.length > 60
                    ? `${command.description.substring(0, 60)}...`
                    : command.description}
                </div>
              </div>
              {!command.isBuiltin && (
                <div className="agent-autocomplete-model">
                  <span className="command-type-badge">Custom</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Agent & File autocomplete dropdown */}
      {showAgentAutocomplete && (filteredAgents.length > 0 || fileSearchResults.length > 0) && (
        <div className="agent-autocomplete mention-autocomplete">
          {/* Agents Section */}
          {filteredAgents.length > 0 && (
            <div className="mention-section">
              <div className="mention-section-header">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 13c0-2.5 2.5-4 6-4s6 1.5 6 4v2H2v-2Z" opacity="0.8"/>
                </svg>
                <span>Agents</span>
              </div>
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

          {/* Files Section */}
          {fileSearchResults.length > 0 && (
            <div className="mention-section">
              <div className="mention-section-header">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9 1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6L9 1Z" opacity="0.8"/>
                  <path d="M9 1v5h5"/>
                </svg>
                <span>Files</span>
              </div>
              {fileSearchResults.map((file, index) => {
                const globalIndex = filteredAgents.length + index;
                return (
                  <button
                    key={file.path}
                    type="button"
                    className={`agent-autocomplete-item file-item ${selectedAgentIndex === globalIndex ? 'selected' : ''}`}
                    onClick={() => selectFile(file)}
                    onMouseEnter={() => setSelectedAgentIndex(globalIndex)}
                  >
                    <div className="agent-autocomplete-badge file-badge">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M9 1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6L9 1Z" opacity="0.5"/>
                        <path d="M9 1v5h5"/>
                      </svg>
                    </div>
                    <div className="agent-autocomplete-info">
                      <div className="agent-autocomplete-name">
                        {file.name}
                      </div>
                      <div className="agent-autocomplete-description file-path">
                        {file.relative_path}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading state for file search */}
          {isSearchingFiles && fileSearchResults.length === 0 && (
            <div className="mention-section">
              <div className="mention-loading">
                <div className="mention-loading-spinner" />
                <span>Searching files...</span>
              </div>
            </div>
          )}
        </div>
      )}
      <div
        className="chat-input-wrapper"
        onDragLeave={handleDragLeave}
      >
        {/* Show agent mention chips */}
        {(() => {
          const mentions = parseAgentMentions(input);
          if (mentions.length === 0 || !agents) return null;

          const matchedAgents = matchMentionsToAgents(input, agents);
          if (matchedAgents.length === 0) return null;

          return (
            <div className="chat-input-mentions">
              {matchedAgents.map((agent, idx) => (
                <div key={idx} className="chat-input-mention-chip-wrapper">
                  <AgentMentionChip agentName={agent.name} />
                </div>
              ))}
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
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              isFocused
                ? `⇧ + ↵ new line | ↵ send`
                : placeholder
            }
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
            onClick={onOpenPromptEngineer}
            disabled={disabled}
            data-tooltip="Prompt Engineer"
            aria-label="Prompt Engineer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1Z" opacity="0.8"/>
              <path d="M12 2l0.5 1.5L14 4l-1.5 0.5L12 6l-0.5-1.5L10 4l1.5-0.5L12 2Z" opacity="0.6"/>
            </svg>
          </button>
          {onWorkingOnChange && (
            <div
              ref={workingOnRef}
              className="working-on-button-wrapper"
            >
              <button
                type="button"
                className={`chat-input-action-btn ${workingOn ? 'has-value' : ''}`}
                data-tooltip="What are you working on?"
                aria-label="Working on"
                onClick={() => setShowWorkingOnPopover(!showWorkingOnPopover)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a3 3 0 0 1 3 3v1h1.5A1.5 1.5 0 0 1 14 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-7A1.5 1.5 0 0 1 3.5 5H5V4a3 3 0 0 1 3-3Zm0 1a2 2 0 0 0-2 2v1h4V4a2 2 0 0 0-2-2Zm0 5.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/>
                </svg>
                {workingOn && (
                  <span className="working-on-indicator"></span>
                )}
              </button>
              {showWorkingOnPopover && (
                <div className="working-on-popover">
                  <div className="working-on-popover-header">
                    <span>Working on</span>
                  </div>
                  <input
                    type="text"
                    className="working-on-popover-input"
                    value={workingOnValue}
                    onChange={(e) => setWorkingOnValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setShowWorkingOnPopover(false);
                      }
                    }}
                    placeholder="e.g., AI implementation"
                    maxLength={150}
                    autoFocus
                  />
                  <div className="working-on-popover-hint">
                    Brief context about current focus
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className="chat-input-action-btn"
            onClick={handleVoiceClick}
            disabled={disabled || !isSpeechSupported}
            data-tooltip={isSpeechSupported ? "Voice input" : "Voice input not supported"}
            aria-label="Voice input"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2Z"/>
              <path d="M4 7v1a4 4 0 0 0 8 0V7h1v1a5 5 0 0 1-4.5 4.975V15h3v1h-7v-1h3v-2.025A5 5 0 0 1 3 8V7h1Z"/>
            </svg>
          </button>
          <button
            type="button"
            className={`chat-input-send ${isStreaming ? 'streaming' : ''}`}
            onClick={() => {
              if (isStreaming) {
                handleStop();
              } else {
                void handleSend();
              }
            }}
            disabled={!isStreaming && (disabled || (!input.trim() && attachments.length === 0))}
            data-tooltip={isStreaming ? 'Stop streaming' : 'Send (⌘+Enter)'}
            aria-label={isStreaming ? 'Stop streaming' : 'Send message'}
          >
            {isStreaming ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="3"
                  width="10"
                  height="10"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            ) : (
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
            )}
          </button>
          {/* Focus-only helper icons - at end so they wrap to top with wrap-reverse */}
          {isFocused && (
            <div className="focus-helper-icon-wrapper">
              <button
                type="button"
                className="chat-input-action-btn focus-helper-icon"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!textareaRef.current) return;
                  const cursorPos = textareaRef.current.selectionStart;
                  const beforeCursor = input.substring(0, cursorPos);
                  const afterCursor = input.substring(cursorPos);
                  const newInput = beforeCursor + '\n_ ' + afterCursor;
                  setInput(newInput);

                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                      const newCursorPos = cursorPos + 3;
                      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                    }
                  }, 0);
                }}
                disabled={disabled}
                data-tooltip="New line with _ "
                aria-label="New line with underscore"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3l4 4m0 0l-4 4m4-4h8M5 13h6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                type="button"
                className="chat-input-action-btn focus-helper-icon"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!textareaRef.current) return;
                  const cursorPos = textareaRef.current.selectionStart;
                  const beforeCursor = input.substring(0, cursorPos);
                  const afterCursor = input.substring(cursorPos);

                  const openTagMatch = beforeCursor.match(/<(\w+)(?:\s[^>]*)?>(?![\s\S]*<\/\1>)/);

                  if (openTagMatch) {
                    // There's an open tag - add closing tag
                    const tagName = openTagMatch[1];
                    const newInput = beforeCursor + `</${tagName}>` + afterCursor;
                    setInput(newInput);

                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                        const newCursorPos = cursorPos + tagName.length + 3;
                        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                      }
                    }, 0);
                  } else {
                    // No open tag - insert only opening tag, let user type
                    const newInput = beforeCursor + '<tag>' + afterCursor;
                    setInput(newInput);

                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                        const startPos = cursorPos + 1;
                        const endPos = cursorPos + 4;
                        textareaRef.current.setSelectionRange(startPos, endPos);
                      }
                    }, 0);
                  }
                }}
                disabled={disabled}
                data-tooltip="XML tag (smart)"
                aria-label="XML tag"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 5L2 8l2 3M12 5l2 3-2 3M9 3L7 13" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
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

      {/* Voice Recording Modal */}
      <VoiceRecordingModal
        isOpen={showVoiceModal}
        isListening={isListening}
        transcript={transcript}
        interimTranscript={interimTranscript}
        audioLevel={audioLevel}
        error={speechError ? speechError.message : null}
        onClose={handleVoiceClose}
        onStop={handleVoiceStop}
      />
    </div>
  );
}
