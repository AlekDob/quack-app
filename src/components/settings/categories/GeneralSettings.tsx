import { useState, useEffect, useRef } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function GeneralSettings() {
  // PiP and Quack Sound settings
  const [pipEnabled, setPipEnabled] = useState(false);
  const [quackSoundEnabled, setQuackSoundEnabled] = useState(true);

  // Profile
  const userName = useSettingsStore((s) => s.general?.userName ?? '');

  // GIF reactions settings
  const enableToolGifs = useSettingsStore((s) => s.general?.enableToolGifs ?? false);
  const toggleToolGifs = useSettingsStore((s) => s.toggleToolGifs);
  const toolGifCategories = useSettingsStore((s) => s.general?.toolGifCategories);
  const updateGeneralSettings = useSettingsStore((s) => s.updateGeneralSettings);
  const giphyApiKey = useSettingsStore((s) => s.general?.giphyApiKey ?? '');
  const setGiphyApiKey = useSettingsStore((s) => s.setGiphyApiKey);

  // Default categories if not initialized
  const defaultCategories = {
    brain: true,
    fileOps: true,
    shell: true,
    search: false,
    agents: true,
  };

  // Toggle a specific GIF category
  const toggleGifCategory = (category: 'brain' | 'fileOps' | 'shell' | 'search' | 'agents') => {
    const currentCategories = toolGifCategories || defaultCategories;
    updateGeneralSettings({
      toolGifCategories: {
        ...currentCategories,
        [category]: !currentCategories[category],
      },
    });
  };

  // Auto-inject userName into ~/.claude/CLAUDE.md (debounced)
  const injectTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    if (injectTimer.current) clearTimeout(injectTimer.current);
    if (!userName) return;
    injectTimer.current = setTimeout(() => {
      syncUserNameToClaudeMd(userName);
    }, 800);
    return () => { if (injectTimer.current) clearTimeout(injectTimer.current); };
  }, [userName]);

  useEffect(() => {
    loadUiPreferences();
  }, []);

  const loadUiPreferences = async () => {
    try {
      const store = await Store.load('.quack-ui-prefs.dat');
      const pip = await store.get<boolean>('pip-enabled');
      const sound = await store.get<boolean>('quack-sound-enabled');
      if (pip !== null && pip !== undefined) setPipEnabled(pip);
      // Sound defaults to true, only set to false if explicitly saved as false
      setQuackSoundEnabled(sound !== false);
    } catch (err) {
      console.error('Failed to load UI preferences:', err);
    }
  };

  const handleTogglePip = async (enabled: boolean) => {
    setPipEnabled(enabled);
    try {
      const store = await Store.load('.quack-ui-prefs.dat');
      await store.set('pip-enabled', enabled);
      await store.save();
      // Emit event to notify App.tsx
      window.dispatchEvent(new CustomEvent('pip-setting-changed', { detail: { enabled } }));
    } catch (err) {
      console.error('Failed to save PiP preference:', err);
    }
  };

  const handleToggleQuackSound = async (enabled: boolean) => {
    setQuackSoundEnabled(enabled);
    try {
      const store = await Store.load('.quack-ui-prefs.dat');
      await store.set('quack-sound-enabled', enabled);
      await store.save();
      // Emit event to notify App.tsx
      window.dispatchEvent(new CustomEvent('quack-sound-setting-changed', { detail: { enabled } }));
    } catch (err) {
      console.error('Failed to save Quack Sound preference:', err);
    }
  };

  const syncUserNameToClaudeMd = async (name: string) => {
    try {
      const home = await invoke<string>('get_home_directory');
      const claudeMdPath = `${home}/.claude/CLAUDE.md`;
      let content = '';
      try {
        content = await invoke<string>('read_file_content', { path: claudeMdPath });
      } catch {
        // File doesn't exist — create with minimal template
        content = `# CLAUDE.md - Global\n\n**Name**: ${name}\n`;
        await invoke('write_file_content', { path: claudeMdPath, content });
        return;
      }
      // Update or insert the **Name** line
      if (content.match(/^\*\*Name\*\*:\s*.*/m)) {
        content = content.replace(/^\*\*Name\*\*:\s*.*/m, `**Name**: ${name}`);
      } else {
        // Insert after first heading or at top
        const headingEnd = content.match(/^#[^\n]*\n/m);
        if (headingEnd) {
          const idx = (headingEnd.index ?? 0) + headingEnd[0].length;
          content = content.slice(0, idx) + `\n**Name**: ${name}\n` + content.slice(idx);
        } else {
          content = `**Name**: ${name}\n\n` + content;
        }
      }
      await invoke('write_file_content', { path: claudeMdPath, content });
    } catch (err) {
      console.error('Failed to sync userName to CLAUDE.md:', err);
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Profile"
        description="Your identity for diary entries and team collaboration"
      />
      <div className="settings-group">
        <SettingsRow
          label="Display Name"
          description="Used in diary entries and auto-injected into CLAUDE.md global"
          control={
            <input
              type="text"
              value={userName}
              onChange={(e) => updateGeneralSettings({ userName: e.target.value })}
              placeholder="e.g. Alek"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#e0e0e0',
                fontSize: '12px',
                width: '180px',
                outline: 'none',
              }}
            />
          }
        />
      </div>

      <SectionHeader
        title="Chat Experience"
        description="Customize your AI chat experience"
      />
      <div className="settings-group">
        <SettingsRow
          label="GIF Reactions"
          description="Show animated GIF reactions when AI tools execute"
          control={
            <IOSSwitch
              checked={enableToolGifs}
              onChange={() => toggleToolGifs()}
            />
          }
        />

        {/* Giphy API Key input */}
        <SettingsRow
          label="Giphy API Key"
          description="Get a free key at developers.giphy.com. Required for GIF reactions."
          control={
            <input
              type="password"
              value={giphyApiKey}
              onChange={(e) => setGiphyApiKey(e.target.value)}
              placeholder="Enter your Giphy API key"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#e0e0e0',
                fontSize: '12px',
                width: '220px',
                outline: 'none',
              }}
            />
          }
        />

        {/* Category toggles - only show if GIFs are enabled */}
        {enableToolGifs && giphyApiKey && (
          <>
            <div style={{ paddingLeft: '16px', borderLeft: '2px solid rgba(255, 107, 53, 0.3)', marginLeft: '8px' }}>
              <SettingsRow
                label="Brain/Memory Tools"
                description="Show GIFs for brain search and memory operations"
                control={
                  <IOSSwitch
                    checked={toolGifCategories?.brain ?? true}
                    onChange={() => toggleGifCategory('brain')}
                  />
                }
              />
              <SettingsRow
                label="File Operations"
                description="Show GIFs for Read, Write, Edit tools"
                control={
                  <IOSSwitch
                    checked={toolGifCategories?.fileOps ?? true}
                    onChange={() => toggleGifCategory('fileOps')}
                  />
                }
              />
              <SettingsRow
                label="Shell Commands"
                description="Show GIFs for Bash and terminal commands"
                control={
                  <IOSSwitch
                    checked={toolGifCategories?.shell ?? true}
                    onChange={() => toggleGifCategory('shell')}
                  />
                }
              />
              <SettingsRow
                label="Search Tools"
                description="Show GIFs for Grep, Glob, WebSearch"
                control={
                  <IOSSwitch
                    checked={toolGifCategories?.search ?? false}
                    onChange={() => toggleGifCategory('search')}
                  />
                }
              />
              <SettingsRow
                label="AI Agents"
                description="Show GIFs for subagent/Task tools"
                control={
                  <IOSSwitch
                    checked={toolGifCategories?.agents ?? true}
                    onChange={() => toggleGifCategory('agents')}
                  />
                }
              />
            </div>
          </>
        )}
      </div>

      <SectionHeader
        title="Display"
        description="Visual and audio preferences"
      />
      <div className="settings-group">
        <SettingsRow
          label="Picture-in-Picture Mode"
          description="Show floating agent status cards when minimized"
          control={
            <IOSSwitch
              checked={pipEnabled}
              onChange={handleTogglePip}
            />
          }
        />
        <SettingsRow
          label="Quack Sound"
          description="Play a quack sound when agents complete tasks"
          control={
            <IOSSwitch
              checked={quackSoundEnabled}
              onChange={handleToggleQuackSound}
            />
          }
        />
      </div>

    </div>
  );
}
