import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import { useSettingsStore } from '../../../stores/settingsStore';
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '../../../utils/accentColor';

// Import background images using Vite's URL constructor
const ducksPatternImage = new URL('../../../../images/backgrounds/ducks-pattern.png', import.meta.url).href;
const duckPattern3Image = new URL('../../../../images/backgrounds/duck-pattern3.png', import.meta.url).href;
const hackerImage = new URL('../../../../images/backgrounds/hacker.png', import.meta.url).href;
const duckBusinessImage = new URL('../../../../images/backgrounds/duckbusiness.png', import.meta.url).href;
const duckMotoImage = new URL('../../../../images/backgrounds/duckmoto.png', import.meta.url).href;
const duckPoolImage = new URL('../../../../images/backgrounds/duckpool.png', import.meta.url).href;
const duckReadImage = new URL('../../../../images/backgrounds/duckread.png', import.meta.url).href;
const gtaDuckImage = new URL('../../../../images/backgrounds/gtaduck.png', import.meta.url).href;
const jazzDuckImage = new URL('../../../../images/backgrounds/jazzduck.png', import.meta.url).href;
const cyberpunkDuckImage = new URL('../../../../images/backgrounds/e00b8faae79c45741ad8ff0060614a1ddd03bcea.png', import.meta.url).href;

interface BackgroundItem {
  name: string;
  label: string;
  preview?: string;
  gradient?: string;
  type: 'transparent' | 'image' | 'gradient';
}

interface BackgroundGroup {
  title: string;
  items: BackgroundItem[];
}

// Available backgrounds grouped by type
const BACKGROUND_GROUPS: BackgroundGroup[] = [
  {
    title: 'Special',
    items: [
      { name: 'transparent', label: 'Transparent', type: 'transparent' },
    ],
  },
  {
    title: 'Images',
    items: [
      { name: 'hacker.png', label: 'Hacker', preview: hackerImage, type: 'image' },
      { name: 'duckbusiness.png', label: 'Business Duck', preview: duckBusinessImage, type: 'image' },
      { name: 'duckmoto.png', label: 'Moto Duck', preview: duckMotoImage, type: 'image' },
      { name: 'duckpool.png', label: 'Pool Duck', preview: duckPoolImage, type: 'image' },
      { name: 'duckread.png', label: 'Reading Duck', preview: duckReadImage, type: 'image' },
      { name: 'gtaduck.png', label: 'GTA Duck', preview: gtaDuckImage, type: 'image' },
      { name: 'jazzduck.png', label: 'Jazz Duck', preview: jazzDuckImage, type: 'image' },
      { name: 'e00b8faae79c45741ad8ff0060614a1ddd03bcea.png', label: 'Cyberpunk Duck', preview: cyberpunkDuckImage, type: 'image' },
      { name: 'ducks-pattern.png', label: 'Ducks Pattern', preview: ducksPatternImage, type: 'image' },
      { name: 'duck-pattern3.png', label: 'Duck Pattern', preview: duckPattern3Image, type: 'image' },
    ],
  },
  {
    title: 'Solid Colors',
    items: [
      {
        name: 'gradient-black-plain',
        label: 'Black',
        gradient: '#000000',
        type: 'gradient',
      },
      {
        name: 'gradient-dark-gray-plain',
        label: 'Dark Gray',
        gradient: '#0D1118',
        type: 'gradient',
      },
      {
        name: 'gradient-midnight',
        label: 'Midnight',
        gradient: '#0f1115',
        type: 'gradient',
      },
    ],
  },
  {
    title: 'Gradients',
    items: [
      {
        name: 'gradient-orange-dark',
        label: 'Ember',
        gradient: 'linear-gradient(135deg, #1a0f0a 0%, #3d2415 50%, #1a0f0a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-blue-dark',
        label: 'Ocean',
        gradient: 'linear-gradient(135deg, #0a0f1a 0%, #15243d 50%, #0a0f1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-green-dark',
        label: 'Forest',
        gradient: 'linear-gradient(135deg, #0a1a0f 0%, #15392d 50%, #0a1a0f 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-purple-dark',
        label: 'Aurora',
        gradient: 'linear-gradient(135deg, #160a1a 0%, #2d1539 50%, #160a1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-red-dark',
        label: 'Crimson',
        gradient: 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 50%, #1a0a0a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-teal-dark',
        label: 'Teal',
        gradient: 'linear-gradient(135deg, #0a1a1a 0%, #153d3d 50%, #0a1a1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-amber-dark',
        label: 'Sunset',
        gradient: 'linear-gradient(135deg, #1a150a 0%, #3d3015 50%, #1a150a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-neon',
        label: 'Neon',
        gradient: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2d 25%, #2d0a3d 50%, #1a0a2d 75%, #0a0a1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-cosmic',
        label: 'Cosmic',
        gradient: 'linear-gradient(180deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
        type: 'gradient',
      },
    ],
  },
];

