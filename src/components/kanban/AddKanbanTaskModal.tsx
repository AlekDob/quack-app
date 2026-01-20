/**
 * AddKanbanTaskModal Component
 *
 * Modal for creating or editing a Kanban task.
 * Allows selecting project, branch, agent, and setting title/prompt.
 *
 * Flow:
 * 1. Select Project (grouped repositories from active terminals)
 * 2. Select Branch (git branches for selected project)
 * 3. Select Agent (active terminals in that project)
 * 4. Enter Title and Prompt
 */

import { useState, useEffect, useCallback, useMemo, useRef, type ClipboardEvent, useLayoutEffect } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { TerminalInfo, KanbanAssignedAgent, KanbanTask, ChatAttachment } from '../../types';
import type { DroidMetadata, SkillMetadata } from '../modal-steps/types';
import { getCustomAvatarUrl, isCustomAvatar } from '../../utils/customAvatarStorage';
import { loadAvailableDroids, loadAvailableSkills } from '../../utils/skillsAndDroidsLoader';
import { compressImage, blobToBase64, MAX_FILE_SIZE as IMAGE_MAX_SIZE } from '../../utils/imageCompression';

// Constants for attachment handling
const MAX_ATTACHMENTS = 4;
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_PREVIEW_SIZE = 3 * 1024 * 1024; // 3MB

interface FileStatResult {
  size: number;
  is_dir: boolean;
  is_symlink: boolean;
}

// Initial values from drag-and-drop (sidebar agent to Kanban column)
export interface KanbanTaskInitialValues {
  projectPath?: string;
  projectName?: string;
  branch?: string;
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  agentColor?: string;
  targetStatus?: 'todo' | 'in_progress' | 'done';
}

// Draft state for persisting form data when modal is closed
export interface KanbanTaskDraft {
  title: string;
  prompt: string;
  projectPath: string;
  branch: string;
  agentId: string;
  attachments: ChatAttachment[];
}

interface AddKanbanTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    prompt: string,
    projectPath: string,
    projectName: string,
    branch: string | undefined,
    agent: KanbanAssignedAgent | undefined,
    attachments: ChatAttachment[],
    useWorktree?: boolean
  ) => void;
  terminals: TerminalInfo[];
  // Callback to create a new agent with a specific project path
  onCreateNewAgent?: (projectPath: string) => void;
  // Edit mode: pass existing task to pre-fill form
  editTask?: KanbanTask | null;
  // Initial values from drag-and-drop (sidebar agent to Kanban)
  initialValues?: KanbanTaskInitialValues | null;
  // Draft state for persisting form data
  draft?: KanbanTaskDraft | null;
  // Callback to save draft when form changes
  onDraftChange?: (draft: KanbanTaskDraft) => void;
}

// Helper function to get avatar image URL
function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset');
  }
  return `/images/ducks/new-avatars/${avatarName}`;
}

// Helper to extract repository name from path
function getRepoDisplayName(path: string): string {
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  if (lastPart.includes('-worktree-')) {
    return lastPart.split('-worktree-')[0];
  }
  return lastPart;
}

// Group terminals by repository path
interface ProjectGroup {
  path: string;
  name: string;
  terminals: TerminalInfo[];
  branches: string[];
}

