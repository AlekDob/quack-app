import { useState, useEffect } from 'react';
import type { AgentInfo } from '../types';
import { getRandomAgentName } from '../utils/agentNames';

interface NewAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    description: string,
    model: string,
    color: string,
    content: string,
    scope: 'global' | 'project',
    workingOn?: string,
    avatar?: string
  ) => Promise<void>;
  existingAgents?: AgentInfo[]; // For duplicate name validation
}

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

export function NewAgentModal({ isOpen, onClose, onSave, existingAgents }: NewAgentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [color, setColor] = useState('blue');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<'global' | 'project'>('project');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName(getRandomAgentName(existingAgents, 'project')); // Set random unique agent name
      setDescription('');
      setModel('claude-sonnet-4-20250514');
      setColor('blue');
      setContent('');
      setScope('project');
      setError(null);
    }
  }, [isOpen, existingAgents]);

  // Update suggested name when scope changes
  useEffect(() => {
    if (isOpen) {
      setName(getRandomAgentName(existingAgents, scope));
    }
  }, [scope, isOpen, existingAgents]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Agent name is required');
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

    try {
      setSaving(true);
      setError(null);
      await onSave(
        name.trim(),
        description.trim(),
        model,
        color,
        content.trim(),
        scope,
        undefined, // workingOn
        undefined  // avatar
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
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
          <h2 className="text-lg font-semibold text-white">New Agent</h2>
          <p className="text-xs text-white/50 mt-1">
            Create a new AI agent with custom instructions
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent Jack"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
            <p className="text-xs text-white/30 mt-1">
              Give your agent a memorable name (e.g., "Agent Jack")
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what this agent does..."
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-vertical"
              style={{ minHeight: '80px' }}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' opacity='0.5' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                paddingRight: '2.5rem'
              }}
            >
              <option value="claude-opus-4-20250514">claude-opus-4-20250514</option>
              <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
              <option value="claude-sonnet-3-5-20241022">claude-sonnet-3-5-20241022</option>
              <option value="claude-haiku-3-5-20241022">claude-haiku-3-5-20241022</option>
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Color
            </label>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {Object.entries(AGENT_COLORS).map(([colorName, colorValue]) => (
                  <button
                    key={colorName}
                    type="button"
                    onClick={() => setColor(colorName)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === colorName ? 'border-white scale-110' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: colorValue }}
                    title={colorName}
                  />
                ))}
              </div>
              <input
                type="color"
                value={AGENT_COLORS[color.toLowerCase()] || color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-8 rounded border border-white/10 cursor-pointer"
              />
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'global' | 'project')}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' opacity='0.5' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                paddingRight: '2.5rem'
              }}
            >
              <option value="project">Project (~/.claude/agents/)</option>
              <option value="global">Global (~/Desktop/Dev/Personal/quack-app/.claude/agents/)</option>
            </select>
            <p className="text-xs text-white/30 mt-1">
              {scope === 'global'
                ? 'Agent will be available globally across all projects'
                : 'Agent will only be available in this project'}
            </p>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">
              Agent Instructions (Markdown)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the agent's instructions and behavior in markdown format..."
              rows={12}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 font-mono resize-none"
            />
            <p className="text-xs text-white/30 mt-1">
              Define the agent's role, expertise, and behavior
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
            {saving ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}
