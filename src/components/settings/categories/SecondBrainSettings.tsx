import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import type { BrainSettings, SyncStatus } from '../../../types/brainSync';

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

  useEffect(() => {
    loadSettings();
    loadSyncStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await invoke<BrainSettings>('brain_get_settings');
      setSettings(result);
    } catch (err) {
      console.error('Failed to load brain settings:', err);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const result = await invoke<SyncStatus>('brain_get_sync_status');
      setSyncStatus(result);
    } catch (err) {
      console.error('Failed to load sync status:', err);
    }
  };

  const updateSetting = async <K extends keyof BrainSettings>(
    key: K,
    value: BrainSettings[K]
  ) => {
    setLoading(true);
    try {
      await invoke('brain_set_setting', { key, value });
      setSettings((prev) => ({ ...prev, [key]: value }));
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
    try {
      await invoke('brain_sync_to_vault');
      await loadSyncStatus();
    } catch (err) {
      console.error('Failed to sync to vault:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleImportFromVault = async () => {
    setSyncing(true);
    try {
      await invoke('brain_import_from_vault');
      await loadSyncStatus();
    } catch (err) {
      console.error('Failed to import from vault:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateEmbeddings = async () => {
    setLoading(true);
    try {
      await invoke('brain_generate_all_embeddings');
      await loadSyncStatus();
    } catch (err) {
      console.error('Failed to generate embeddings:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Vault Configuration"
        description="Configure your Obsidian vault integration"
      />
      <div className="settings-group">
        <SettingsRow
          label="Vault Path"
          description={settings.vaultPath || 'No vault selected'}
          control={
            <button
              className="ios-button ios-button-secondary"
              onClick={handleSelectVaultPath}
              disabled={loading}
            >
              Choose Folder
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
            syncStatus.isGeneratingEmbeddings
              ? `Generating... ${syncStatus.embeddingProgress}%`
              : 'Generate embeddings for all existing entities'
          }
          control={
            <button
              className="ios-button ios-button-primary"
              onClick={handleGenerateEmbeddings}
              disabled={loading || syncStatus.isGeneratingEmbeddings}
            >
              {syncStatus.isGeneratingEmbeddings ? 'Generating...' : 'Generate'}
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
              <div className="settings-status-value settings-status-warning">
                Resolve
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