export default function AppearanceSettings() {
  const [currentBackground, setCurrentBackground] = useState<string>('transparent');
  const [loading, setLoading] = useState(false);
  const accentColor = useSettingsStore((s) => s.appearance.accentColor);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const resetAccentColor = useSettingsStore((s) => s.resetAccentColor);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Load current background on mount
  useEffect(() => {
    async function loadBackground() {
      try {
        const bg = await invoke<string>('get_background_image');
        setCurrentBackground(bg || 'transparent');
      } catch (err) {
        console.error('Failed to load background:', err);
      }
    }
    loadBackground();
  }, []);

  // Handle background selection
  const handleSelectBackground = async (name: string) => {
    setLoading(true);
    try {
      await invoke('set_background_image', { image: name });
      setCurrentBackground(name);

      // Apply background to body immediately
      applyBackground(name);
    } catch (err) {
      console.error('Failed to set background:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply background to body element
  const applyBackground = (name: string) => {
    const body = document.body;

    if (name === 'transparent') {
      body.style.backgroundImage = 'none';
      body.style.backgroundColor = 'transparent';
      return;
    }

    // Find the background item
    const allItems = BACKGROUND_GROUPS.flatMap(g => g.items);
    const item = allItems.find(i => i.name === name);

    if (!item) return;

    if (item.type === 'image') {
      // Use the preview URL for images
      body.style.backgroundImage = `url(${item.preview})`;
      body.style.backgroundColor = 'transparent';
    } else if (item.type === 'gradient') {
      if (item.gradient?.startsWith('linear-gradient') || item.gradient?.startsWith('radial-gradient')) {
        body.style.backgroundImage = item.gradient;
      } else {
        body.style.backgroundImage = 'none';
        body.style.backgroundColor = item.gradient || '#000';
      }
    }
  };

  // Render checkmark icon
  const CheckIcon = () => (
    <svg className="background-check" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );

  const isCustomColor = !ACCENT_PRESETS.some(p => p.hex === accentColor);

  return (
    <div className="settings-category">
      <SectionHeader
        title="Accent Color"
        description="Primary color used across the entire interface"
      />
      <div className="settings-group">
        <div className="accent-color-grid">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              className={`accent-color-swatch ${accentColor === preset.hex ? 'active' : ''}`}
              onClick={() => setAccentColor(preset.hex)}
              title={preset.label}
            >
              <div
                className="accent-swatch-circle"
                style={{ background: preset.hex }}
              />
              {accentColor === preset.hex && <CheckIcon />}
              <span className="accent-swatch-label">{preset.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`accent-color-swatch ${isCustomColor ? 'active' : ''}`}
            onClick={() => colorInputRef.current?.click()}
            title="Custom color"
          >
            <div
              className="accent-swatch-circle accent-swatch-custom"
              style={isCustomColor ? { background: accentColor } : undefined}
            >
              {!isCustomColor && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </div>
            {isCustomColor && <CheckIcon />}
            <span className="accent-swatch-label">Custom</span>
            <input
              ref={colorInputRef}
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="accent-color-input-hidden"
            />
          </button>
        </div>
        {accentColor !== DEFAULT_ACCENT && (
          <button
            type="button"
            className="accent-reset-btn"
            onClick={resetAccentColor}
          >
            Reset to default
          </button>
        )}
      </div>

      <SectionHeader
        title="Background"
        description="Choose your preferred app background"
      />
      <div className="settings-group">
        {BACKGROUND_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="background-group-title">{group.title}</div>
            <div className="background-grid">
              {group.items.map((bg) => {
                const isSelected = bg.name === currentBackground;

                return (
                  <button
                    key={bg.name}
                    type="button"
                    className={`background-option ${isSelected ? 'active' : ''} ${loading ? 'disabled' : ''}`}
                    onClick={() => handleSelectBackground(bg.name)}
                    disabled={loading}
                  >
                    <div
                      className="background-preview"
                      style={
                        bg.type === 'transparent'
                          ? {
                              background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px',
                            }
                          : bg.type === 'gradient'
                          ? { background: bg.gradient }
                          : undefined
                      }
                    >
                      {bg.type === 'image' && bg.preview && (
                        <img
                          src={bg.preview}
                          alt={bg.label}
                          loading="lazy"
                        />
                      )}
                      {isSelected && <CheckIcon />}
                    </div>
                    <div className="background-name">{bg.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
