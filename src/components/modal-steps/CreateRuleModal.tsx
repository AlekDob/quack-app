/**
 * CreateRuleModal - Inline modal for creating new rules
 *
 * Opens as an overlay on top of the NewTerminalModal,
 * allowing users to create rules without closing the agent wizard.
 */

import { useState } from 'react';
import type { RuleScope } from '../../types';
import './CreateRuleModal.css';

interface CreateRuleModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    content: string,
    scope: RuleScope,
    description?: string,
    globs?: string[],
    alwaysApply?: boolean
  ) => Promise<void>;
  creating: boolean;
}

export function CreateRuleModal({
  open,
  onClose,
  onCreate,
  creating,
}: CreateRuleModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<RuleScope>('project');
  const [globs, setGlobs] = useState('');
  const [alwaysApply, setAlwaysApply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Rule name is required');
      return;
    }

    if (!content.trim()) {
      setError('Rule content is required');
      return;
    }

    // Parse globs
    const globsArray = globs
      .split(',')
      .map(g => g.trim())
      .filter(Boolean);

    try {
      await onCreate(
        name.trim(),
        content.trim(),
        scope,
        description.trim() || undefined,
        globsArray.length > 0 ? globsArray : undefined,
        alwaysApply || undefined
      );

      // Reset form
      setName('');
      setDescription('');
      setContent('');
      setScope('project');
      setGlobs('');
      setAlwaysApply(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="create-rule-overlay" onClick={handleBackdropClick}>
      <div className="create-rule-modal">
        <div className="create-rule-header">
          <h3>Create New Rule</h3>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-rule-form">
          {error && (
            <div className="form-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="rule-name">Name</label>
              <input
                id="rule-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., code-style"
                autoFocus
              />
              <span className="input-hint">Will create {name || 'rule-name'}.md</span>
            </div>

            <div className="form-group">
              <label htmlFor="rule-scope">Scope</label>
              <div className="scope-toggle">
                <button
                  type="button"
                  className={`scope-option ${scope === 'project' ? 'active' : ''}`}
                  onClick={() => setScope('project')}
                >
                  Project
                </button>
                <button
                  type="button"
                  className={`scope-option ${scope === 'global' ? 'active' : ''}`}
                  onClick={() => setScope('global')}
                >
                  Global
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="rule-description">Description (optional)</label>
            <input
              id="rule-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the rule"
            />
          </div>

          <div className="form-group">
            <label htmlFor="rule-content">Content</label>
            <textarea
              id="rule-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your rule instructions here...&#10;&#10;Example:&#10;- Always use TypeScript strict mode&#10;- Prefer functional components&#10;- Use meaningful variable names"
              rows={8}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="rule-globs">File Patterns (optional)</label>
              <input
                id="rule-globs"
                type="text"
                value={globs}
                onChange={(e) => setGlobs(e.target.value)}
                placeholder="*.ts, *.tsx, src/**/*"
              />
              <span className="input-hint">Comma-separated glob patterns</span>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={alwaysApply}
                  onChange={(e) => setAlwaysApply(e.target.checked)}
                />
                <span className="checkbox-custom" />
                <span>Always Apply</span>
              </label>
              <span className="input-hint">Apply to all matching files</span>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
