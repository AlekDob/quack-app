import { useState, useEffect } from 'react';
import type { Rule, RuleScope } from '../types';

interface RuleEditorProps {
  isOpen: boolean;
  rule?: Rule;
  onClose: () => void;
  onSave: (
    name: string,
    content: string,
    scope: RuleScope,
    description?: string,
    globs?: string[]
  ) => Promise<void>;
}

export function RuleEditor({ isOpen, rule, onClose, onSave }: RuleEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [globs, setGlobs] = useState('');
  const [scope, setScope] = useState<RuleScope>('project');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!rule;

  // Extract body content (without frontmatter) from full content
  const extractBody = (fullContent: string): string => {
    const match = fullContent.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
    return match ? match[1] : fullContent;
  };

  // Reset form when modal opens/closes or rule changes
  useEffect(() => {
    if (isOpen) {
      if (rule) {
        setName(rule.name);
        setDescription(rule.frontmatter?.description || '');
        setContent(extractBody(rule.content));
        setGlobs(rule.frontmatter?.globs?.join(', ') || '');
        setScope(rule.scope);
      } else {
        setName('');
        setDescription('');
        setContent('');
        setGlobs('');
        setScope('project');
      }
      setError(null);
    }
  }, [isOpen, rule]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Rule name is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    // Validate name (no spaces, special chars)
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      setError('Name can only contain letters, numbers, dashes, and underscores');
      return;
    }

    // Parse globs
    const parsedGlobs = globs
      .split(',')
      .map(g => g.trim())
      .filter(Boolean);

    // Build full content with frontmatter
    let fullContent = '';
    if (description || parsedGlobs.length > 0) {
      const frontmatterLines = ['---'];
      if (description) {
        frontmatterLines.push(`description: "${description.trim()}"`);
      }
      if (parsedGlobs.length > 0) {
        frontmatterLines.push('globs:');
        parsedGlobs.forEach(g => frontmatterLines.push(`  - "${g}"`));
      }
      frontmatterLines.push('---\n');
      fullContent = frontmatterLines.join('\n') + content.trim();
    } else {
      fullContent = content.trim();
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(
        name.trim(),
        fullContent,
        scope,
        description.trim() || undefined,
        parsedGlobs.length > 0 ? parsedGlobs : undefined
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Rule' : 'New Rule'}
          </h2>
          <p className="text-xs text-white/50 mt-1">
            {isEditing
              ? 'Modify your rule configuration'
              : 'Create a rule to customize Claude behavior for specific files'}
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Rule Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="typescript-style"
              disabled={isEditing}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isEditing && (
              <p className="text-xs text-white/30 mt-1">Rule name cannot be changed</p>
            )}
          </div>

          {/* Scope */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Scope
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="project"
                  checked={scope === 'project'}
                  onChange={() => setScope('project')}
                  disabled={isEditing}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm text-white/70">Project (.claude/rules/)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="global"
                  checked={scope === 'global'}
                  onChange={() => setScope('global')}
                  disabled={isEditing}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm text-white/70">Global (~/.claude/rules/)</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Description <span className="text-white/30">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="TypeScript coding standards for this project"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Globs */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              File Patterns <span className="text-white/30">(optional, comma-separated)</span>
            </label>
            <input
              type="text"
              value={globs}
              onChange={(e) => setGlobs(e.target.value)}
              placeholder="src/**/*.ts, src/**/*.tsx"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 font-mono"
            />
            <p className="text-xs text-white/30 mt-1">
              Apply this rule only to files matching these patterns
            </p>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Rule Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your rule instructions in markdown..."
              rows={12}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 font-mono resize-none"
            />
            <p className="text-xs text-white/30 mt-1">
              Claude will follow these instructions when working with matching files
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
