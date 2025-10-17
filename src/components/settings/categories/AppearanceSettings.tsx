import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';

export default function AppearanceSettings() {
  const [currentBackground, setCurrentBackground] = useState('duck.png');
  const [availableBackgrounds, setAvailableBackgrounds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBackgroundSettings();
  }, []);

  const loadBackgroundSettings = async () => {
    try {
      const bg = await invoke<string>('get_background_image');
      setCurrentBackground(bg);

      const backgrounds = await invoke<string[]>('list_available_backgrounds');
      setAvailableBackgrounds(backgrounds);
    } catch (err) {
      console.error('Failed to load background settings:', err);
    }
  };

  const handleSelectBackground = async (background: string) => {
    setLoading(true);
    try {
      await invoke('set_background_image', { background });
      setCurrentBackground(background);
    } catch (err) {
      console.error('Failed to set background:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Terminal Background"
        description="Customize your terminal appearance"
      />
      <div className="settings-group">
        <div className="background-grid">
          {availableBackgrounds.map((bg) => (
            <button
              key={bg}
              type="button"
              className={`background-option ${currentBackground === bg ? 'active' : ''} ${loading ? 'disabled' : ''}`}
              onClick={() => handleSelectBackground(bg)}
              disabled={loading}
            >
              <div className="background-preview" style={{ backgroundImage: `url(/backgrounds/${bg})` }}>
                {currentBackground === bg && (
                  <svg className="background-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div className="background-name">{bg.replace(/\.[^/.]+$/, '')}</div>
            </button>
          ))}
        </div>
      </div>

      <SectionHeader
        title="Theme"
        description="Choose your preferred color theme"
      />
      <div className="settings-group">
        <SettingsRow
          label="Color Theme"
          description="Currently only Dark theme is available"
          control={
            <select className="ios-select" disabled>
              <option>Dark</option>
            </select>
          }
        />
      </div>

      <SectionHeader
        title="Animations"
        description="Control interface animations"
      />
      <div className="settings-group">
        <div className="settings-info-box">
          <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
          <span>Animation settings coming soon</span>
        </div>
      </div>
    </div>
  );
}
