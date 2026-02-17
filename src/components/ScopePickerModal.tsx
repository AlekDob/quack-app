import { useState, useEffect } from 'react';

interface ScopePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onConfirm: (name: string, scope: 'global' | 'project') => Promise<void>;
  defaultName?: string;
}

export function ScopePickerModal({
  isOpen,
  onClose,
  title,
  onConfirm,
  defaultName = '',
}: ScopePickerModalProps) {
  const [name, setName] = useState(defaultName);
  const [scope, setScope] = useState<'global' | 'project'>('project');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setScope('project');
      setCreating(false);
      setError(null);
    }
  }, [isOpen, defaultName]);

  const handleConfirm = async () => {
    const safeName = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
    if (!safeName) {
      setError('Name is required');
      return;
    }
    try {
      setCreating(true);
      setError(null);
      await onConfirm(safeName, scope);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !creating) {
      void handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-xs text-white/50 mt-1">
            Choose a name and scope for your new {title.toLowerCase().replace('new ', '')}
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="my-droid-name"
              autoFocus
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
            <p className="text-xs text-white/30 mt-1">Lowercase, hyphens allowed</p>
          </div>

          {/* Scope toggle */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">Scope</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScope('project')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  scope === 'project'
                    ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Project
              </button>
              <button
                type="button"
                onClick={() => setScope('global')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  scope === 'global'
                    ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20" />
                </svg>
                Global
              </button>
            </div>
            <p className="text-xs text-white/30 mt-1.5">
              {scope === 'project'
                ? 'Available only in this project'
                : 'Available across all projects'}
            </p>
          </div>

          {/* Error */}
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
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
