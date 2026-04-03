import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { parseAgentMentions, matchMentionsToAgents } from '../utils/agentMentions';
import { AgentMentionChip } from './AgentMentionChip';
import type { ChatAttachment, AgentInfo, SearchResult } from '../types';
import type { ChatSendOptions } from '../hooks/useClaudeChat';
import { useSlashCommands, type SlashCommand } from '../hooks/useSlashCommands';
import { useMicRecorder } from '../hooks/useMicRecorder';
import { useSnippets, getCursorPosition, removeCursorMarker } from '../hooks/useSnippets';
import VoiceRecordingModal from './VoiceRecordingModal';
import { SnippetModal } from './SnippetModal';
import EquipBar from './chat/EquipBar';
import CodeEditorCodeMirror from './CodeEditorCodeMirror';
import { useShortcutsStore } from '../stores/shortcutsStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { loadAvailableSkills } from '../utils/skillsAndDroidsLoader';
import { useFeatureMapData } from '../hooks/useFeatureMapData';
import type { FeatureNode } from './featureMap/featureMapTypes';
import { isMacOS } from '../utils/platform';
import {
  compressImage,
  blobToBase64,
  getCompressionMessage,
  MAX_FILE_SIZE,
  MAX_IMAGE_DIMENSION,
  RECOMMENDED_IMAGE_DIMENSION,
} from '../utils/imageCompression';
import './ChatInput.css';

