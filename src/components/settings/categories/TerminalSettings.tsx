import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';

interface ShellInfo {
  path: string;
  name: string;
}

export default function TerminalSettings() {
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [selectedShell, setSelectedShell] = useState<string>('');

  useEffect(() => {
    // Load available shells and current preference
    Promise.all([
      invoke<ShellInfo[]>('list_available_shells'),
      invoke<string | null>('get_default_shell'),
    ]).then(([availableShells, currentShell]) => {
      setShells(availableShells);
      setSelectedShell(currentShell || '');
    }).catch(console.error);
  }, []);

  const handleShellChange = async (path: string) => {
    const previous = selectedShell;
    setSelectedShell(path);
    try {
      await invoke('set_default_shell', { shell: path });
    } catch (err) {
      console.error('Failed to set default shell:', err);
      setSelectedShell(previous);
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Default Shell"
        description="Configure your default terminal shell"
      />
      <div className="settings-group">
        <SettingsRow
          label="Shell"
          description="The shell to use when creating new terminals"
          control={
            <select
              className="ios-select"
              value={selectedShell}
              onChange={(e) => handleShellChange(e.target.value)}
            >
              <option value="">System Default</option>
              {shells.map((shell) => (
                <option key={shell.path} value={shell.path}>
                  {shell.name} ({shell.path})
                </option>
              ))}
            </select>
          }
        />
      </div>

      <SectionHeader
        title="Font Settings"
        description="Customize terminal font appearance"
      />
      <div className="settings-group">
        <SettingsRow
          label="Font Family"
          description="Choose your preferred monospace font"
          control={
            <select className="ios-select" disabled>
              <option>Menlo</option>
            </select>
          }
        />
        <SettingsRow
          label="Font Size"
          description="Adjust the terminal font size"
          control={
            <select className="ios-select" disabled>
              <option>14px</option>
            </select>
          }
        />
      </div>

      <SectionHeader
        title="Behavior"
        description="Terminal behavior settings"
      />
      <div className="settings-group">
        <SettingsRow
          label="Auto Scroll"
          description="Automatically scroll to bottom on new output"
          control={<IOSSwitch checked={true} onChange={() => {}} disabled />}
        />
        <SettingsRow
          label="Cursor Blink"
          description="Enable cursor blinking animation"
          control={<IOSSwitch checked={true} onChange={() => {}} disabled />}
        />
        <SettingsRow
          label="Copy on Select"
          description="Automatically copy selected text to clipboard"
          control={<IOSSwitch checked={false} onChange={() => {}} disabled />}
        />
      </div>

      <div className="settings-info-box">
        <span className="info-icon">i</span>
        <span>Font and behavior settings coming in future updates</span>
      </div>
    </div>
  );
}
