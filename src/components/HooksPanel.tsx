import React, { useState } from 'react';
import type { HookConfig, HookType, HookTemplate } from "../types";

/**
 * Hooks Panel - Manage Claude Agent SDK hooks
 * Shows templates and active hooks with toggle/edit/delete functionality
 */

interface HooksPanelProps {
  hooks: HookConfig[];
  loading: boolean;
  error: string | null;
  workingDir?: string;
  onRefresh?: () => void;
  onSaveHook?: (hook: HookConfig) => Promise<void>;
  onDeleteHook?: (hookId: string, scope: string) => Promise<void>;
  onToggleHook?: (hookId: string, enabled: boolean) => Promise<void>;
}

// SVG Icons for templates
const TemplateIcons = {
  logFile: (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h12v12H4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8h6M7 11h4" strokeLinecap="round" />
    </svg>
  ),
  blockSensitive: (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="8" width="10" height="8" rx="1" />
      <path d="M7 8V6a3 3 0 016 0v2" />
    </svg>
  ),
  webhook: (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 3v4M10 13v4M3 10h4M13 10h4" />
    </svg>
  ),
  empty: (
    <svg viewBox="0 0 20 20" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M10 3v7" strokeLinecap="round" />
      <path d="M10 10c0 2.5-2 4-4 4s-4-1.5-4-4" strokeLinecap="round" />
      <circle cx="10" cy="3" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
};

// Predefined hook templates
const HOOK_TEMPLATES: (HookTemplate & { svgIcon: React.ReactNode })[] = [
  {
    id: 'template-log-file',
    name: 'Log to File',
    type: 'PostToolUse',
    matcher: '*',
    commandTemplate: 'echo "$(date): Tool $TOOL_NAME executed" >> ~/.quack/hooks.log',
    description: 'Log every tool execution to a file for auditing',
    icon: 'logFile',
    svgIcon: TemplateIcons.logFile,
  },
  {
    id: 'template-block-sensitive',
    name: 'Block Sensitive Files',
    type: 'PreToolUse',
    matcher: 'Write',
    commandTemplate: 'node -e "const f=\'$FILE_PATH\'; if(f.includes(\'.env\')||f.includes(\'secret\')||f.includes(\'credential\')){process.exit(1)}"',
    description: 'Prevent writing to .env, secrets, and credential files',
    icon: 'blockSensitive',
    svgIcon: TemplateIcons.blockSensitive,
  },
  {
    id: 'template-webhook',
    name: 'Generic Webhook',
    type: 'PostToolUse',
    matcher: '*',
    commandTemplate: 'curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" -d \'{"tool":"$TOOL_NAME","timestamp":"$(date)"}\'',
    description: 'Send POST request to a webhook URL on tool execution',
    icon: 'webhook',
    svgIcon: TemplateIcons.webhook,
    variables: [
      { name: 'WEBHOOK_URL', label: 'Webhook endpoint URL', required: true, type: 'url' }
    ],
  },
];

// Unified hook color (viola - matches Quack Store)
const HOOK_COLOR = '#a78bfa';
// Hook type colors for subtle differentiation (all shades of purple)
const HOOK_TYPE_COLORS: Record<HookType, string> = {
  'PreToolUse': '#a78bfa',
  'PostToolUse': '#a78bfa',
  'Notification': '#a78bfa',
  'Stop': '#a78bfa',
  'SubagentStop': '#a78bfa',
};

export default function HooksPanel({
  hooks,
  loading,
  error,
  workingDir,
  onRefresh,
  onSaveHook,
  onDeleteHook,
  onToggleHook,
}: HooksPanelProps) {
  const [templatesExpanded, setTemplatesExpanded] = useState(true);
  const [activeExpanded, setActiveExpanded] = useState(true);
  const [editingHook, setEditingHook] = useState<HookConfig | null>(null);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<(HookTemplate & { svgIcon: React.ReactNode }) | null>(null);

  // Group hooks by scope
  const projectHooks = hooks.filter(h => h.scope === 'project');
  const globalHooks = hooks.filter(h => h.scope === 'global');

  const handleTemplateClick = (template: HookTemplate & { svgIcon: React.ReactNode }) => {
    const newHook: HookConfig = {
      id: '',
      name: template.name,
      type: template.type,
      matcher: template.matcher,
      command: template.commandTemplate,
      enabled: true,
      scope: workingDir ? 'project' : 'global',
      description: template.description,
    };
    setCreatingFromTemplate(template);
    setEditingHook(newHook);
  };

  const handleSaveHook = async () => {
    if (!editingHook || !onSaveHook) return;
    try {
      await onSaveHook(editingHook);
      setEditingHook(null);
      setCreatingFromTemplate(null);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save hook:', err);
    }
  };

  const handleDeleteHook = async (hook: HookConfig) => {
    if (!onDeleteHook) return;
    if (!confirm(`Delete hook "${hook.name}"?`)) return;
    try {
      await onDeleteHook(hook.id, hook.scope);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete hook:', err);
    }
  };

  const handleToggleHook = async (hook: HookConfig) => {
    if (!onToggleHook) return;
    try {
      await onToggleHook(hook.id, !hook.enabled);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to toggle hook:', err);
    }
  };

  const renderHookCard = (hook: HookConfig) => (
    <div
      key={hook.id}
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-pointer"
      style={{ opacity: hook.enabled ? 1 : 0.5 }}
      onClick={() => setEditingHook(hook)}
    >
      {/* Icon - Purple gradient background with white icon (matches Quack Store) */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' }}>
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="white" strokeWidth="1.5">
          <path d="M10 3v7" strokeLinecap="round" />
          <path d="M10 10c0 2.5-2 4-4 4s-4-1.5-4-4" strokeLinecap="round" />
          <circle cx="10" cy="3" r="1.5" fill="white" stroke="none" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/90 truncate">{hook.name}</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{
              background: `${HOOK_TYPE_COLORS[hook.type]}15`,
              color: HOOK_TYPE_COLORS[hook.type],
            }}
          >
            {hook.type}
          </span>
          <code className="px-1.5 py-0.5 rounded bg-white/5 text-white/50 text-[10px] font-mono">
            {hook.matcher}
          </code>
        </div>
        {hook.description && (
          <p className="text-xs text-white/50 mt-0.5 truncate">{hook.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Toggle */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleToggleHook(hook); }}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title={hook.enabled ? 'Disable' : 'Enable'}
        >
          <div
            className="w-6 h-3 rounded-full relative transition-colors duration-200"
            style={{ background: hook.enabled ? '#10b981' : 'rgba(255, 255, 255, 0.2)' }}
          >
            <span
              className="absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all duration-200"
              style={{ left: hook.enabled ? '14px' : '2px' }}
            />
          </div>
        </button>
        {/* Delete */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleDeleteHook(hook); }}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-red-400 transition-colors text-xs"
          title="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Hooks</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setEditingHook({
                id: '',
                name: 'New Hook',
                type: 'PostToolUse',
                matcher: '*',
                command: '',
                enabled: true,
                scope: workingDir ? 'project' : 'global',
              })}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
            >
              + New Hook
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div
            className="flex items-center justify-center py-8 text-sm"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            Loading hooks...
          </div>
        )}

        {error && (
          <div className="p-4">
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#EF4444",
              }}
            >
              <p className="font-medium mb-1">Error loading hooks</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="p-4">
            {/* Templates Section */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setTemplatesExpanded(!templatesExpanded)}
                className="flex items-center gap-2 w-full text-left mb-3"
              >
                <svg
                  viewBox="0 0 20 20"
                  width="12"
                  height="12"
                  fill="currentColor"
                  className="text-white/40 transition-transform"
                  style={{
                    transform: templatesExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  <path d="M6 4l8 6-8 6V4z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Templates
                </span>
              </button>

              {templatesExpanded && (
                <div className="space-y-1">
                  {HOOK_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateClick(template)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg text-left hover:bg-white/5 transition-all duration-200"
                    >
                      {/* Icon - Purple gradient background with white icon (matches Quack Store) */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' }}>
                        <span style={{ color: 'white' }}>{template.svgIcon}</span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/90">{template.name}</span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: `${HOOK_TYPE_COLORS[template.type]}15`,
                              color: HOOK_TYPE_COLORS[template.type],
                            }}
                          >
                            {template.type}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-0.5 truncate">{template.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Hooks Section */}
            <div>
              <button
                type="button"
                onClick={() => setActiveExpanded(!activeExpanded)}
                className="flex items-center gap-2 w-full text-left mb-3"
              >
                <svg
                  viewBox="0 0 20 20"
                  width="12"
                  height="12"
                  fill="currentColor"
                  className="text-white/40 transition-transform"
                  style={{
                    transform: activeExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  <path d="M6 4l8 6-8 6V4z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Active Hooks
                </span>
                {hooks.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/10 text-white/60">
                    {hooks.filter(h => h.enabled).length}/{hooks.length}
                  </span>
                )}
              </button>

              {activeExpanded && (
                <>
                  {hooks.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-white/20 mb-3 flex justify-center">
                        {TemplateIcons.empty}
                      </div>
                      <p className="text-sm text-white/60 mb-2">No hooks configured</p>
                      <p className="text-xs text-white/40">
                        Click a template above or use the + Add button
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* Project hooks */}
                      {projectHooks.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-3 py-1">
                            Project
                          </p>
                          {projectHooks.map(renderHookCard)}
                        </>
                      )}
                      {/* Global hooks */}
                      {globalHooks.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-3 py-1 mt-2">
                            Global
                          </p>
                          {globalHooks.map(renderHookCard)}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingHook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setEditingHook(null)}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{
              background: 'linear-gradient(145deg, rgba(30, 30, 35, 0.98), rgba(20, 20, 25, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingHook.id ? 'Edit Hook' : 'Create Hook'}
              {creatingFromTemplate && (
                <span className="text-sm font-normal text-white/50 ml-2">
                  from {creatingFromTemplate.name}
                </span>
              )}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Name</label>
                <input
                  type="text"
                  value={editingHook.name}
                  onChange={(e) => setEditingHook({ ...editingHook, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="My Hook"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Type</label>
                <select
                  value={editingHook.type}
                  onChange={(e) => setEditingHook({ ...editingHook, type: e.target.value as HookType })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30"
                >
                  <option value="PreToolUse">PreToolUse</option>
                  <option value="PostToolUse">PostToolUse</option>
                  <option value="Notification">Notification</option>
                  <option value="Stop">Stop</option>
                  <option value="SubagentStop">SubagentStop</option>
                </select>
              </div>

              {/* Matcher */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">
                  Matcher <span className="text-white/30">(tool name or * for all)</span>
                </label>
                <input
                  type="text"
                  value={editingHook.matcher}
                  onChange={(e) => setEditingHook({ ...editingHook, matcher: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono bg-white/5 border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="Write, Read, Bash, *"
                />
              </div>

              {/* Command */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Command</label>
                <textarea
                  value={editingHook.command}
                  onChange={(e) => setEditingHook({ ...editingHook, command: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono bg-white/5 border border-white/10 focus:outline-none focus:border-white/30 resize-none"
                  placeholder='echo "Hook executed"'
                />
              </div>

              {/* Scope */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Scope</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingHook({ ...editingHook, scope: 'project' })}
                    disabled={!workingDir}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      editingHook.scope === 'project'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                        : 'bg-white/5 text-white/50 border-white/10'
                    } border disabled:opacity-50`}
                  >
                    Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingHook({ ...editingHook, scope: 'global' })}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      editingHook.scope === 'global'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                        : 'bg-white/5 text-white/50 border-white/10'
                    } border`}
                  >
                    Global
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">
                  Description <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editingHook.description || ''}
                  onChange={(e) => setEditingHook({ ...editingHook, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="What this hook does..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setEditingHook(null);
                  setCreatingFromTemplate(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white/90 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHook}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-all"
              >
                {editingHook.id ? 'Save Changes' : 'Create Hook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