const MAX_ATTACHMENTS = 6;
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
  pendingFileMention?: { name: string; path: string; relativePath: string; isDirectory: boolean } | null;
  onFileMentionInserted?: () => void;
  pendingSlashCommand?: { name: string; description: string } | null;
  onCommandInserted?: () => void;
  basePath?: string;
  // Controlled input value
  inputValue?: string;
  onInputChange?: (value: string) => void;
  // Controlled attachments (for persistence across tab switches)
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;
  // Streaming control
  isStreaming?: boolean;
  onAbort?: () => void;
  lastPrompt?: string;
  // OpenAI API key for Whisper
  openaiApiKey?: string;
  // Open Prompt Engineer
  onOpenPromptEngineer?: () => void;
  // Initial attachments (from Kanban task) - DEPRECATED, use attachments prop instead
  initialAttachments?: ChatAttachment[];
  // Fullscreen mode
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // Agent toolkit for EquipBar
  agentToolkit?: {
    skills: string[];
    droids: string[];
    commands: string[];
  };
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
  attachments: controlledAttachments,
  onAttachmentsChange: controlledOnAttachmentsChange,
  isStreaming = false,
  onAbort,
  lastPrompt,
  openaiApiKey,
  onOpenPromptEngineer,
  initialAttachments,
  isFullscreen = false,
  onToggleFullscreen,
  agentToolkit,
}: ChatInputProps) {
  // IDE context: icon in action bar, full detail in ProjectContextPanel
  const { previewFile, editorSelection, externalIdeContext, ideContextEnabled, toggleIdeContext } = useFileSystemStore();

  // Use local state as fallback if not controlled
  const [localInput, setLocalInput] = useState('');
  const [localAttachments, setLocalAttachments] = useState<ChatAttachment[]>(initialAttachments || []);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Initialize attachments from prop (for Kanban tasks) - only for uncontrolled mode
  useEffect(() => {
    if (initialAttachments && initialAttachments.length > 0 && !controlledAttachments) {
      setLocalAttachments(initialAttachments);
    }
  }, [initialAttachments, controlledAttachments]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Guard against double-send from overlapping keyboard handlers
  // (global shortcut handler + local onKeyDown both fire on same keypress)
  const sendingRef = useRef(false);

  // Determine if controlled or uncontrolled for input
  const isControlled = controlledInputValue !== undefined && controlledOnInputChange !== undefined;
  const input = isControlled ? controlledInputValue : localInput;
  const setInput = isControlled ? controlledOnInputChange : setLocalInput;

  // Determine if controlled or uncontrolled for attachments
  const isAttachmentsControlled = controlledAttachments !== undefined && controlledOnAttachmentsChange !== undefined;
  const attachments = isAttachmentsControlled ? controlledAttachments : localAttachments;

  // 🦆 SESSIONS-FIRST: Use ref to always have current attachments value
  // This prevents stale closure issues when session changes
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Auto-resize textarea to fit content (2-line minimum, expands up to max-height)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 194;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [input]);

  // Wrapper to support both direct value and callback setter pattern
  const setAttachments = useCallback((valueOrUpdater: ChatAttachment[] | ((prev: ChatAttachment[]) => ChatAttachment[])) => {
    if (typeof valueOrUpdater === 'function') {
      // Callback pattern: (prev) => newValue
      // Use ref to get current value to avoid stale closure
      const newValue = valueOrUpdater(attachmentsRef.current);
      if (isAttachmentsControlled && controlledOnAttachmentsChange) {
        controlledOnAttachmentsChange(newValue);
      } else {
        setLocalAttachments(newValue);
      }
    } else {
      // Direct value pattern
      if (isAttachmentsControlled && controlledOnAttachmentsChange) {
        controlledOnAttachmentsChange(valueOrUpdater);
      } else {
        setLocalAttachments(valueOrUpdater);
      }
    }
  }, [isAttachmentsControlled, controlledOnAttachmentsChange]);

  // Load slash commands
  const { commands: commandsResponse } = useSlashCommands(basePath || '');

  // Snippets hook for tag expansion
  const { snippets, detectTag, expandVariables } = useSnippets();

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


  // Slash command autocomplete state
  const [showCommandAutocomplete, setShowCommandAutocomplete] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [slashCommandStart, setSlashCommandStart] = useState(-1);

  // Voice recording state
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Snippet popover state
  const [showSnippetPopover, setShowSnippetPopover] = useState(false);
  const snippetButtonRef = useRef<HTMLButtonElement>(null);

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

  // Get shortcuts from store
  const { shortcuts, formatShortcut } = useShortcutsStore();

  const generateId = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  const getAgentColor = useCallback((colorName: string): string => {
    return AGENT_COLORS[colorName.toLowerCase()] || "#6B7280";
  }, []);

  // State for all available skills (loaded from project + global)
  const [allAvailableSkills, setAllAvailableSkills] = useState<string[]>([]);

  // Load all available skills when basePath changes or @ autocomplete opens
  useEffect(() => {
    if (!basePath) return;

    const loadSkills = async () => {
      try {
        const skills = await loadAvailableSkills(basePath);
        // Extract just the skill names
        const skillNames = skills.map(s => s.name);
        setAllAvailableSkills(skillNames);
      } catch (err) {
        console.error('[ChatInput] Failed to load skills:', err);
      }
    };

    loadSkills();
  }, [basePath]);

  // Filter skills based on current @ mention (from all available skills)
  const filteredSkills = useMemo(() => {
    if (!allAvailableSkills.length || !showAgentAutocomplete) return [];

    const filter = agentFilter.toLowerCase();
    return allAvailableSkills.filter(skill => {
      const name = skill.toLowerCase().replace(/-/g, ' ');
      return name.includes(filter);
    });
  }, [allAvailableSkills, showAgentAutocomplete, agentFilter]);

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

  // Feature docs for @ mention autocomplete
  const { graph: featureGraph } = useFeatureMapData(basePath);
  const filteredFeatures = useMemo(() => {
    if (!featureGraph?.nodes.length || !showAgentAutocomplete) return [];
    const filter = agentFilter.toLowerCase();
    return featureGraph.nodes.filter(node => {
      const title = node.title.toLowerCase();
      const tags = node.tags.join(' ').toLowerCase();
      return title.includes(filter) || tags.includes(filter) || 'feature'.includes(filter);
    });
  }, [featureGraph?.nodes, showAgentAutocomplete, agentFilter]);

  // Brain: 025-team-delegation-footer — show @team option in mention dropdown
  const showTeamOption = useMemo(() => {
    if (!showAgentAutocomplete) return false;
    const filter = agentFilter.toLowerCase();
    return 'team'.includes(filter);
  }, [showAgentAutocomplete, agentFilter]);

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

  // Filter commands based on current / command (only match command name, not description)
  const filteredCommands = useMemo(() => {
    if (!commands || !showCommandAutocomplete) return [];

    const filter = commandFilter.toLowerCase();
    return commands.filter(command => {
      const name = command.name.toLowerCase();
      return name.includes(filter);
    });
  }, [commands, showCommandAutocomplete, commandFilter]);

  // Auto-expand snippet when user types an exact matching tag
  const tryAutoExpandSnippet = useCallback(async (text: string, cursorPos: number) => {
    if (snippets.length === 0 || cursorPos < 1) return null;

    // Get the current word being typed (up to cursor)
    const textBeforeCursor = text.substring(0, cursorPos);
    let wordStart = textBeforeCursor.length;
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      const char = textBeforeCursor[i];
      if (/[\s\n]/.test(char)) {
        wordStart = i + 1;
        break;
      }
      if (i === 0) {
        wordStart = 0;
      }
    }

    const potentialTag = textBeforeCursor.substring(wordStart);
    if (!potentialTag) return null;

    // Check if this EXACTLY matches a snippet tag (case insensitive)
    const matchingSnippet = snippets.find(
      s => s.tag.toLowerCase() === potentialTag.toLowerCase()
    );

    if (!matchingSnippet) return null;

    // Found a matching snippet - expand it immediately
    try {
      let content = await expandVariables(matchingSnippet.content);

      // Handle {cursor} marker
      const cursorMarkerPos = getCursorPosition(content);
      if (cursorMarkerPos !== -1) {
        content = removeCursorMarker(content);
      }

      // Replace the tag with snippet content (no space needed)
      const beforeTag = text.substring(0, wordStart);
      const afterTag = text.substring(cursorPos);
      const newInput = beforeTag + content + afterTag;

      // Return the new input and cursor position
      return {
        newInput,
        newCursorPos: cursorMarkerPos !== -1
          ? wordStart + cursorMarkerPos
          : wordStart + content.length
      };
    } catch (err) {
      console.error('Failed to auto-expand snippet:', err);
      return null;
    }
  }, [snippets, expandVariables]);

  // Handle input change and detect @ mentions and / commands
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    // First, try auto-expand snippet (async)
    void (async () => {
      const expanded = await tryAutoExpandSnippet(newValue, cursorPos);
      if (expanded) {
        setInput(expanded.newInput);
        // Position cursor after expansion
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(expanded.newCursorPos, expanded.newCursorPos);
          }
        }, 0);
        return;
      }
    })();

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
  }, [agents, commands, setInput, tryAutoExpandSnippet]);

  // Brain: 025-team-delegation-footer — select @team from autocomplete
  const selectTeam = useCallback(() => {
    if (!textareaRef.current) return;
    const beforeMention = input.substring(0, atMentionStart);
    const afterMention = input.substring(textareaRef.current.selectionStart);
    const fullMention = '@team ';
    const newInput = beforeMention + fullMention + afterMention;
    setInput(newInput);
    setShowAgentAutocomplete(false);
    setAgentFilter('');
    setAtMentionStart(-1);
    setFileSearchResults([]);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const pos = beforeMention.length + fullMention.length;
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }, [input, atMentionStart, setInput]);

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

  // Select a skill from autocomplete
  const selectSkill = useCallback((skillName: string) => {
    if (!textareaRef.current) return;

    // Replace the partial @mention with @skill:skillname
    const beforeMention = input.substring(0, atMentionStart);
    const afterMention = input.substring(textareaRef.current.selectionStart);
    const fullMention = `@skill:${skillName} `;
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

  // Select a feature doc from autocomplete — inserts @file:docPath mention
  const selectFeature = useCallback((feature: FeatureNode) => {
    if (!textareaRef.current) return;

    const beforeMention = input.substring(0, atMentionStart);
    const afterMention = input.substring(textareaRef.current.selectionStart);
    const fullMention = `@file:${feature.docPath} `;
    const newInput = beforeMention + fullMention + afterMention;

    setInput(newInput);
    setShowAgentAutocomplete(false);
    setAgentFilter('');
    setAtMentionStart(-1);
    setFileSearchResults([]);

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

  // Auto-resize textarea - use class toggle to let CSS handle the animation
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (isFocused) {
      // Add focused class for CSS-driven expansion with animation
      textarea.classList.add('expanded');
    } else {
      // Remove class to collapse with animation
      textarea.classList.remove('expanded');
    }
  }, [isFocused]);

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

    // Insert @file: or @folder: path at current cursor position
    const cursorPos = textareaRef.current.selectionStart;
    const beforeCursor = input.substring(0, cursorPos);
    const afterCursor = input.substring(cursorPos);

    // Add space before @ if needed
    const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
    const prefix = needsSpaceBefore ? ' ' : '';
    const mentionType = pendingFileMention.isDirectory ? '@folder' : '@file';
    const mention = `${prefix}${mentionType}:${pendingFileMention.relativePath} `;
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

  // Validate image dimensions (Claude API max is 8000x8000 pixels)
  const validateImageDimensions = useCallback(async (
    dataUrl: string,
    fileName: string
  ): Promise<{ valid: boolean; width?: number; height?: number; error?: string }> => {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        const { width, height } = img;

        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          resolve({
            valid: false,
            width,
            height,
            error: `Image "${fileName}" is too large (${width}x${height}). Max dimensions: ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels.`
          });
        } else {
          // Log if image is larger than recommended (for future optimization hints)
          if (width > RECOMMENDED_IMAGE_DIMENSION || height > RECOMMENDED_IMAGE_DIMENSION) {
            console.info(`[Image] ${fileName} (${width}x${height}) exceeds recommended ${RECOMMENDED_IMAGE_DIMENSION}px - may be slow to process`);
          }
          resolve({ valid: true, width, height });
        }
      };

      img.onerror = () => {
        // If we can't load the image, allow it through (might be a valid format we don't support in browser)
        console.warn(`[Image] Could not validate dimensions for ${fileName}`);
        resolve({ valid: true });
      };

      img.src = dataUrl;
    });
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
          setError(`File ${path.split(/[\\/]/).pop() ?? path} is larger than 5MB (Claude API limit).`);
          return null;
        }

        const name = path.split(/[\\/]/).pop() ?? path;
        const mimeType = guessMimeType(name);
        const previewUrl = await buildPreviewUrl(path, mimeType, metadata.size ?? undefined);

        // Validate image dimensions for image files
        if (mimeType?.startsWith('image/') && previewUrl) {
          const validation = await validateImageDimensions(previewUrl, name);
          if (!validation.valid) {
            setError(validation.error ?? 'Image dimensions exceed Claude API limits.');
            return null;
          }
        }

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
    [buildPreviewUrl, generateId, guessMimeType, validateImageDimensions]
  );

  const handleAttach = useCallback(async () => {
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
  }, [attachments.length, createAttachmentFromPath]);

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

        try {
          // Compress image if it's an image file (before size check)
          let processedFile: File | Blob = file;
          let compressionMsg: string | null = null;

          if (file.type.startsWith('image/')) {
            const result = await compressImage(file);
            processedFile = result.blob;
            compressionMsg = getCompressionMessage(result);
          }

          // Now check size after potential compression
          if (processedFile.size > MAX_FILE_SIZE) {
            const sizeMsg = compressionMsg
              ? `Even after compression, image is too large (${(processedFile.size / (1024 * 1024)).toFixed(1)}MB). Max: 5MB.`
              : `File ${file.name || '(unnamed)'} is larger than 5MB (Claude API limit).`;
            setError(sizeMsg);
            continue;
          }

          // Show compression info message if image was compressed
          if (compressionMsg) {
            setInfoMessage(compressionMsg);
            // Auto-hide after 4 seconds
            setTimeout(() => setInfoMessage(null), 4000);
          }

          const extensionFromMime = mimeToExtension(file.type);
          const nameExtension = (() => {
            const parts = file.name?.split('.') ?? [];
            if (parts.length > 1) {
              return parts.pop();
            }
            return undefined;
          })();
          const extension = extensionFromMime ?? nameExtension ?? 'png';

          // Convert blob to base64
          const base64 = await blobToBase64(processedFile);

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
        // Note: We don't insert filename in text anymore as it confuses AI agents
        // who try to read it as a file path. The image is visible in the attachment preview.
      }
    },
    [attachments.length, createAttachmentFromPath, mimeToExtension]
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
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    // Prevent double-send: global shortcut handler + local onKeyDown
    // both fire on the same keypress (e.g. Cmd+Enter matches both the
    // configurable chatSendMessage shortcut AND the hardcoded handler).
    // React state updates (setInput) are batched, so the second call
    // still sees non-empty input. This ref guard blocks the second call.
    if (sendingRef.current) return;
    sendingRef.current = true;

    // Clear input before awaiting send (which blocks until stream ends)
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setError(null);

    try {
      await onSend(trimmed, { attachments: currentAttachments });
    } finally {
      sendingRef.current = false;
    }
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

  // Global keyboard shortcuts for chat actions
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // ESC closes focus mode
      if (e.key === 'Escape' && isFullscreen && onToggleFullscreen) {
        e.preventDefault();
        onToggleFullscreen();
        return;
      }

      // Build key string (e.g., "Meta+U", "Meta+Shift+F")
      const keys: string[] = [];
      if (e.metaKey || e.ctrlKey) keys.push('Meta');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');
      if (e.key && e.key.length === 1) {
        keys.push(e.key.toUpperCase());
      } else if (e.key === 'Enter') {
        keys.push('Enter');
      } else if (e.key === '/') {
        keys.push('/');
      }
      const keyCombo = keys.join('+');

      // Match against shortcuts
      if (keyCombo === shortcuts.chatAttachFile?.currentKeys) {
        e.preventDefault();
        void handleAttach();
      } else if (keyCombo === shortcuts.chatMentionAgent?.currentKeys) {
        e.preventDefault();
        // Focus input and insert @
        textareaRef.current?.focus();
        setInput(input + '@');
      } else if (keyCombo === shortcuts.chatToggleFullscreen?.currentKeys && onToggleFullscreen) {
        e.preventDefault();
        onToggleFullscreen();
      } else if (keyCombo === shortcuts.chatVoiceRecord?.currentKeys) {
        e.preventDefault();
        handleVoiceClick();
      } else if (keyCombo === shortcuts.chatSendMessage?.currentKeys) {
        e.preventDefault();
        if (isStreaming) {
          handleStop();
        } else {
          void handleSend();
        }
      } else if (keyCombo === shortcuts.chatOpenSnippets?.currentKeys) {
        e.preventDefault();
        setShowSnippetPopover(true);
      } else if (keyCombo === shortcuts.chatOpenCommands?.currentKeys) {
        e.preventDefault();
        textareaRef.current?.focus();
        setInput(input + '/');
      } else if (keyCombo === shortcuts.chatInsertXml?.currentKeys) {
        e.preventDefault();
        if (!textareaRef.current) return;
        const cursorPos = textareaRef.current.selectionStart;
        const beforeCursor = input.substring(0, cursorPos);
        const afterCursor = input.substring(cursorPos);
        const openTagMatch = beforeCursor.match(/<(\w+)(?:\s[^>]*)?>(?![\s\S]*<\/\1>)/);
        if (openTagMatch) {
          const tagName = openTagMatch[1];
          setInput(beforeCursor + `</${tagName}>` + afterCursor);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = cursorPos + tagName.length + 3;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
          }, 0);
        } else {
          setInput(beforeCursor + '<tag>' + afterCursor);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const startPos = cursorPos + 1;
              const endPos = cursorPos + 4;
              textareaRef.current.setSelectionRange(startPos, endPos);
            }
          }, 0);
        }
      } else if (keyCombo === shortcuts.chatNewLine?.currentKeys) {
        e.preventDefault();
        if (!textareaRef.current) return;
        const cursorPos = textareaRef.current.selectionStart;
        const beforeCursor = input.substring(0, cursorPos);
        const afterCursor = input.substring(cursorPos);
        setInput(beforeCursor + '\n_ ' + afterCursor);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const newCursorPos = cursorPos + 3;
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [shortcuts, input, isStreaming, isFullscreen, onToggleFullscreen, handleAttach, handleVoiceClick, handleSend, setInput]);

  // Snippet insertion handler
  const handleInsertSnippet = useCallback((content: string, cursorOffset?: number) => {
    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const beforeCursor = input.substring(0, cursorPos);
    const afterCursor = input.substring(cursorPos);

    // Add space before if needed
    const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
    const prefix = needsSpaceBefore ? ' ' : '';
    const newInput = beforeCursor + prefix + content + afterCursor;

    setInput(newInput);

    // Position cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const basePos = beforeCursor.length + prefix.length;
        const newCursorPos = cursorOffset !== undefined ? basePos + cursorOffset : basePos + content.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [input, setInput]);

  // Snippet tag expansion on Tab key
  const handleSnippetExpand = useCallback(async (): Promise<boolean> => {
    if (!textareaRef.current || snippets.length === 0) return false;

    const cursorPos = textareaRef.current.selectionStart;
    const detected = detectTag(input, cursorPos);

    if (!detected) return false;

    // Find matching snippet
    const matchingSnippet = snippets.find(
      s => s.tag.toLowerCase() === detected.tag.toLowerCase()
    );

    if (!matchingSnippet) return false;

    // Expand the snippet
    try {
      let content = await expandVariables(matchingSnippet.content);

      // Handle {cursor} marker
      const cursorMarkerPos = getCursorPosition(content);
      if (cursorMarkerPos !== -1) {
        content = removeCursorMarker(content);
      }

      // Replace the tag with snippet content
      const beforeTag = input.substring(0, detected.startIndex);
      const afterTag = input.substring(detected.endIndex);
      const newInput = beforeTag + content + afterTag;

      setInput(newInput);

      // Position cursor
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursorPos = cursorMarkerPos !== -1
            ? detected.startIndex + cursorMarkerPos
            : detected.startIndex + content.length;
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);

      return true;
    } catch (err) {
      console.error('Failed to expand snippet:', err);
      return false;
    }
  }, [input, snippets, detectTag, expandVariables, setInput]);

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    console.log('[DragEnter] Event triggered!', e.dataTransfer.types);
    e.preventDefault(); // Essential to allow drop
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    console.log('[DragOver] Event triggered!', e.dataTransfer.types);
    e.preventDefault(); // Essential to allow drop - DON'T stopPropagation!

    // Check if it's a file, skill, or droid being dragged
    const hasQuackFile = e.dataTransfer.types.includes('application/quack-file');
    const hasQuackSkill = e.dataTransfer.types.includes('application/quack-skill');
    const hasQuackDroid = e.dataTransfer.types.includes('application/quack-droid');
    const hasQuackFeature = e.dataTransfer.types.includes('application/quack-feature');
    const hasTextPlain = e.dataTransfer.types.includes('text/plain');

    if (hasQuackFile || hasQuackSkill || hasQuackDroid || hasQuackFeature || hasTextPlain) {
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

    // Check if a skill is being dropped
    const skillDataStr = e.dataTransfer.getData('application/quack-skill');
    if (skillDataStr) {
      try {
        const skillData = JSON.parse(skillDataStr) as { type: string; name: string; path: string };
        console.log('[Drop] Skill data:', skillData);

        if (skillData.type === 'skill') {
          // Insert skill reference at cursor position
          const cursorPos = textareaRef.current.selectionStart;
          const beforeCursor = input.substring(0, cursorPos);
          const afterCursor = input.substring(cursorPos);

          // Add space before if needed
          const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
          const prefix = needsSpaceBefore ? ' ' : '';
          const mention = `${prefix}@skill:${skillData.name} `;
          const newInput = beforeCursor + mention + afterCursor;

          console.log('[Drop] New input with skill:', newInput);
          setInput(newInput);

          // Position cursor after mention
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = beforeCursor.length + mention.length;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
          }, 0);
          return;
        }
      } catch (err) {
        console.error('Failed to parse skill data:', err);
      }
    }

    // Check if a droid is being dropped
    const droidDataStr = e.dataTransfer.getData('application/quack-droid');
    if (droidDataStr) {
      try {
        const droidData = JSON.parse(droidDataStr) as { type: string; name: string; path: string; color?: string };
        console.log('[Drop] Droid data:', droidData);

        if (droidData.type === 'droid') {
          // Insert droid reference at cursor position (uses existing @agent syntax)
          const cursorPos = textareaRef.current.selectionStart;
          const beforeCursor = input.substring(0, cursorPos);
          const afterCursor = input.substring(cursorPos);

          // Add space before if needed
          const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
          const prefix = needsSpaceBefore ? ' ' : '';
          const mention = `${prefix}@${droidData.name} `;
          const newInput = beforeCursor + mention + afterCursor;

          console.log('[Drop] New input with droid:', newInput);
          setInput(newInput);

          // Position cursor after mention
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = beforeCursor.length + mention.length;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
          }, 0);
          return;
        }
      } catch (err) {
        console.error('Failed to parse droid data:', err);
      }
    }

    // Check if a task is being dropped from Tasks panel
    const taskDataStr = e.dataTransfer.getData('application/quack-task');
    if (taskDataStr) {
      try {
        const taskData = JSON.parse(taskDataStr) as { type: string; id: string; content: string; status: string; uuid?: string };
        if (taskData.type === 'task') {
          const cursorPos = textareaRef.current.selectionStart;
          const beforeCursor = input.substring(0, cursorPos);
          const afterCursor = input.substring(cursorPos);
          const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
          const prefix = needsSpaceBefore ? ' ' : '';
          // Format: #ID Subject (concise, no path to avoid confusion)
          const mention = `${prefix}#${taskData.id} ${taskData.content} `;
          const newInput = beforeCursor + mention + afterCursor;
          setInput(newInput);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = beforeCursor.length + mention.length;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
          }, 0);
          return;
        }
      } catch (err) {
        console.error('Failed to parse task data:', err);
      }
    }

    // Check if a feature is being dropped from Features panel
    const featureDataStr = e.dataTransfer.getData('application/quack-feature');
    if (featureDataStr) {
      try {
        const featureData = JSON.parse(featureDataStr) as { type: string; id: string; title: string; docPath: string };
        if (featureData.type === 'feature') {
          const cursorPos = textareaRef.current.selectionStart;
          const beforeCursor = input.substring(0, cursorPos);
          const afterCursor = input.substring(cursorPos);
          const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\n');
          const prefix = needsSpaceBefore ? ' ' : '';
          // Mention the feature doc file so Claude gets full context
          const mention = `${prefix}@file:${featureData.docPath} `;
          const newInput = beforeCursor + mention + afterCursor;
          setInput(newInput);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = beforeCursor.length + mention.length;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
          }, 0);
          return;
        }
      } catch (err) {
        console.error('Failed to parse feature data:', err);
      }
    }

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

          try {
            // Compress image before size check
            const result = await compressImage(file);
            const processedFile = result.blob;
            const compressionMsg = getCompressionMessage(result);

            // Check size after compression
            if (processedFile.size > MAX_FILE_SIZE) {
              const sizeMsg = compressionMsg
                ? `Even after compression, image is too large (${(processedFile.size / (1024 * 1024)).toFixed(1)}MB). Max: 5MB.`
                : `Image ${file.name} is larger than 5MB (Claude API limit).`;
              setError(sizeMsg);
              continue;
            }

            // Show compression info message if image was compressed
            if (compressionMsg) {
              setInfoMessage(compressionMsg);
              setTimeout(() => setInfoMessage(null), 4000);
            }

            const extensionFromMime = mimeToExtension(file.type);
            const nameExtension = (() => {
              const parts = file.name?.split('.') ?? [];
              if (parts.length > 1) {
                return parts.pop();
              }
              return undefined;
            })();
            const extension = extensionFromMime ?? nameExtension ?? 'png';

            // Convert blob to base64
            const base64 = await blobToBase64(processedFile);

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

    // Handle agent/file/skill/feature autocomplete navigation
    const teamCount = showTeamOption ? 1 : 0;
    if (showAgentAutocomplete && (teamCount > 0 || filteredSkills.length > 0 || filteredAgents.length > 0 || filteredFeatures.length > 0 || fileSearchResults.length > 0)) {
      const totalItems = teamCount + filteredSkills.length + filteredAgents.length + filteredFeatures.length + fileSearchResults.length;

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

        // Brain: 025-team-delegation-footer — @team is first item
        if (showTeamOption && selectedAgentIndex === 0) {
          selectTeam();
          return;
        }
        const adjustedIndex = selectedAgentIndex - teamCount;

        // Check if selecting a skill, agent, or file
        if (adjustedIndex < filteredSkills.length) {
          // Selecting a skill
          const selectedSkill = filteredSkills[adjustedIndex];
          if (selectedSkill) {
            selectSkill(selectedSkill);
          }
        } else if (adjustedIndex < filteredSkills.length + filteredAgents.length) {
          // Selecting an agent (droid)
          const agentIndex = adjustedIndex - filteredSkills.length;
          const selectedAgent = filteredAgents[agentIndex];
          if (selectedAgent) {
            selectAgent(selectedAgent);
          }
        } else if (adjustedIndex < filteredSkills.length + filteredAgents.length + filteredFeatures.length) {
          // Selecting a feature doc
          const featureIndex = adjustedIndex - filteredSkills.length - filteredAgents.length;
          const selectedFeatureNode = filteredFeatures[featureIndex];
          if (selectedFeatureNode) {
            selectFeature(selectedFeatureNode);
          }
        } else {
          // Selecting a file
          const fileIndex = adjustedIndex - filteredSkills.length - filteredAgents.length - filteredFeatures.length;
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

    // Tab for snippet expansion (when not in autocomplete mode)
    if (e.key === 'Tab' && !e.shiftKey) {
      // Check synchronously if there's a matching snippet tag
      if (textareaRef.current && snippets.length > 0) {
        const cursorPos = textareaRef.current.selectionStart;
        const detected = detectTag(input, cursorPos);

        if (detected) {
          // Check if any snippet matches the tag
          const matchingSnippet = snippets.find(
            s => s.tag.toLowerCase() === detected.tag.toLowerCase()
          );

          if (matchingSnippet) {
            // Prevent default Tab behavior SYNCHRONOUSLY before async expansion
            e.preventDefault();
            // Then do the async expansion
            void handleSnippetExpand();
            return;
          }
        }
      }
      // Note: If no snippet matched, Tab will work normally (don't prevent default)
    }

    // Normal behavior when autocomplete is not active
    // Send on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (isStreaming) {
        handleStop();
      } else {
        void handleSend();
      }
    }
    // Send on Enter (without Shift)
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) {
        // Enter does nothing during streaming — stop is UI-button-only
        // Show hint if user has typed a message
        if (input.trim()) {
          setInfoMessage('Will send after current response.');
          setTimeout(() => setInfoMessage(null), 3000);
        }
      } else {
        void handleSend();
      }
    }
  };

  return (
    <div
      className={`chat-input-container ${isDragOver ? 'drag-over' : ''} ${isFocused ? 'focused' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
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
              onMouseDown={(e) => {
                e.preventDefault();
                selectCommand(command);
              }}
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

      {/* Agent, Skill, Feature & File autocomplete dropdown */}
      {showAgentAutocomplete && (showTeamOption || filteredSkills.length > 0 || filteredAgents.length > 0 || filteredFeatures.length > 0 || fileSearchResults.length > 0) && (
        <div className="agent-autocomplete mention-autocomplete">
          {/* Team Delegation — Brain: 025-team-delegation-footer */}
          {showTeamOption && (
            <div className="mention-section">
              <div className="mention-section-header team-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF6B35">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Team</span>
              </div>
              <button
                type="button"
                className={`agent-autocomplete-item team-item ${selectedAgentIndex === 0 ? 'selected' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); selectTeam(); }}
                onMouseEnter={() => setSelectedAgentIndex(0)}
              >
                <div className="agent-autocomplete-badge" style={{ backgroundColor: '#FF6B35' }} />
                <div className="agent-autocomplete-info">
                  <div className="agent-autocomplete-name">team</div>
                  <div className="agent-autocomplete-description">Delegate tasks to project agents</div>
                </div>
              </button>
            </div>
          )}
          {/* Skills Section - FIRST */}
          {filteredSkills.length > 0 && (
            <div className="mention-section">
              <div className="mention-section-header skills-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="skill-star-gradient-autocomplete" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f28c52" />
                      <stop offset="100%" stopColor="#e67339" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill="url(#skill-star-gradient-autocomplete)"
                  />
                </svg>
                <span>Skills</span>
              </div>
              {filteredSkills.map((skill, index) => {
                const teamOffset = showTeamOption ? 1 : 0;
                const gIdx = teamOffset + index;
                return (
                <button
                  key={skill}
                  type="button"
                  className={`agent-autocomplete-item skill-item ${selectedAgentIndex === gIdx ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSkill(skill);
                  }}
                  onMouseEnter={() => setSelectedAgentIndex(gIdx)}
                >
                  <div className="agent-autocomplete-badge skill-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill="#f28c52"
                      />
                    </svg>
                  </div>
                  <div className="agent-autocomplete-info">
                    <div className="agent-autocomplete-name">
                      {skill.replace(/-/g, ' ')}
                    </div>
                  </div>
                </button>
              );
              })}
            </div>
          )}

          {/* Droids Section */}
          {filteredAgents.length > 0 && (
            <div className="mention-section">
              <div className="mention-section-header droids-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#4A9EFF">
                  <path d="M12 2L10.5 4.5H8C6.9 4.5 6 5.4 6 6.5V8.5H4V11.5H6V13.5H4V16.5H6V18.5C6 19.6 6.9 20.5 8 20.5H16C17.1 20.5 18 19.6 18 18.5V16.5H20V13.5H18V11.5H20V8.5H18V6.5C18 5.4 17.1 4.5 16 4.5H13.5L12 2M12 5.5C12.83 5.5 13.5 6.17 13.5 7C13.5 7.83 12.83 8.5 12 8.5C11.17 8.5 10.5 7.83 10.5 7C10.5 6.17 11.17 5.5 12 5.5M10 11C10.55 11 11 11.45 11 12C11 12.55 10.55 13 10 13C9.45 13 9 12.55 9 12C9 11.45 9.45 11 10 11M14 11C14.55 11 15 11.45 15 12C15 12.55 14.55 13 14 13C13.45 13 13 12.55 13 12C13 11.45 13.45 11 14 11M10 16H14V17H10V16Z"/>
                </svg>
                <span>Droids</span>
              </div>
              {filteredAgents.map((agent, index) => {
                // Offset index by team + skills count
                const globalIndex = (showTeamOption ? 1 : 0) + filteredSkills.length + index;
                return (
                <button
                  key={agent.name}
                  type="button"
                  className={`agent-autocomplete-item droid-item ${selectedAgentIndex === globalIndex ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectAgent(agent);
                  }}
                  onMouseEnter={() => setSelectedAgentIndex(globalIndex)}
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
              );
              })}
            </div>
          )}

          {/* Features Section */}
          {filteredFeatures.length > 0 && (
            <div className="mention-section">
              <div className="mention-section-header features-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" />
                  <circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" />
                  <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
                  <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
                  <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" />
                  <line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
                </svg>
                <span>Features</span>
              </div>
              {filteredFeatures.map((feature, index) => {
                const globalIndex = (showTeamOption ? 1 : 0) + filteredSkills.length + filteredAgents.length + index;
                return (
                  <button
                    key={feature.id}
                    type="button"
                    className={`agent-autocomplete-item feature-item ${selectedAgentIndex === globalIndex ? 'selected' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectFeature(feature);
                    }}
                    onMouseEnter={() => setSelectedAgentIndex(globalIndex)}
                  >
                    <div className="agent-autocomplete-badge" style={{ backgroundColor: '#FFD700' }} />
                    <div className="agent-autocomplete-info">
                      <div className="agent-autocomplete-name">
                        {feature.title}
                      </div>
                      {feature.purpose && (
                        <div className="agent-autocomplete-description">
                          {feature.purpose.length > 60 ? `${feature.purpose.substring(0, 60)}...` : feature.purpose}
                        </div>
                      )}
                    </div>
                    <div className="agent-autocomplete-model">
                      <span style={{ color: '#FFD700', fontSize: '10px' }}>{feature.files.length} file</span>
                    </div>
                  </button>
                );
              })}
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
                // Offset index by team + skills + droids + features count
                const globalIndex = (showTeamOption ? 1 : 0) + filteredSkills.length + filteredAgents.length + filteredFeatures.length + index;
                return (
                  <button
                    key={file.path}
                    type="button"
                    className={`agent-autocomplete-item file-item ${selectedAgentIndex === globalIndex ? 'selected' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectFile(file);
                    }}
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
        {/* Show skill mention chips */}
        {(() => {
          // Extract @skill:name mentions from input
          const skillMentionRegex = /@skill:([^\s]+)/g;
          const skillMentions: string[] = [];
          let match;
          while ((match = skillMentionRegex.exec(input)) !== null) {
            skillMentions.push(match[1]);
          }
          if (skillMentions.length === 0) return null;

          return (
            <div className="chat-input-mentions">
              {skillMentions.map((skillName, idx) => (
                <div key={idx} className="chat-input-skill-chip">
                  <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                    <defs>
                      <linearGradient id={`skill-chip-gradient-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f28c52" />
                        <stop offset="100%" stopColor="#e67339" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                      fill={`url(#skill-chip-gradient-${idx})`}
                    />
                  </svg>
                  <span>{skillName.replace(/-/g, ' ')}</span>
                </div>
              ))}
            </div>
          );
        })()}
        {/* Show feature doc mention chips */}
        {(() => {
          const featureRegex = /@file:[^\s]*documentation\/features\/([^\s]+)/g;
          const featureMentions: string[] = [];
          let fm;
          while ((fm = featureRegex.exec(input)) !== null) {
            featureMentions.push(fm[1]);
          }
          if (featureMentions.length === 0) return null;

          return (
            <div className="chat-input-mentions">
              {featureMentions.map((fileName, idx) => (
                <div key={idx} className="chat-input-feature-chip">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" />
                    <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
                    <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
                  </svg>
                  <span>{fileName.replace(/\.md$/, '').replace(/-/g, ' ')}</span>
                </div>
              ))}
            </div>
          );
        })()}
        <div className="chat-input-field-row">
          <div className="chat-input-actions" onMouseDown={(e) => e.preventDefault()}>
          <div className="chat-input-actions-left">
          <button
            type="button"
            className="chat-input-action-btn"
            onClick={handleAttach}
            data-tooltip={`Attach files (${formatShortcut(shortcuts.chatAttachFile?.currentKeys || '')})`}
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
            data-tooltip="Prompt Engineer"
            aria-label="Prompt Engineer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1Z" opacity="0.8"/>
              <path d="M12 2l0.5 1.5L14 4l-1.5 0.5L12 6l-0.5-1.5L10 4l1.5-0.5L12 2Z" opacity="0.6"/>
            </svg>
          </button>
          {/* Fullscreen toggle button */}
          {onToggleFullscreen && (
            <button
              type="button"
              className={`chat-input-action-btn ${isFullscreen ? 'active' : ''}`}
              onClick={onToggleFullscreen}
              data-tooltip={isFullscreen ? `Exit fullscreen (${formatShortcut(shortcuts.chatToggleFullscreen?.currentKeys || '')})` : `Fullscreen mode (${formatShortcut(shortcuts.chatToggleFullscreen?.currentKeys || '')})`}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen mode"}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L2 2L2 6M10 2L14 2L14 6M6 14L2 14L2 10M10 14L14 14L14 10"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6L2 2L6 2M14 6L14 2L10 2M2 10L2 14L6 14M14 10L14 14L10 14"/>
                </svg>
              )}
            </button>
          )}
          <button
            type="button"
            className="chat-input-action-btn"
            onClick={handleVoiceClick}
            disabled={!isSpeechSupported}
            data-tooltip={isSpeechSupported ? `Voice input (${formatShortcut(shortcuts.chatVoiceRecord?.currentKeys || '')})` : "Voice input not supported"}
            aria-label="Voice input"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2Z"/>
              <path d="M4 7v1a4 4 0 0 0 8 0V7h1v1a5 5 0 0 1-4.5 4.975V15h3v1h-7v-1h3v-2.025A5 5 0 0 1 3 8V7h1Z"/>
            </svg>
          </button>
          {/* Focus-only helper icons - at end so they wrap to top with wrap-reverse */}
          {/* Keep visible when snippet popover is open to prevent it from unmounting */}
          {(isFocused || showSnippetPopover) && (
            <div className="focus-helper-icon-wrapper" onMouseDown={(e) => e.preventDefault()}>
              {/* Snippet button - opens modal */}
              <button
                type="button"
                className="chat-input-action-btn focus-helper-icon"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowSnippetPopover(!showSnippetPopover);
                }}
                data-tooltip={`Prompt Snippets (${formatShortcut(shortcuts.chatOpenSnippets?.currentKeys || '')})`}
                aria-label="Prompt Snippets"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4z"/>
                  <path d="M5 5h6v1H5zM5 7.5h4v1H5zM5 10h5v1H5z"/>
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
                data-tooltip={`New line with _ (${formatShortcut(shortcuts.chatNewLine?.currentKeys || '')})`}
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
                data-tooltip={`XML tag (${formatShortcut(shortcuts.chatInsertXml?.currentKeys || '')})`}
                aria-label="XML tag"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 5L2 8l2 3M12 5l2 3-2 3M9 3L7 13" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
          {/* IDE context icon — full detail in Context accordion panel */}
          {isMacOS() && (previewFile || editorSelection || externalIdeContext) && (
            <button
              type="button"
              className={`chat-input-action-btn chat-input-ide-btn ${!ideContextEnabled ? 'chat-input-ide-btn--disabled' : ''}`}
              onClick={toggleIdeContext}
              data-tooltip={(() => {
                if (!ideContextEnabled) return 'IDE context disabled';
                if (!externalIdeContext?.activeFile) return 'IDE context active';
                const name = externalIdeContext.activeFile.split('/').pop() ?? externalIdeContext.activeFile;
                const sel = externalIdeContext.selection;
                const hasSelection = sel && (sel.startLine !== sel.endLine || sel.startChar !== sel.endChar);
                if (hasSelection) {
                  return `${name} · L${sel.startLine}:${sel.startChar} → L${sel.endLine}:${sel.endChar}`;
                }
                return `IDE context: ${name}`;
              })()}
              aria-label="Toggle IDE context"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
          )}
          </div>
          {/* Send/Stop button - aligned to right */}
          <div className="chat-input-actions-right">
            {isStreaming ? (
              <button
                type="button"
                className="chat-input-send streaming"
                onClick={handleStop}
                data-tooltip="Stop (ESC)"
                aria-label="Stop streaming"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="chat-input-send"
                onClick={() => void handleSend()}
                disabled={!input.trim() && attachments.length === 0}
                data-tooltip={`Send (${formatShortcut(shortcuts.chatSendMessage?.currentKeys || '')})`}
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
            )}
          </div>
          </div>
          <textarea
            ref={textareaRef}
            className="chat-input-field"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => {
              setIsFocused(true);
              // Notify sidebar to scroll active session into view
              window.dispatchEvent(new CustomEvent('quack:scroll-to-active-session'));
            }}
            onBlur={(e) => {
              // Keep focus state if clicking inside chat-view-footer (parent component)
              const relatedTarget = e.relatedTarget as HTMLElement | null;
              if (relatedTarget) {
                const chatFooter = relatedTarget.closest('.chat-view-footer');
                if (chatFooter) {
                  // Click is inside chat-view-footer, don't collapse
                  return;
                }
              }
              setIsFocused(false);
            }}
            placeholder={
              isFocused
                ? `⇧ + ↵ new line | ↵ send | @ to mention droids or files | / to invoke commands`
                : placeholder
            }
            rows={1}
          />

        {/* EquipBar - Agent toolkit quick-access (shown below textarea when focused) */}
        {isFocused && agentToolkit && (agentToolkit.skills.length > 0 || agentToolkit.droids.length > 0 || agentToolkit.commands.length > 0) && (
          <div className="chat-input-equip-bar-wrapper" onMouseDown={(e) => e.preventDefault()}>
            <EquipBar
              skills={agentToolkit.skills}
              droids={agentToolkit.droids}
              commands={agentToolkit.commands}
              onInsertSkill={(skill) => setInput(input + `use this skill: ${skill}\n`)}
              onInsertDroid={(droid) => setInput(input + `@${droid} `)}
              onInsertCommand={(command) => setInput(input + `/${command} `)}
            />
          </div>
        )}
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
      {infoMessage && <div className="chat-input-info">{infoMessage}</div>}

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

      {/* Snippet Modal */}
      <SnippetModal
        isOpen={showSnippetPopover}
        onClose={() => setShowSnippetPopover(false)}
        onInsertSnippet={handleInsertSnippet}
      />

      {/* Focus Mode - Distraction-free writing - Uses Portal to escape CSS containment */}
      {isFullscreen && createPortal(
        <>
          <div className="chat-focus-overlay" onClick={onToggleFullscreen} />
          <div className="chat-focus-mode">
            <div className="chat-focus-card">
              {/* Header */}
              <div className="chat-focus-header">
                <div className="chat-focus-header-left">
                  <div className="chat-focus-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                      <path d="M2 2l7.586 7.586"/>
                      <circle cx="11" cy="11" r="2"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="chat-focus-title">Focus Mode</h3>
                    <p className="chat-focus-subtitle">Write your prompt with full concentration</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="chat-focus-close"
                  onClick={onToggleFullscreen}
                  aria-label="Close focus mode"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* CodeMirror Editor */}
              <div className="chat-focus-editor">
                <CodeEditorCodeMirror
                  content={input}
                  filename="message.md"
                  language="markdown"
                  readOnly={false}
                  onChange={(value) => setInput(value)}
                />
              </div>

              {/* Footer with Attachments, EquipBar, Actions and Send */}
              <div className="chat-focus-footer">
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="chat-focus-attachments">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="chat-focus-attachment">
                        {attachment.mimeType?.startsWith('image/') && attachment.previewUrl ? (
                          <img
                            src={attachment.previewUrl}
                            alt={attachment.name}
                            className="chat-focus-attachment-preview"
                          />
                        ) : (
                          <div className="chat-focus-attachment-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7Z" opacity="0.5"/>
                              <path d="M13 2v7h7"/>
                            </svg>
                          </div>
                        )}
                        <span className="chat-focus-attachment-name">{attachment.name}</span>
                        <button
                          type="button"
                          className="chat-focus-attachment-remove"
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          aria-label="Remove attachment"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* EquipBar Chips */}
                {agentToolkit && (agentToolkit.skills.length > 0 || agentToolkit.droids.length > 0 || agentToolkit.commands.length > 0) && (
                  <div className="chat-focus-chips" onMouseDown={(e) => e.preventDefault()}>
                    <EquipBar
                      skills={agentToolkit.skills}
                      droids={agentToolkit.droids}
                      commands={agentToolkit.commands}
                      onInsertSkill={(skill) => setInput(input + `use this skill: ${skill}\n`)}
                      onInsertDroid={(droid) => setInput(input + `@${droid} `)}
                      onInsertCommand={(command) => setInput(input + `/${command} `)}
                    />
                  </div>
                )}

                {/* Actions Row */}
                <div className="chat-focus-actions-row">
                  <div className="chat-focus-actions-left" onMouseDown={(e) => e.preventDefault()}>
                    {/* Attach */}
                    <button
                      type="button"
                      className="chat-input-action-btn"
                      onClick={handleAttach}
                      data-tooltip={`Attach files (${formatShortcut(shortcuts.chatAttachFile?.currentKeys || '')})`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M10.5 3.5a2.5 2.5 0 0 1 5 0V11h-1V3.5a1.5 1.5 0 0 0-3 0V12a3 3 0 1 1-6 0V3h1v9a2 2 0 1 0 4 0V3.5Z"/>
                      </svg>
                    </button>
                    {/* Snippets */}
                    <button
                      type="button"
                      className="chat-input-action-btn"
                      onClick={() => setShowSnippetPopover(!showSnippetPopover)}
                      data-tooltip={`Snippets (${formatShortcut(shortcuts.chatOpenSnippets?.currentKeys || '')})`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4z"/>
                        <path d="M5 5h6v1H5zM5 7.5h4v1H5zM5 10h5v1H5z"/>
                      </svg>
                    </button>
                    {/* Voice */}
                    <button
                      type="button"
                      className="chat-input-action-btn"
                      onClick={handleVoiceClick}
                      disabled={!isSpeechSupported}
                      data-tooltip={isSpeechSupported ? `Voice (${formatShortcut(shortcuts.chatVoiceRecord?.currentKeys || '')})` : "Voice not supported"}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0V3a2 2 0 0 0-2-2Z"/>
                        <path d="M4 7v1a4 4 0 0 0 8 0V7h1v1a5 5 0 0 1-4.5 4.975V15h3v1h-7v-1h3v-2.025A5 5 0 0 1 3 8V7h1Z"/>
                      </svg>
                    </button>
                  </div>

                  <div className="chat-focus-actions-right">
                    <div className="chat-focus-hints">
                      <span className="chat-focus-hint">
                        <kbd>Esc</kbd> close
                      </span>
                      <span className="chat-focus-hint">
                        <kbd>Cmd</kbd>+<kbd>Enter</kbd> send
                      </span>
                    </div>
                    {isStreaming ? (
                      <button
                        type="button"
                        className="chat-focus-send-btn streaming"
                        onClick={handleStop}
                        aria-label="Stop streaming"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                        <span>Stop</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="chat-focus-send-btn"
                        onClick={() => void handleSend()}
                        disabled={!input.trim() && attachments.length === 0}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 8L14 2L8 14L6.5 9.5L2 8Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>Send</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
