import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSnippets, SNIPPET_VARIABLES } from '../hooks/useSnippets';
import type { Snippet, SnippetFormData } from '../types';
import './SnippetPopover.css';

interface SnippetPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSnippet: (content: string, cursorOffset?: number) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

type ViewMode = 'list' | 'create' | 'edit';

export function SnippetPopover({
  isOpen,
  onClose,
  onInsertSnippet,
  anchorRef,
}: SnippetPopoverProps) {
  const {
    snippets,
    loading,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    expandVariables,
  } = useSnippets();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [formData, setFormData] = useState<SnippetFormData>({
    name: '',
    content: '',
    tag: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Calculate position based on anchor element
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Update position when opening or anchor changes
  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef?.current;
      if (!anchor) {
        // Fallback handled by popoverStyle
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const popoverWidth = 360; // Match CSS width
      const popoverHeight = 480; // Match CSS max-height

      // Position above the button, aligned to the right
      let top = rect.top - popoverHeight - 12;
      let left = rect.right - popoverWidth;

      // Ensure it doesn't go off-screen
      if (top < 10) {
        top = rect.bottom + 12; // Show below instead
      }
      if (left < 10) {
        left = 10;
      }

      setPosition({ top, left });
    };

    // Initial position calculation (with small delay for DOM to be ready)
    updatePosition();
    const timeoutId = setTimeout(updatePosition, 50);

    // Update on resize/scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRef]);

  // Filter snippets based on search
  const filteredSnippets = useMemo(() => {
    if (!searchQuery.trim()) return snippets;

    const query = searchQuery.toLowerCase();
    return snippets.filter(
      s =>
        s.name.toLowerCase().includes(query) ||
        s.tag.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query)
    );
  }, [snippets, searchQuery]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && viewMode === 'list') {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, viewMode]);

  // Focus name input when entering create/edit mode
  useEffect(() => {
    if (viewMode === 'create' || viewMode === 'edit') {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [viewMode]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Use mousedown to catch clicks before they propagate
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (viewMode !== 'list') {
          setViewMode('list');
          resetForm();
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, viewMode, onClose]);

  const resetForm = useCallback(() => {
    setFormData({ name: '', content: '', tag: '' });
    setFormError(null);
    setSelectedSnippet(null);
  }, []);

  const handleCreateNew = useCallback(() => {
    resetForm();
    setViewMode('create');
  }, [resetForm]);

  const handleEdit = useCallback((snippet: Snippet) => {
    setSelectedSnippet(snippet);
    setFormData({
      name: snippet.name,
      content: snippet.content,
      tag: snippet.tag,
    });
    setViewMode('edit');
  }, []);

  const handleDelete = useCallback(async (snippet: Snippet) => {
    if (!confirm(`Delete snippet "${snippet.name}"?`)) return;

    try {
      await deleteSnippet(snippet.id);
    } catch (err) {
      console.error('Failed to delete snippet:', err);
    }
  }, [deleteSnippet]);

  const handleSave = useCallback(async () => {
    // Validate
    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formData.tag.trim()) {
      setFormError('Tag is required');
      return;
    }
    if (!formData.content.trim()) {
      setFormError('Content is required');
      return;
    }
    // Tag validation: no spaces, alphanumeric + underscores/hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(formData.tag.trim())) {
      setFormError('Tag can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (viewMode === 'create') {
        await createSnippet(formData);
      } else if (viewMode === 'edit' && selectedSnippet) {
        await updateSnippet(selectedSnippet.id, formData);
      }
      setViewMode('list');
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }, [formData, viewMode, selectedSnippet, createSnippet, updateSnippet, resetForm]);

  const handleUseSnippet = useCallback(async (snippet: Snippet) => {
    try {
      // Expand variables
      let content = await expandVariables(snippet.content);

      // Check for cursor marker
      const cursorIndex = content.indexOf('{cursor}');
      if (cursorIndex !== -1) {
        content = content.replace(/{cursor}/gi, '');
        onInsertSnippet(content, cursorIndex);
      } else {
        onInsertSnippet(content);
      }

      onClose();
    } catch (err) {
      console.error('Failed to expand snippet:', err);
      // Fallback: insert without expansion
      onInsertSnippet(snippet.content);
      onClose();
    }
  }, [expandVariables, onInsertSnippet, onClose]);

  const insertVariable = useCallback((variable: string) => {
    const textarea = document.querySelector('.snippet-form-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent =
      formData.content.substring(0, start) +
      variable +
      formData.content.substring(end);

    setFormData(prev => ({ ...prev, content: newContent }));

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }, [formData.content]);

  if (!isOpen) return null;

  // Use fixed positioning with calculated position
  // Fallback: position at bottom-right of viewport if anchor not available
  const popoverStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: position.top,
        left: position.left,
      }
    : {
        position: 'fixed',
        bottom: 100,
        right: 20,
      };

  return (
    <div
      className="snippet-popover"
      ref={popoverRef}
      style={popoverStyle}
    >
      {/* Header */}
      <div className="snippet-popover-header">
        {viewMode === 'list' ? (
          <>
            <span className="snippet-popover-title">Snippets</span>
            <button
              type="button"
              className="snippet-popover-add-btn"
              onClick={handleCreateNew}
              title="Create new snippet"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="snippet-popover-back-btn"
              onClick={() => {
                setViewMode('list');
                resetForm();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
            <span className="snippet-popover-title">
              {viewMode === 'create' ? 'New Snippet' : 'Edit Snippet'}
            </span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="snippet-popover-content">
        {viewMode === 'list' ? (
          <>
            {/* Search */}
            <div className="snippet-search-wrapper">
              <svg className="snippet-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="snippet-search-input"
                placeholder="Search snippets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Snippets List */}
            <div className="snippet-list">
              {loading ? (
                <div className="snippet-loading">Loading snippets...</div>
              ) : filteredSnippets.length === 0 ? (
                <div className="snippet-empty">
                  {searchQuery ? 'No snippets match your search' : 'No snippets yet. Create one!'}
                </div>
              ) : (
                filteredSnippets.map(snippet => (
                  <div key={snippet.id} className="snippet-item">
                    <button
                      type="button"
                      className="snippet-item-main"
                      onClick={() => handleUseSnippet(snippet)}
                    >
                      <div className="snippet-item-header">
                        <span className="snippet-item-name">{snippet.name}</span>
                        <span className="snippet-item-tag">{snippet.tag}</span>
                      </div>
                      <div className="snippet-item-preview">
                        {snippet.content.length > 80
                          ? snippet.content.substring(0, 80) + '...'
                          : snippet.content}
                      </div>
                    </button>
                    <div className="snippet-item-actions">
                      <button
                        type="button"
                        className="snippet-item-action edit"
                        onClick={e => {
                          e.stopPropagation();
                          handleEdit(snippet);
                        }}
                        title="Edit"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M12.854 1.146a.5.5 0 0 0-.708 0l-1 1a.5.5 0 0 0 0 .708l2 2a.5.5 0 0 0 .708 0l1-1a.5.5 0 0 0 0-.708l-2-2zM11.5 3.207L4.5 10.207V12h1.793l7-7L11.5 3.207zM2 13h12v1H2v-1z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="snippet-item-action delete"
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(snippet);
                        }}
                        title="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Create/Edit Form */
          <div className="snippet-form">
            <div className="snippet-form-field">
              <label className="snippet-form-label">Name</label>
              <input
                ref={nameInputRef}
                type="text"
                className="snippet-form-input"
                placeholder="e.g., Fix Bug Template"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="snippet-form-field">
              <label className="snippet-form-label">
                Tag
                <span className="snippet-form-hint">Type this to expand</span>
              </label>
              <input
                type="text"
                className="snippet-form-input tag-input"
                placeholder="e.g., fixbug"
                value={formData.tag}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  tag: e.target.value.replace(/\s/g, ''),
                }))}
              />
            </div>

            <div className="snippet-form-field">
              <label className="snippet-form-label">Content</label>
              <textarea
                className="snippet-form-textarea"
                placeholder="Enter your snippet content...&#10;&#10;Use variables like {date}, {clipboard}, {cursor}"
                value={formData.content}
                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={5}
              />
            </div>

            {/* Variables */}
            <div className="snippet-variables">
              <span className="snippet-variables-label">Insert variable:</span>
              <div className="snippet-variables-list">
                {SNIPPET_VARIABLES.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    className="snippet-variable-btn"
                    onClick={() => insertVariable(v.key)}
                    title={`${v.label} (${v.example})`}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>

            {formError && (
              <div className="snippet-form-error">{formError}</div>
            )}

            <div className="snippet-form-actions">
              <button
                type="button"
                className="snippet-btn secondary"
                onClick={() => {
                  setViewMode('list');
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="snippet-btn primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : viewMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {viewMode === 'list' && snippets.length > 0 && (
        <div className="snippet-popover-footer">
          Type a tag in the input to auto-expand
        </div>
      )}
    </div>
  );
}

export default SnippetPopover;
