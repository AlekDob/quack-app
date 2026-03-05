import { useState, useEffect } from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';
import CodeEditorCodeMirror from './CodeEditorCodeMirror';

interface CommandEditorProps {
  isOpen: boolean;
  command?: SlashCommand; // If provided, we're editing; otherwise creating
  onClose: () => void;
  onSave: (name: string, description: string, content: string, parameters: string[], scope: 'project' | 'global') => Promise<void>;
}

export function CommandEditor({ isOpen, command, onClose, onSave }: CommandEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [parameters, setParameters] = useState('');
  const [scope, setScope] = useState<'project' | 'global'>('project');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!command;

  // Reset form when modal opens/closes or command changes
  useEffect(() => {
    if (isOpen) {
      if (command) {
        setName(command.name);
        setDescription(command.description);
        setContent(command.content);
        setParameters(command.parameters?.join(', ') || '');
        setScope(command.scope === 'global' ? 'global' : 'project');
      } else {
        setName('');
        setDescription('');
        setContent('');
        setParameters('');
        setScope('project');
      }
      setError(null);
    }
  }, [isOpen, command]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Command name is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    // Parse parameters (comma-separated)
    const parsedParams = parameters
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    try {
      setSaving(true);
      setError(null);
      await onSave(name.trim(), description.trim(), content.trim(), parsedParams, scope);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save command');
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
            {isEditing ? 'Edit Command' : 'New Command'}
          </h2>
          <p className="text-xs text-white/50 mt-1">
            {isEditing ? 'Modify your custom command' : 'Create a new custom slash command'}
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Command Name
            </label>
            <div className="flex items-center gap-2">
              <span className="text-white/50">/</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="commit"
                disabled={isEditing} // Can't change name when editing
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {isEditing && (
              <p className="text-xs text-white/30 mt-1">Command name cannot be changed</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Git commit management via Giuseppe Git Manager"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Parameters (optional) */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Parameters <span className="text-white/30">(optional, comma-separated)</span>
            </label>
            <input
              type="text"
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              placeholder="message, push, diff:n, type:feat|fix"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
            <p className="text-xs text-white/30 mt-1">
              Example: message, push, diff:n, type:feat|fix|docs
            </p>
          </div>

          {/* Scope Selector */}
          {!isEditing && (
            <div>
              <label className="block text-xs font-medium text-white/70 mb-2">
                Command Scope
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="project"
                    checked={scope === 'project'}
                    onChange={() => setScope('project')}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm text-white/80">Project</span>
                    <span className="text-xs text-white/50">Only in this project (.claude/commands/)</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="global"
                    checked={scope === 'global'}
                    onChange={() => setScope('global')}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm text-white/80">Global</span>
                    <span className="text-xs text-white/50">Available in all projects (~/.claude/commands/)</span>
                  </div>
                </label>
              </div>
            </div>
          )}
          {isEditing && (
            <div>
              <label className="block text-xs font-medium text-white/70 mb-2">
                Command Scope
              </label>
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <span className="text-sm text-white/60">
                  {command?.scope === 'global' ? 'Global (~/.claude/commands/)' : 'Project (.claude/commands/)'}
                </span>
              </div>
              <p className="text-xs text-white/30 mt-1">Scope cannot be changed when editing</p>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Command Content
            </label>
            <div className="border border-white/10 rounded-lg overflow-hidden" style={{ height: '300px' }}>
              <CodeEditorCodeMirror
                content={content}
                filename="command.md"
                language="markdown"
                readOnly={false}
                onChange={setContent}
              />
            </div>
            <p className="text-xs text-white/30 mt-1">
              This content will be sent to Claude when the command is executed
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
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Command'}
          </button>
        </div>
      </div>
    </div>
  );
}
