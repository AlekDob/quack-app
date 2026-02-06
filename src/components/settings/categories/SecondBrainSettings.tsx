import { useState, useEffect } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import {
  getBrainRootPath,
  setBrainCustomPath,
  getCustomBrainPath,
  initBrainStructure,
  openBrainFolder,
} from '../../../services/brainFileService';

export default function SecondBrainSettings() {
  const [brainPath, setBrainPath] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    loadBrainPath();
  }, []);

  const loadBrainPath = async () => {
    try {
      const customPath = getCustomBrainPath();
      setIsCustom(!!customPath);
      const path = await getBrainRootPath();
      setBrainPath(path);
    } catch (err) {
      console.error('Failed to get brain path:', err);
    }
  };

  const handleChangePath = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Brain Location',
      });

      if (selected && typeof selected === 'string') {
        await setBrainCustomPath(selected);
        setBrainPath(selected);
        setIsCustom(true);
        await initBrainStructure();
      }
    } catch (err) {
      console.error('Failed to select brain path:', err);
    }
  };

  const handleResetPath = async () => {
    await setBrainCustomPath(null);
    setIsCustom(false);
    const path = await getBrainRootPath();
    setBrainPath(path);
  };

  const handleOpenBrain = async () => {
    try {
      await openBrainFolder();
    } catch (err) {
      console.error('Failed to open brain folder:', err);
    }
  };

  const handleOpenInObsidian = async () => {
    try {
      await openBrainFolder(true);
    } catch (err) {
      console.error('Failed to open in Obsidian:', err);
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Second Brain"
        description="File-based knowledge storage"
      />
      <div className="settings-group">
        <SettingsRow
          label="Brain Location"
          description={
            brainPath ? (
              <span style={{
                color: isCustom ? '#FF6B35' : '#4CAF50',
                fontFamily: 'monospace',
                fontSize: '12px',
                wordBreak: 'break-all'
              }}>
                {brainPath}
                {isCustom && (
                  <span style={{ color: '#999', marginLeft: '8px' }}>(custom)</span>
                )}
              </span>
            ) : (
              <span style={{ color: '#999' }}>Loading...</span>
            )
          }
          control={
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="ios-button ios-button-secondary"
                onClick={handleChangePath}
              >
                Change
              </button>
              {isCustom && (
                <button
                  className="ios-button ios-button-secondary"
                  onClick={handleResetPath}
                  style={{ fontSize: '11px', opacity: 0.8 }}
                >
                  Reset
                </button>
              )}
            </div>
          }
        />
        <SettingsRow
          label="Open Brain"
          description="Open brain folder in file manager or Obsidian"
          control={
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="ios-button ios-button-secondary"
                onClick={handleOpenBrain}
                disabled={!brainPath}
              >
                Reveal
              </button>
              <button
                className="ios-button ios-button-secondary"
                onClick={handleOpenInObsidian}
                disabled={!brainPath}
              >
                Obsidian
              </button>
            </div>
          }
        />
      </div>

      <SectionHeader
        title="How It Works"
        description="Knowledge is stored as markdown files with YAML frontmatter"
      />
      <div className="settings-group">
        <SettingsRow
          label="Auto-learn"
          description="AI responses are automatically evaluated for knowledge worth saving"
          control={
            <span style={{ color: '#4CAF50', fontSize: '13px' }}>Active</span>
          }
        />
        <SettingsRow
          label="AI Access"
          description="Claude uses the quack-brain skill to read/write knowledge"
          control={
            <span style={{ color: '#4CAF50', fontSize: '13px' }}>Via Skill</span>
          }
        />
      </div>
    </div>
  );
}
