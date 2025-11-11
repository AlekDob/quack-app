import { useState } from 'react';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';

interface BackgroundItem {
  name: string;
  label: string;
  preview?: string;
  gradient?: string;
  type: 'image' | 'gradient';
}

interface BackgroundGroup {
  title: string;
  items: BackgroundItem[];
}

// Import backgrounds using Vite's URL constructor for proper bundling
const duckImage = new URL('../../../../images/backgrounds/duck.png', import.meta.url).href;
const ducksPatternImage = new URL('../../../../images/backgrounds/ducks-pattern.png', import.meta.url).href;
const duckPattern3Image = new URL('../../../../images/backgrounds/duck-pattern3.png', import.meta.url).href;

// Available backgrounds grouped by type
const BACKGROUND_GROUPS: BackgroundGroup[] = [
  {
    title: 'IMAGES',
    items: [
      { name: 'duck.png', label: 'Duck', preview: duckImage, type: 'image' },
      { name: 'ducks-pattern.png', label: 'Ducks Pattern', preview: ducksPatternImage, type: 'image' },
      { name: 'duck-pattern3.png', label: 'Duck Pattern 3', preview: duckPattern3Image, type: 'image' },
    ],
  },
  {
    title: 'GRADIENTS',
    items: [
      {
        name: 'gradient-black-plain',
        label: 'Black Plain',
        gradient: '#000000',
        type: 'gradient',
      },
      {
        name: 'gradient-dark-gray-plain',
        label: 'Dark Gray Plain',
        gradient: '#0D1118',
        type: 'gradient',
      },
      {
        name: 'gradient-orange-dark',
        label: 'Orange Dark',
        gradient: 'linear-gradient(135deg, #1a0f0a 0%, #3d2415 25%, #5a3a25 50%, #3d2415 75%, #1a0f0a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-blue-dark',
        label: 'Blue Dark',
        gradient: 'linear-gradient(135deg, #0a0f1a 0%, #15243d 25%, #20355a 50%, #15243d 75%, #0a0f1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-green-dark',
        label: 'Green Dark',
        gradient: 'linear-gradient(135deg, #0a1a0f 0%, #15392d 25%, #20564a 50%, #15392d 75%, #0a1a0f 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-purple-dark',
        label: 'Purple Dark',
        gradient: 'linear-gradient(135deg, #160a1a 0%, #2d1539 25%, #4a2056 50%, #2d1539 75%, #160a1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-red-dark',
        label: 'Red Dark',
        gradient: 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 25%, #5a2020 50%, #3d1515 75%, #1a0a0a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-teal-dark',
        label: 'Teal Dark',
        gradient: 'linear-gradient(135deg, #0a1a1a 0%, #153d3d 25%, #205a5a 50%, #153d3d 75%, #0a1a1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-amber-dark',
        label: 'Amber Dark',
        gradient: 'linear-gradient(135deg, #1a150a 0%, #3d3015 25%, #5a4a20 50%, #3d3015 75%, #1a150a 100%)',
        type: 'gradient',
      },
    ],
  },
];

interface AppearanceSettingsProps {
  currentBackground?: string;
  onSelectBackground?: (background: string) => void;
}

export default function AppearanceSettings({
  currentBackground = 'gradient-dark-gray-plain',
  onSelectBackground
}: AppearanceSettingsProps) {
  const [loading, setLoading] = useState(false);

  const handleSelectBackground = async (background: string) => {
    if (!onSelectBackground) {
      console.error('onSelectBackground callback not provided');
      return;
    }

    setLoading(true);
    try {
      // Call the parent's handler which will update state and apply background
      onSelectBackground(background);
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
        description="Customize your terminal appearance with images or gradients"
      />

      {BACKGROUND_GROUPS.map((group) => (
        <div key={group.title} className="settings-group">
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
                    style={bg.type === 'gradient' ? { background: bg.gradient } : undefined}
                  >
                    {bg.type === 'image' && (
                      <img
                        src={bg.preview}
                        alt={bg.label}
                        loading="lazy"
                      />
                    )}
                    {isSelected && (
                      <svg className="background-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div className="background-name">{bg.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

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
    </div>
  );
}
