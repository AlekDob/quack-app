import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import SyncConflictDialog from '../../second-brain/SyncConflictDialog';
import type { BrainSettings, SyncStatus, SyncConflict } from '../../../types/brainSync';

// GlobalSyncStatus from Rust backend (matches GlobalSyncStatus struct)
interface GlobalSyncStatus {
  last_sync_time: number | null;
  entity_count: number;
  conflict_count: number;
  is_generating_embeddings: boolean;
  embedding_progress: number;
}

export default function SecondBrainSettings() {
  const [settings, setSettings] = useState<BrainSettings>({
    vaultPath: '',
    syncEnabled: false,
    syncStructure: 'subfolder',
    autoSyncToVault: false,
    autoSyncFromVault: false,
    conflictPolicy: 'ask',
    autoEmbed: false,
    markdownEditor: 'obsidian',
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncTime: null,
    entityCount: 0,
    conflictCount: 0,
    isGeneratingEmbeddings: false,
    embeddingProgress: 0,
  });

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  // Feedback messages
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Auto-clear feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  useEffect(() => {
    loadSettings();
    loadSyncStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await invoke<BrainSettings>('brain_get_settings');
      console.log('[SecondBrain] Loaded settings from backend:', result);
      setSettings(result);
    } catch (err) {
      console.error('Failed to load brain settings:', err);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const result = await invoke<GlobalSyncStatus>('brain_get_global_sync_status');
      // Map GlobalSyncStatus (snake_case from Rust) to SyncStatus (camelCase for UI)
      setSyncStatus({
        lastSyncTime: result.last_sync_time,
        entityCount: result.entity_count,
        conflictCount: result.conflict_count,
        isGeneratingEmbeddings: result.is_generating_embeddings,
        embeddingProgress: result.embedding_progress,
      });
    } catch (err) {
      console.error('Failed to load sync status:', err);
    }
  };

  // Map camelCase keys to snake_case for Rust backend
  const keyToSnakeCase: Record<keyof BrainSettings, string> = {
    vaultPath: 'vault_path',
    syncEnabled: 'sync_enabled',
    syncStructure: 'sync_structure',
    autoSyncToVault: 'auto_sync_to_vault',
    autoSyncFromVault: 'auto_sync_from_vault',
    conflictPolicy: 'conflict_policy',
    autoEmbed: 'auto_embed',
    markdownEditor: 'markdown_editor',
  };

  const updateSetting = async <K extends keyof BrainSettings>(
    key: K,
    value: BrainSettings[K]
  ) => {
    setLoading(true);
    try {
      // Convert camelCase key to snake_case for Rust backend
      const snakeKey = keyToSnakeCase[key];
      // Convert boolean values to string for Rust
      const stringValue = typeof value === 'boolean' ? String(value) : value;
      await invoke('brain_set_setting', { key: snakeKey, value: stringValue });
      setSettings((prev) => ({ ...prev, [key]: value }));
      console.log(`[SecondBrain] Setting ${key} (${snakeKey}) updated to:`, value);
    } catch (err) {
      console.error(`Failed to update setting ${key}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVaultPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Obsidian Vault Folder',
      });

      if (selected && typeof selected === 'string') {
        await updateSetting('vaultPath', selected);
        // Force reload settings to confirm the change
        await loadSettings();
      }
    } catch (err) {
      console.error('Failed to select vault path:', err);
    }
  };

  const handleOpenVault = async () => {
    try {
      await invoke('brain_open_vault', { editor: settings.markdownEditor });
    } catch (err) {
      console.error('Failed to open vault:', err);
    }
  };

  const handleSyncToVault = async () => {
    setSyncing(true);
    setFeedback({ type: 'info', message: 'Syncing to vault...' });
    try {
      // Reload settings first to ensure we have the latest vault path
      await loadSettings();
      console.log('[SecondBrain] Current vault path:', settings.vaultPath);

      const result = await invoke<number>('brain_sync_to_vault');
      await loadSyncStatus();
      setFeedback({
        type: 'success',
        message: `Synced ${result} entities to vault`
      });
    } catch (err) {
      console.error('Failed to sync to vault:', err);
      setFeedback({ type: 'error', message: `Sync failed: ${err}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFromVault = async () => {
    setSyncing(true);
    setFeedback({ type: 'info', message: 'Importing from vault...' });
    try {
      // Reload settings first to ensure we have the latest vault path
      await loadSettings();
      console.log('[SecondBrain] Current vault path for import:', settings.vaultPath);

      const result = await invoke<{ imported_entities: number; errors: string[] }>('brain_import_from_vault');
      await loadSyncStatus();
      setFeedback({
        type: 'success',
        message: `Imported ${result.imported_entities} entities from vault`
      });
    } catch (err) {
      console.error('Failed to import from vault:', err);
      setFeedback({ type: 'error', message: `Import failed: ${err}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateEmbeddings = async () => {
    setGenerating(true);
    setFeedback({ type: 'info', message: 'Generating embeddings...' });
    try {
      const result = await invoke<{ generated: number; errors: string[] }>('brain_generate_all_embeddings');
      await loadSyncStatus();
      if (result && result.generated !== undefined) {
        setFeedback({
          type: 'success',
          message: `Generated embeddings for ${result.generated} entities`
        });
      } else {
        setFeedback({ type: 'success', message: 'Embeddings generated successfully' });
      }
    } catch (err) {
      console.error('Failed to generate embeddings:', err);
      setFeedback({ type: 'error', message: `Generation failed: ${err}` });
    } finally {
      setGenerating(false);
    }
  };

  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    // Convert from Unix seconds to milliseconds if needed
    const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const date = new Date(ts);
    const now = Date.now();
    const diff = now - ts;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  const handleResolveConflict = async (entityId: string, resolution: 'brain' | 'obsidian') => {
    try {
      await invoke('brain_resolve_conflict', { entityId, resolution });
      // Remove resolved conflict from list
      setConflicts((prev) => prev.filter((c) => c.entityId !== entityId));
      await loadSyncStatus();
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    }
  };

  const handleResolveAllConflicts = async (resolution: 'brain' | 'obsidian') => {
    try {
      for (const conflict of conflicts) {
        await invoke('brain_resolve_conflict', { entityId: conflict.entityId, resolution });
      }
      setConflicts([]);
      setShowConflictDialog(false);
      await loadSyncStatus();
    } catch (err) {
      console.error('Failed to resolve all conflicts:', err);
    }
  };

  const handleShowConflicts = () => {
    // For now, create placeholder conflicts based on count
    // In production, we'd fetch actual conflict details from backend
    if (syncStatus.conflictCount > 0) {
      setShowConflictDialog(true);
    }
  };

  return (
    <div className="settings-category">
      {/* Feedback Toast */}
      {feedback && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor:
              feedback.type === 'success'
                ? 'rgba(76, 175, 80, 0.15)'
                : feedback.type === 'error'
                ? 'rgba(244, 67, 54, 0.15)'
                : 'rgba(33, 150, 243, 0.15)',
            border: `1px solid ${
              feedback.type === 'success'
                ? '#4CAF50'
                : feedback.type === 'error'
                ? '#F44336'
                : '#2196F3'
            }`,
            color:
              feedback.type === 'success'
                ? '#4CAF50'
                : feedback.type === 'error'
                ? '#F44336'
                : '#2196F3',
          }}
        >
          <span style={{ fontSize: '16px' }}>
            {feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '✗' : '↻'}
          </span>
          <span style={{ flex: 1 }}>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '4px',
              opacity: 0.7,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <SectionHeader
        title="Vault Configuration"
        description="Configure your Obsidian vault integration"
      />
      <div className="settings-group">
        <SettingsRow
          label="Vault Path"
          description={
            settings.vaultPath ? (
              <span style={{
                color: '#4CAF50',
                fontFamily: 'monospace',
                fontSize: '12px',
                wordBreak: 'break-all'
              }}>
                {settings.vaultPath}
              </span>
            ) : (
              <span style={{ color: '#999' }}>No vault selected</span>
            )
          }
          control={
            <button
              className="ios-button ios-button-secondary"
              onClick={handleSelectVaultPath}
              disabled={loading}
            >
              {settings.vaultPath ? 'Change' : 'Choose Folder'}
            </button>
          }
        />
        <SettingsRow
          label="Markdown Editor"
          description="Default editor for opening vault files"
          control={
            <select
              className="ios-select"
              value={settings.markdownEditor}
              onChange={(e) =>
                updateSetting('markdownEditor', e.target.value as BrainSettings['markdownEditor'])
              }
              disabled={loading}
            >
              <option value="obsidian">Obsidian (recommended)</option>
              <option value="vscode">VS Code</option>
              <option value="cursor">Cursor</option>
              <option value="default">System Default</option>
            </select>
          }
        />
        <SettingsRow
          label="Open Vault"
          description="Open vault folder in selected editor"
          control={
            <button
              className="ios-button ios-button-secondary"
              onClick={handleOpenVault}
              disabled={!settings.vaultPath || loading}
            >
              Open
            </button>
          }
        />
      </div>

      <SectionHeader
        title="Sync Settings"
        description="Configure automatic synchronization between Brain and Obsidian"
      />
      <div className="settings-group">
        <SettingsRow
          label="Enable Sync"
          description="Enable bidirectional sync between Brain and vault"
          control={
            <IOSSwitch
              checked={settings.syncEnabled}
              onChange={(checked) => updateSetting('syncEnabled', checked)}
              disabled={loading || !settings.vaultPath}
            />
          }
        />
        <SettingsRow
          label="Sync Structure"
          description="How to organize files in the vault"
          control={
            <select
              className="ios-select"
              value={settings.syncStructure}
              onChange={(e) =>
                updateSetting('syncStructure', e.target.value as BrainSettings['syncStructure'])
              }
              disabled={loading || !settings.syncEnabled}
            >
              <option value="subfolder">Subfolder (quack-brain/)</option>
              <option value="flat">Flat (vault root)</option>
            </select>
          }
        />
        <SettingsRow
          label="Auto-sync to Vault"
          description="Automatically update markdown files when Brain changes"
          control={
            <IOSSwitch
              checked={settings.autoSyncToVault}
              onChange={(checked) => updateSetting('autoSyncToVault', checked)}
              disabled={loading || !settings.syncEnabled}
            />
          }
        />
        <SettingsRow
          label="Auto-sync from Vault"
          description="Automatically update Brain when markdown files change"
          control={
            <IOSSwitch
              checked={settings.autoSyncFromVault}
              onChange={(checked) => updateSetting('autoSyncFromVault', checked)}
              disabled={loading || !settings.syncEnabled}
            />
          }
        />
        <SettingsRow
          label="Conflict Policy"
          description="How to handle conflicts during sync"
          control={
            <select
              className="ios-select"
              value={settings.conflictPolicy}
              onChange={(e) =>
                updateSetting('conflictPolicy', e.target.value as BrainSettings['conflictPolicy'])
              }
              disabled={loading || !settings.syncEnabled}
            >
              <option value="ask">Ask every time</option>
              <option value="brain_wins">Brain always wins</option>
              <option value="obsidian_wins">Obsidian always wins</option>
            </select>
          }
        />
      </div>

      <SectionHeader
        title="Embeddings"
        description="Configure semantic search embeddings"
      />
      <div className="settings-group">
        <SettingsRow
          label="Auto-generate Embeddings"
          description="Generate embeddings automatically for new entities"
          control={
            <IOSSwitch
              checked={settings.autoEmbed}
              onChange={(checked) => updateSetting('autoEmbed', checked)}
              disabled={loading}
            />
          }
        />
        <SettingsRow
          label="Generate All Now"
          description={
            generating || syncStatus.isGeneratingEmbeddings
              ? `Generating... ${syncStatus.embeddingProgress}%`
              : 'Generate embeddings for all existing entities'
          }
          control={
            <button
              className="ios-button ios-button-primary"
              onClick={handleGenerateEmbeddings}
              disabled={generating || syncStatus.isGeneratingEmbeddings}
              style={{
                opacity: generating ? 0.7 : 1,
                cursor: generating ? 'wait' : 'pointer',
              }}
            >
              {generating || syncStatus.isGeneratingEmbeddings ? 'Generating...' : 'Generate'}
            </button>
          }
        />
      </div>

      <SectionHeader
        title="Actions"
        description="Manual sync operations"
      />
      <div className="settings-group">
        <SettingsRow
          label="Sync All to Vault"
          description="Export all Brain entities to markdown files"
          control={
            <button
              className="ios-button ios-button-primary"
              onClick={handleSyncToVault}
              disabled={syncing || !settings.vaultPath}
              style={{
                opacity: syncing ? 0.7 : 1,
                cursor: syncing ? 'wait' : 'pointer',
              }}
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          }
        />
        <SettingsRow
          label="Import All from Vault"
          description="Import all markdown files to Brain"
          control={
            <button
              className="ios-button ios-button-primary"
              onClick={handleImportFromVault}
              disabled={syncing || !settings.vaultPath}
              style={{
                opacity: syncing ? 0.7 : 1,
                cursor: syncing ? 'wait' : 'pointer',
              }}
            >
              {syncing ? 'Importing...' : 'Import'}
            </button>
          }
        />
      </div>

      <SectionHeader
        title="Status"
        description="Current sync status and statistics"
      />
      <div className="settings-group">
        <SettingsRow
          label="Last Sync"
          description={formatLastSync(syncStatus.lastSyncTime)}
          control={<div className="settings-status-value">{syncStatus.entityCount} entities</div>}
        />
        {syncStatus.conflictCount > 0 && (
          <SettingsRow
            label="Conflicts"
            description={`${syncStatus.conflictCount} unresolved conflict(s)`}
            control={
              <button
                className="ios-button ios-button-primary"
                onClick={handleShowConflicts}
                style={{ backgroundColor: '#FF6B35' }}
              >
                Resolve
              </button>
            }
          />
        )}
      </div>

      {showConflictDialog && (
        <SyncConflictDialog
          conflicts={conflicts}
          onResolve={handleResolveConflict}
          onResolveAll={handleResolveAllConflicts}
          onClose={() => setShowConflictDialog(false)}
        />
      )}
    </div>
  );
}
