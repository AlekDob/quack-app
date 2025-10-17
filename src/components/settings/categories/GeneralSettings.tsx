import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';

export default function GeneralSettings() {
  const [performanceMonitor, setPerformanceMonitor] = useState(false);
  const [loading, setLoading] = useState(false);

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
