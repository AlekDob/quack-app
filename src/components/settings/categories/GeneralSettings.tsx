import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function GeneralSettings() {
  const [performanceMonitor, setPerformanceMonitor] = useState(false);
  const [loading, setLoading] = useState(false);

  // GIF reactions settings
  const enableToolGifs = useSettingsStore((s) => s.general.enableToolGifs);
  const toggleToolGifs = useSettingsStore((s) => s.toggleToolGifs);
  const toolGifCategories = useSettingsStore((s) => s.general.toolGifCategories);
  const updateGeneralSettings = useSettingsStore((s) => s.updateGeneralSettings);

  // Toggle a specific GIF category
  const toggleGifCategory = (category: 'brain' | 'fileOps' | 'shell' | 'search' | 'agents') => {
    updateGeneralSettings({
      toolGifCategories: {
        ...toolGifCategories,
        [category]: !toolGifCategories[category],
      },
    });
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await invoke<{ show_performance_monitor: boolean }>('get_preferences');
      setPerformanceMonitor(prefs.show_performance_monitor);
    } catch (err) {
      console.error('Failed to load general preferences:', err);
    }
  };

  const handleTogglePerformanceMonitor = async (enabled: boolean) => {
    setLoading(true);
    try {
      await invoke('toggle_performance_monitor');
      setPerformanceMonitor(enabled);
    } catch (err) {
      console.error('Failed to toggle performance monitor:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Performance"
        description="Monitor and optimize app performance"
      />
      <div className="settings-group">
        <SettingsRow
          label="Performance Monitor"
          description="Show real-time performance metrics overlay"
          control={
            <IOSSwitch
              checked={performanceMonitor}
              onChange={handleTogglePerformanceMonitor}
              disabled={loading}
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

        {/* Category toggles - only show if GIFs are enabled */}
        {enableToolGifs && (
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
        title="Application"
        description="General application settings"
      />
      <div className="settings-group">
        <SettingsRow
          label="Launch on Startup"
          description="Automatically start Quack when you log in"
          control={<IOSSwitch checked={false} onChange={() => {}} disabled />}
        />
        <SettingsRow
          label="Auto-save Sessions"
          description="Automatically save terminal sessions and restore them on restart"
          control={<IOSSwitch checked={true} onChange={() => {}} disabled />}
        />
      </div>
    </div>
  );
}