export default function AddKanbanTaskModal({
  isOpen,
  onClose,
  onSubmit,
  terminals,
  onCreateNewAgent,
  editTask,
  initialValues,
  draft,
  onDraftChange,
}: AddKanbanTaskModalProps) {
  // Determine if we're in edit mode
  const isEditMode = !!editTask;
  // Task is started if status is not 'todo' - prompt/attachments cannot be modified
  const isTaskStarted = isEditMode && editTask?.status !== 'todo';
  // Form state
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedProjectPath, setSelectedProjectPath] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [useWorktree, setUseWorktree] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 🦆 Prevent double-click submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Avatar URL cache for custom avatars
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});

  // Droids and Skills state
  const [availableDroids, setAvailableDroids] = useState<DroidMetadata[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillMetadata[]>([]);
  const [selectedDroids, setSelectedDroids] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loadingDroidsSkills, setLoadingDroidsSkills] = useState(false);

  // Track if form has been initialized for this modal session
  const isInitializedRef = useRef(false);
  const prevIsOpenRef = useRef(false);

  // Group terminals by repository
  const projectGroups = useMemo(() => {
    const groups: Map<string, ProjectGroup> = new Map();

    terminals.forEach((terminal) => {
      // Get base path (without worktree suffix)
      let basePath = terminal.cwd;
      if (terminal.worktreePath) {
        // If using worktree, use the original repo path
        basePath = terminal.cwd.replace(/-worktree-.*$/, '');
      }

      // Extract repo name
      const repoName = getRepoDisplayName(basePath);

      if (!groups.has(basePath)) {
        groups.set(basePath, {
          path: basePath,
          name: repoName,
          terminals: [],
          branches: [],
        });
      }

      const group = groups.get(basePath)!;
      group.terminals.push(terminal);

      // Collect unique branches
      if (terminal.branch && !group.branches.includes(terminal.branch)) {
        group.branches.push(terminal.branch);
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [terminals]);

  // Get current project group
  const currentProject = useMemo(() => {
    return projectGroups.find((g) => g.path === selectedProjectPath);
  }, [projectGroups, selectedProjectPath]);

  // Get terminals for selected project and branch
  const filteredTerminals = useMemo(() => {
    if (!currentProject) return [];
    if (!selectedBranch) return currentProject.terminals;
    return currentProject.terminals.filter(
      (t) => t.branch === selectedBranch || (!t.branch && selectedBranch === 'main')
    );
  }, [currentProject, selectedBranch]);

  // Load custom avatar URLs
  useEffect(() => {
    async function loadAvatarUrls() {
      const newUrls: Record<string, string> = {};

      for (const terminal of terminals) {
        if (terminal.avatar && isCustomAvatar(terminal.avatar)) {
          if (!avatarUrls[terminal.avatar]) {
            try {
              const url = await getCustomAvatarUrl(terminal.avatar);
              newUrls[terminal.avatar] = url;
            } catch (err) {
              console.error('Failed to load custom avatar:', err);
            }
          }
        }
      }

      if (Object.keys(newUrls).length > 0) {
        setAvatarUrls((prev) => ({ ...prev, ...newUrls }));
      }
    }

    if (isOpen && terminals.length > 0) {
      loadAvatarUrls();
    }
  }, [isOpen, terminals]);

  // Load droids and skills when project changes
  useEffect(() => {
    async function loadDroidsAndSkills() {
      if (!selectedProjectPath) {
        setAvailableDroids([]);
        setAvailableSkills([]);
        return;
      }

      setLoadingDroidsSkills(true);
      try {
        const [droids, skills] = await Promise.all([
          loadAvailableDroids(selectedProjectPath),
          loadAvailableSkills(selectedProjectPath),
        ]);
        setAvailableDroids(droids);
        setAvailableSkills(skills);
      } catch (err) {
        console.error('Failed to load droids/skills:', err);
      } finally {
        setLoadingDroidsSkills(false);
      }
    }

    if (isOpen && selectedProjectPath) {
      loadDroidsAndSkills();
    }
  }, [isOpen, selectedProjectPath]);

  // Reset form when modal opens (or populate for edit mode / initialValues from drag / draft)
  // Use refs to prevent re-initialization on every draft change
  useLayoutEffect(() => {
    // Detect if modal just opened (transition from closed to open)
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    // If modal closed, reset initialization flag for next open
    if (!isOpen) {
      isInitializedRef.current = false;
      return;
    }

    // Only initialize once per modal session
    if (isInitializedRef.current) {
      return;
    }

    // Mark as initialized
    isInitializedRef.current = true;
    setAttachmentError(null);
    // 🦆 Reset submitting state when modal opens
    setIsSubmitting(false);

    if (editTask) {
      // Edit mode: populate with existing task data
      setTitle(editTask.title);
      setPrompt(editTask.prompt);
      setSelectedProjectPath(editTask.projectPath);
      setSelectedBranch(editTask.branch || '');
      // Agent ID will be set by separate useEffect when terminals are ready
      setSelectedAgentId(editTask.assignedAgent?.id || '');
      setUseWorktree(editTask.useWorktree || false);
      // Load existing attachments
      setAttachments(editTask.attachments || []);
      // Reset droids/skills selection for edit mode
      setSelectedDroids([]);
      setSelectedSkills([]);
    } else if (initialValues) {
      // Drag-and-drop mode: pre-populate with agent data from sidebar
      // This resets the draft because user dragged a new agent
      setTitle('');
      setPrompt('');
      setSelectedProjectPath(initialValues.projectPath || '');
      setSelectedBranch(initialValues.branch || '');
      setSelectedAgentId(initialValues.agentId || '');
      setUseWorktree(false);
      setAttachments([]);
      setSelectedDroids([]);
      setSelectedSkills([]);
    } else if (draft) {
      // Restore from draft (user closed modal accidentally)
      setTitle(draft.title);
      setPrompt(draft.prompt);
      setSelectedProjectPath(draft.projectPath);
      setSelectedBranch(draft.branch);
      setSelectedAgentId(draft.agentId);
      setUseWorktree(false);
      setAttachments(draft.attachments);
      setSelectedDroids([]);
      setSelectedSkills([]);
    } else {
      // Create mode: reset form
      setTitle('');
      setPrompt('');
      setSelectedProjectPath('');
      setSelectedBranch('');
      setSelectedAgentId('');
      setUseWorktree(false);
      setAttachments([]);
      setSelectedDroids([]);
      setSelectedSkills([]);
    }
  }, [isOpen, editTask, initialValues, draft]);

  // Save draft when form changes (only in create mode, not edit mode)
  useEffect(() => {
    if (isOpen && !editTask && onDraftChange) {
      // Only save draft if there's meaningful content
      if (title || prompt || selectedProjectPath) {
        onDraftChange({
          title,
          prompt,
          projectPath: selectedProjectPath,
          branch: selectedBranch,
          agentId: selectedAgentId,
          attachments,
        });
      }
    }
  }, [isOpen, editTask, title, prompt, selectedProjectPath, selectedBranch, selectedAgentId, attachments, onDraftChange]);

  // Auto-select first project if only one exists
  useEffect(() => {
    if (isOpen && projectGroups.length === 1 && !selectedProjectPath) {
      setSelectedProjectPath(projectGroups[0].path);
    }
  }, [isOpen, projectGroups, selectedProjectPath]);


  // Auto-select branch when project changes (but NOT when using initialValues)
  useEffect(() => {
    // Skip auto-selection if we have initialValues with a branch already set
    if (initialValues?.branch && selectedProjectPath === initialValues.projectPath) {
      return;
    }

    if (currentProject && currentProject.branches.length > 0) {
      // Try to select 'main' or first branch
      const defaultBranch = currentProject.branches.includes('main')
        ? 'main'
        : currentProject.branches[0];
      setSelectedBranch(defaultBranch);
    } else {
      setSelectedBranch('');
    }

    // Only reset agent if NOT using initialValues
    if (!initialValues?.agentId) {
      setSelectedAgentId('');
    }
  }, [selectedProjectPath, currentProject, initialValues]);

  // Get avatar URL for a terminal
  const getTerminalAvatarUrl = useCallback(
    (terminal: TerminalInfo): string => {
      if (!terminal.avatar) {
        return getAvatarUrl('duck15.jpeg');
      }
      if (isCustomAvatar(terminal.avatar)) {
        return avatarUrls[terminal.avatar] || getAvatarUrl('duck15.jpeg');
      }
      return getAvatarUrl(terminal.avatar);
    },
    [avatarUrls]
  );

  // Generate unique ID for attachments
  const generateId = useCallback(() => {
    return `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  // Guess MIME type from file extension
  const guessMimeType = useCallback((name: string): string | undefined => {
    const ext = name.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    return ext ? mimeTypes[ext] : undefined;
  }, []);

  // Convert MIME type to extension
  const mimeToExtension = useCallback((mimeType: string): string | undefined => {
    const extensions: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    return extensions[mimeType];
  }, []);

  // Read file as base64
  const readFileAsBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  // Build preview URL for an image
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

  // Create attachment from file path
  const createAttachmentFromPath = useCallback(
    async (path: string): Promise<ChatAttachment | null> => {
      try {
        const metadata = await invoke<FileStatResult>('stat_file', { path });

        if (metadata.is_dir) {
          setAttachmentError('Cannot attach directories.');
          return null;
        }

        if (metadata.size && metadata.size > MAX_FILE_SIZE) {
          setAttachmentError(`File is larger than 15MB.`);
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
        setAttachmentError('Failed to add file.');
        return null;
      }
    },
    [buildPreviewUrl, generateId, guessMimeType]
  );

  // Handle paste event for images
  const handlePaste = useCallback(
    async (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      const files = Array.from(clipboardData.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (files.length === 0) return;

      event.preventDefault();

      for (const file of files) {
        if (attachments.length >= MAX_ATTACHMENTS) {
          setAttachmentError(`Max ${MAX_ATTACHMENTS} images allowed.`);
          break;
        }

        try {
          // Compress image before size check
          const { blob: processedFile, wasCompressed } = await compressImage(file);

          // Check size after compression
          if (processedFile.size > IMAGE_MAX_SIZE) {
            const sizeMsg = wasCompressed
              ? `Even after compression, image is too large (${(processedFile.size / (1024 * 1024)).toFixed(1)}MB). Max: 5MB.`
              : `Image is larger than 5MB (Claude API limit).`;
            setAttachmentError(sizeMsg);
            continue;
          }

          const extensionFromMime = mimeToExtension(file.type);
          const extension = extensionFromMime ?? 'png';
          const base64 = await blobToBase64(processedFile);

          const tempPath = await invoke<string>('save_clipboard_file', {
            dataBase64: base64,
            extension,
            suggestedName: file.name ?? null,
          });

          const entry = await createAttachmentFromPath(tempPath);
          if (entry) {
            setAttachments((prev) => [...prev, entry]);
            setAttachmentError(null);
          }
        } catch (err) {
          console.error('Failed to process pasted image', err);
          setAttachmentError('Unable to attach pasted image.');
        }
      }
    },
    [attachments.length, createAttachmentFromPath, mimeToExtension]
  );

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );

      if (files.length === 0) return;

      for (const file of files) {
        if (attachments.length >= MAX_ATTACHMENTS) {
          setAttachmentError(`Max ${MAX_ATTACHMENTS} images allowed.`);
          break;
        }

        try {
          // Compress image before size check
          const { blob: processedFile, wasCompressed } = await compressImage(file);

          // Check size after compression
          if (processedFile.size > IMAGE_MAX_SIZE) {
            const sizeMsg = wasCompressed
              ? `Even after compression, image is too large (${(processedFile.size / (1024 * 1024)).toFixed(1)}MB). Max: 5MB.`
              : `Image ${file.name} is larger than 5MB (Claude API limit).`;
            setAttachmentError(sizeMsg);
            continue;
          }

          const extensionFromMime = mimeToExtension(file.type);
          const extension = extensionFromMime ?? 'png';
          const base64 = await blobToBase64(processedFile);

          const tempPath = await invoke<string>('save_clipboard_file', {
            dataBase64: base64,
            extension,
            suggestedName: file.name ?? null,
          });

          const entry = await createAttachmentFromPath(tempPath);
          if (entry) {
            setAttachments((prev) => [...prev, entry]);
            setAttachmentError(null);
          }
        } catch (err) {
          console.error('Failed to process dropped image', err);
          setAttachmentError('Unable to attach dropped image.');
        }
      }
    },
    [attachments.length, createAttachmentFromPath, mimeToExtension]
  );

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Format file size
  const formatSize = useCallback((size: number) => {
    if (!size) return '0 B';
    const units = ['B', 'KB', 'MB'];
    const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    // 🦆 Prevent double-click submission
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    let trimmedPrompt = prompt.trim();

    // In edit mode, prompt might be empty (we don't show it), use the original
    if (isEditMode && !trimmedPrompt && editTask) {
      trimmedPrompt = editTask.prompt;
    }

    if (!trimmedTitle || !selectedProjectPath) return;
    if (!isEditMode && !trimmedPrompt) return;

    // 🦆 Set submitting state immediately to prevent double-clicks
    setIsSubmitting(true);

    // Append selected droids to prompt
    if (selectedDroids.length > 0) {
      const selectedDroidNames = selectedDroids
        .map(id => availableDroids.find(d => d.id === id)?.name)
        .filter(Boolean);
      if (selectedDroidNames.length > 0) {
        trimmedPrompt += `\n\n---\nDroids to use for this task: ${selectedDroidNames.join(', ')}`;
      }
    }

    // Append selected skills to prompt
    if (selectedSkills.length > 0) {
      const selectedSkillNames = selectedSkills
        .map(id => availableSkills.find(s => s.id === id)?.name)
        .filter(Boolean);
      if (selectedSkillNames.length > 0) {
        trimmedPrompt += `\n\n---\nSkills to use for this task: ${selectedSkillNames.join(', ')}`;
      }
    }

    const projectName = currentProject?.name || getRepoDisplayName(selectedProjectPath);

    // Find selected agent
    let assignedAgent: KanbanAssignedAgent | undefined;
    if (selectedAgentId) {
      const terminal = terminals.find((t) => t.id === selectedAgentId);
      if (terminal) {
        assignedAgent = {
          id: terminal.id,
          name: terminal.label,
          color: terminal.color,
          avatar: terminal.avatar,
          projectPath: terminal.cwd,
          projectName,
          branch: terminal.branch,
          useWorktree: terminal.useWorktree,
          worktreePath: terminal.worktreePath,
          workingOn: terminal.workingOn,
          personality: terminal.personality as Record<string, unknown>,
        };
      }
    }

    onSubmit(
      trimmedTitle,
      trimmedPrompt,
      selectedProjectPath,
      projectName,
      selectedBranch || undefined,
      assignedAgent,
      attachments,
      useWorktree
    );
  }, [
    title,
    prompt,
    selectedProjectPath,
    selectedBranch,
    selectedAgentId,
    currentProject,
    terminals,
    onSubmit,
    attachments,
    selectedDroids,
    selectedSkills,
    availableDroids,
    availableSkills,
    useWorktree,
    isSubmitting, // 🦆 Add to prevent stale closure
  ]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        // Check if we can submit
        const canSubmit = title.trim() && prompt.trim() && selectedProjectPath;
        if (!canSubmit) return;

        // Allow Enter from input fields (not textarea) or Cmd+Enter from anywhere
        const isFromTextarea = (e.target as HTMLElement).tagName === 'TEXTAREA';

        if (e.metaKey || e.ctrlKey || !isFromTextarea) {
          e.preventDefault();
          handleSubmit();
        }
      }
    },
    [title, prompt, selectedProjectPath, handleSubmit, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  // In edit mode, only title is required (prompt and project are already set)
  const isValid = isEditMode 
    ? title.trim() && selectedProjectPath
    : title.trim() && prompt.trim() && selectedProjectPath;

  return (
    <div
      className="kanban-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="kanban-modal kanban-modal-large" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="kanban-modal-header">
          <h2>{isEditMode ? 'Edit Task' : 'Create New Task'}</h2>
          <button className="kanban-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="kanban-modal-content">
          {/* Project Selection - hidden in edit mode */}
          {!isEditMode && (
            <div className="kanban-form-field">
              <label htmlFor="task-project">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Project
              </label>
              {projectGroups.length === 0 ? (
                <div className="kanban-form-empty">
                  No active projects. Create an agent first.
                </div>
              ) : (
                <select
                  id="task-project"
                  value={selectedProjectPath}
                  onChange={(e) => setSelectedProjectPath(e.target.value)}
                >
                  <option value="">Select a project...</option>
                  {projectGroups.map((group) => (
                    <option key={group.path} value={group.path}>
                      {group.name} ({group.terminals.length} agent{group.terminals.length !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Title field - shown first in edit mode */}
          {isEditMode && (
            <div className="kanban-form-field">
              <label htmlFor="task-title">Title</label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Review authentication flow"
                autoFocus
              />
            </div>
          )}

          {/* Branch Selection */}
          {currentProject && currentProject.branches.length > 0 && (
            <div className="kanban-form-field">
              <label htmlFor="task-branch">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                Branch
              </label>
              <select
                id="task-branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="">All branches</option>
                {currentProject.branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Worktree Toggle - hidden in edit mode */}
          {!isEditMode && currentProject && (
            <div className="kanban-form-field kanban-form-checkbox">
              <label htmlFor="task-worktree" className="kanban-checkbox-label">
                <input
                  type="checkbox"
                  id="task-worktree"
                  checked={useWorktree}
                  onChange={(e) => setUseWorktree(e.target.checked)}
                />
                <span className="kanban-checkbox-custom">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="kanban-checkbox-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                    <line x1="18" y1="9" x2="18" y2="21" />
                  </svg>
                  Use isolated worktree
                </span>
              </label>
              <span className="kanban-form-hint-block">
                Creates a separate Git worktree for this task. Changes are isolated and merge automatically when done.
              </span>
            </div>
          )}

          {/* Agent Selection - hidden in edit mode */}
          {!isEditMode && currentProject && (
            <div className="kanban-form-field">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Assign Agent (optional)
              </label>
              <div className="kanban-agent-grid">
                {/* No agent option */}
                <button
                  type="button"
                  className={`kanban-agent-card ${!selectedAgentId ? 'selected' : ''}`}
                  onClick={() => setSelectedAgentId('')}
                >
                  <div className="kanban-agent-avatar-placeholder" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                  </div>
                  <span className="kanban-agent-name">No agent</span>
                </button>

                {/* Agent cards */}
                {filteredTerminals.map((terminal) => (
                  <button
                    key={terminal.id}
                    type="button"
                    className={`kanban-agent-card ${selectedAgentId === terminal.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAgentId(terminal.id)}
                    style={{ '--agent-color': terminal.color } as React.CSSProperties}
                  >
                    <img
                      src={getTerminalAvatarUrl(terminal)}
                      alt={terminal.label}
                      className="kanban-agent-avatar"
                    />
                    <div className="kanban-agent-info">
                      <span className="kanban-agent-name">{terminal.label}</span>
                      {terminal.branch && (
                        <span className="kanban-agent-branch">{terminal.branch}</span>
                      )}
                    </div>
                    <div
                      className="kanban-agent-color-dot"
                      style={{ background: terminal.color }}
                    />
                  </button>
                ))}

                {/* New Agent button */}
                {onCreateNewAgent && selectedProjectPath && (
                  <button
                    type="button"
                    className="kanban-agent-card kanban-new-agent-card"
                    onClick={() => {
                      onCreateNewAgent(selectedProjectPath);
                      onClose(); // Close the modal to show NewTerminalModal
                    }}
                    title="Create a new agent for this project"
                  >
                    <div className="kanban-agent-avatar-placeholder kanban-new-agent-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </div>
                    <span className="kanban-agent-name">New Agent</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Droids Selection (optional) - hidden in edit mode */}
          {!isEditMode && currentProject && availableDroids.length > 0 && (
            <div className="kanban-form-field">
              <label>
                {/* Robot icon - same as side panel droids tab */}
                <svg viewBox="0 0 20 20" width="14" height="14" style={{ color: '#f28c52' }}>
                  <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="10" cy="2" r="1" fill="currentColor" />
                  <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
                  <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
                  <line x1="7.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Droids (optional)
                <span className="kanban-form-hint">
                  {selectedDroids.length > 0 ? `${selectedDroids.length} selected` : 'multi-select'}
                </span>
              </label>
              {loadingDroidsSkills ? (
                <div className="kanban-loading-indicator">Loading droids...</div>
              ) : (
                <div className="kanban-selection-grid">
                  {availableDroids.map((droid) => (
                    <button
                      key={droid.id}
                      type="button"
                      className={`kanban-selection-card ${selectedDroids.includes(droid.id) ? 'selected' : ''} ${droid.isGlobal ? 'global' : ''}`}
                      onClick={() => {
                        setSelectedDroids(prev =>
                          prev.includes(droid.id)
                            ? prev.filter(id => id !== droid.id)
                            : [...prev, droid.id]
                        );
                      }}
                    >
                      <div className="kanban-selection-icon droid">
                        {/* Robot icon */}
                        <svg viewBox="0 0 20 20" width="16" height="16">
                          <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <circle cx="10" cy="2" r="1" fill="currentColor" />
                          <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
                          <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
                          <line x1="7.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="kanban-selection-info">
                        <span className="kanban-selection-name">{droid.name}</span>
                        <span className="kanban-selection-desc">{droid.specialization}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Skills Selection (optional) - hidden in edit mode */}
          {!isEditMode && currentProject && availableSkills.length > 0 && (
            <div className="kanban-form-field">
              <label>
                {/* Lightning/star icon - same as side panel skills tab */}
                <svg viewBox="0 0 20 20" width="14" height="14" style={{ color: '#fbbf24' }}>
                  <path d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 11v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Skills (optional)
                <span className="kanban-form-hint">
                  {selectedSkills.length > 0 ? `${selectedSkills.length} selected` : 'multi-select'}
                </span>
              </label>
              {loadingDroidsSkills ? (
                <div className="kanban-loading-indicator">Loading skills...</div>
              ) : (
                <div className="kanban-selection-grid">
                  {availableSkills.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      className={`kanban-selection-card ${selectedSkills.includes(skill.id) ? 'selected' : ''} ${skill.isGlobal ? 'global' : ''}`}
                      onClick={() => {
                        setSelectedSkills(prev =>
                          prev.includes(skill.id)
                            ? prev.filter(id => id !== skill.id)
                            : [...prev, skill.id]
                        );
                      }}
                    >
                      <div className="kanban-selection-icon skill">
                        {/* Lightning/star icon */}
                        <svg viewBox="0 0 20 20" width="16" height="16">
                          <path d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 11v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="kanban-selection-info">
                        <span className="kanban-selection-name">{skill.name}</span>
                        <span className="kanban-selection-desc" title={skill.description}>
                          {skill.description.length > 50 ? skill.description.substring(0, 50) + '...' : skill.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Title field - shown in create mode (in edit mode it's at the top) */}
          {!isEditMode && (
            <div className="kanban-form-field">
              <label htmlFor="task-title">Title</label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Review authentication flow"
                autoFocus={!!selectedProjectPath}
              />
            </div>
          )}

          {/* Prompt field with attachment support - shown in create mode and edit mode (readonly if started) */}
          {(!isEditMode || (isEditMode && (editTask?.prompt || editTask?.attachments?.length))) && (
          <div className="kanban-form-field">
            <label htmlFor="task-prompt">
              Prompt
              {!isTaskStarted && (
                <span className="kanban-form-hint">
                  (paste or drop images)
                </span>
              )}
              {isTaskStarted && (
                <span className="kanban-form-hint kanban-form-hint-warning">
                  (task already started - cannot modify)
                </span>
              )}
            </label>
            <div
              className={`kanban-prompt-wrapper ${isDragOver ? 'drag-over' : ''} ${isTaskStarted ? 'readonly' : ''}`}
              onDragOver={!isTaskStarted ? handleDragOver : undefined}
              onDragLeave={!isTaskStarted ? handleDragLeave : undefined}
              onDrop={!isTaskStarted ? handleDrop : undefined}
            >
              <textarea
                ref={textareaRef}
                id="task-prompt"
                value={prompt}
                onChange={(e) => !isTaskStarted && setPrompt(e.target.value)}
                onPaste={!isTaskStarted ? handlePaste : undefined}
                placeholder={isTaskStarted ? "Task already started - prompt cannot be modified" : "Enter the full prompt for the AI agent..."}
                readOnly={isTaskStarted}
                className={isTaskStarted ? 'readonly' : ''}
              />
              {isDragOver && !isTaskStarted && (
                <div className="kanban-prompt-drop-overlay">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>Drop image here</span>
                </div>
              )}
            </div>

            {/* Attachment error */}
            {attachmentError && !isTaskStarted && (
              <div className="kanban-attachment-error">
                {attachmentError}
              </div>
            )}

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className={`kanban-attachments ${isTaskStarted ? 'readonly' : ''}`}>
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="kanban-attachment">
                    {attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.name}
                        className="kanban-attachment-preview"
                      />
                    ) : (
                      <div className="kanban-attachment-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                    )}
                    <div className="kanban-attachment-info">
                      <span className="kanban-attachment-name">{attachment.name}</span>
                      <span className="kanban-attachment-size">{formatSize(attachment.size)}</span>
                    </div>
                    {/* Hide remove button if task is started */}
                    {!isTaskStarted && (
                      <button
                        type="button"
                        className="kanban-attachment-remove"
                        onClick={() => removeAttachment(attachment.id)}
                        title="Remove attachment"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Task Preview - hidden in edit mode */}
          {!isEditMode && title && selectedProjectPath && (
            <div className="kanban-task-preview">
              <div className="kanban-task-preview-header">
                <span className="kanban-task-preview-title">{title}</span>
                {selectedAgentId && (() => {
                  const terminal = terminals.find((t) => t.id === selectedAgentId);
                  return terminal ? (
                    <div className="kanban-task-preview-agent">
                      <img
                        src={getTerminalAvatarUrl(terminal)}
                        alt={terminal.label}
                        style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                      />
                      <span>{terminal.label}</span>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="kanban-task-preview-meta">
                <span>{currentProject?.name || 'Unknown'}</span>
                {selectedBranch && <span> / {selectedBranch}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="kanban-modal-footer">
          <button className="kanban-modal-button secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="kanban-modal-button primary"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="kanban-button-spinner" />
                Creating...
              </>
            ) : isEditMode ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
