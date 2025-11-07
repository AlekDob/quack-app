import { useState } from 'react';
import type { MarketplaceCategory, MarketplaceResource } from '../types';

/**
 * MarketplaceContributeModal - Form for contributing new resources
 * Allows users to submit their own agents, commands, hooks, etc.
 */

interface MarketplaceContributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (resource: Partial<MarketplaceResource>) => Promise<void>;
}

export default function MarketplaceContributeModal({
  isOpen,
  onClose,
  onSubmit,
}: MarketplaceContributeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'agents' as MarketplaceCategory,
    installCommand: '',
    repository: '',
    tags: '',
    version: '1.0.0',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    if (!formData.installCommand.trim()) {
      setError('Install command is required');
      return;
    }

    setSubmitting(true);

    try {
      const resource: Partial<MarketplaceResource> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        installCommand: formData.installCommand.trim(),
        repository: formData.repository.trim() || undefined,
        tags: formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        version: formData.version.trim(),
        author: 'You', // In production, this would be the authenticated user
        installCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSubmit(resource);

      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'agents',
        installCommand: '',
        repository: '',
        tags: '',
        version: '1.0.0',
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit resource');
    } finally {
      setSubmitting(false);
    }
  };

  const categories: Array<{ value: MarketplaceCategory; label: string; icon: string }> = [
    { value: 'agents', label: 'Agent', icon: '🦆' },
    { value: 'commands', label: 'Command', icon: '⌘' },
    { value: 'hooks', label: 'Hook', icon: '🪝' },
    { value: 'settings', label: 'Settings', icon: '⚙️' },
    { value: 'mcp', label: 'MCP Server', icon: '🔌' },
    { value: 'stacks', label: 'Stack', icon: '📚' },
    { value: 'skills', label: 'Skill', icon: '⭐' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full mx-4 overflow-hidden"
        style={{
          background: 'rgba(12, 16, 24, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          maxHeight: '90vh',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-xl font-bold"
                style={{ color: 'rgba(255, 255, 255, 0.9)' }}
              >
                Contribute to Marketplace
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                Share your resource with the Quack community
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="p-6 space-y-5">
            {/* Error Message */}
            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}
              >
                {error}
              </div>
            )}

            {/* Category Selection */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Category
              </label>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    className="p-3 rounded-lg text-center transition-all duration-200"
                    style={{
                      background: formData.category === cat.value
                        ? 'rgba(242, 140, 82, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${formData.category === cat.value
                        ? 'rgba(242, 140, 82, 0.5)'
                        : 'rgba(255, 255, 255, 0.1)'}`,
                      color: formData.category === cat.value
                        ? '#f28c52'
                        : 'rgba(255, 255, 255, 0.7)',
                    }}
                  >
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <div className="text-xs font-medium">{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome Resource"
                className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Description *
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of what this resource does..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors resize-none"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
                required
              />
            </div>

            {/* Install Command */}
            <div>
              <label
                htmlFor="installCommand"
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Install Command *
              </label>
              <input
                id="installCommand"
                type="text"
                value={formData.installCommand}
                onChange={(e) => setFormData({ ...formData, installCommand: e.target.value })}
                placeholder="npx your-package@latest --flag=value"
                className="w-full px-4 py-2.5 rounded-lg text-sm font-mono transition-colors"
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#22c55e',
                }}
                required
              />
              <p
                className="text-xs mt-1"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                Full npx command users will run to install this resource
              </p>
            </div>

            {/* Repository URL */}
            <div>
              <label
                htmlFor="repository"
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Repository URL (Optional)
              </label>
              <input
                id="repository"
                type="url"
                value={formData.repository}
                onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                placeholder="https://github.com/username/repository"
                className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              />
            </div>

            {/* Version */}
            <div>
              <label
                htmlFor="version"
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Version
              </label>
              <input
                id="version"
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="1.0.0"
                className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              />
            </div>

            {/* Tags */}
            <div>
              <label
                htmlFor="tags"
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Tags (comma-separated)
              </label>
              <input
                id="tags"
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="ai, automation, productivity"
                className="w-full px-4 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              />
            </div>

            {/* Preview Card */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Preview
              </label>
              <div
                className="p-4 rounded-lg"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">
                    {categories.find(c => c.value === formData.category)?.icon || '📦'}
                  </div>
                  <div className="flex-1">
                    <h4
                      className="text-base font-semibold mb-1"
                      style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                    >
                      {formData.name || 'Resource Name'}
                    </h4>
                    <p
                      className="text-sm mb-2"
                      style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                    >
                      {formData.description || 'Description will appear here...'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.split(',').filter(t => t.trim()).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-xs"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'rgba(255, 255, 255, 0.6)',
                          }}
                        >
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-end gap-3"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.9)',
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: 'rgba(242, 140, 82, 0.1)',
              border: '1px solid rgba(242, 140, 82, 0.3)',
              color: '#f28c52',
              opacity: submitting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = 'rgba(242, 140, 82, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(242, 140, 82, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.3)';
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Resource'}
          </button>
        </div>
      </div>
    </div>
  );
}
