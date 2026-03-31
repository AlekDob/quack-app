import SectionHeader from '../controls/SectionHeader';
import './TypographySettings.css';
import { useSettingsStore } from '../../../stores/settingsStore';
import {
  FONT_SIZE_PRESETS,
  PRESET_LABELS,
  UI_FONT_OPTIONS,
  MONO_FONT_OPTIONS,
} from '../../../constants/typography';
import type { FontSizePreset } from '../../../constants/typography';

const PRESETS: FontSizePreset[] = ['S', 'M', 'L', 'XL'];

function PresetCard({ preset, active, onSelect }: {
  preset: FontSizePreset;
  active: boolean;
  onSelect: () => void;
}) {
  const sizes = FONT_SIZE_PRESETS[preset];
  return (
    <button
      type="button"
      className={`typo-preset-card ${active ? 'active' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className="typo-preset-letter">{preset}</span>
      <span className="typo-preset-label">{PRESET_LABELS[preset]}</span>
      <span className="typo-preset-size">{sizes.body}px</span>
      {active && <CheckIcon />}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg className="typo-check" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function PreviewBlock({ preset, fontUI, fontMono }: {
  preset: FontSizePreset;
  fontUI: string;
  fontMono: string;
}) {
  const sizes = FONT_SIZE_PRESETS[preset];
  return (
    <div className="typo-preview-wrapper">
      <div className="typo-preview-label">Preview</div>
      <div className="typo-preview-box">
        <p className="typo-preview-body" style={{ fontFamily: fontUI, fontSize: `${sizes.body}px` }}>
          The quick brown fox jumps over the lazy duck. 🦆
        </p>
        <p className="typo-preview-heading" style={{ fontFamily: fontUI, fontSize: `${sizes.h1}px` }}>
          Heading Example
        </p>
        <code className="typo-preview-code" style={{ fontFamily: fontMono, fontSize: `${sizes.code}px` }}>
          const quack = &quot;hello world&quot;;
        </code>
        <p className="typo-preview-meta" style={{ fontFamily: fontUI, fontSize: `${sizes.small}px` }}>
          Meta text · {sizes.body}px body · {sizes.code}px code
        </p>
      </div>
    </div>
  );
}

export default function TypographySettings() {
  const typography = useSettingsStore((s) => s.typography);
  const setPreset = useSettingsStore((s) => s.setFontSizePreset);
  const updateTypo = useSettingsStore((s) => s.updateTypography);
  const resetTypo = useSettingsStore((s) => s.resetTypography);

  return (
    <div className="settings-category">
      <SectionHeader
        title="Typography"
        description="Customize fonts and text size"
      />

      {/* Size Presets */}
      <div className="settings-group">
        <div className="typo-section-label">Text Size</div>
        <div className="typo-preset-grid">
          {PRESETS.map((p) => (
            <PresetCard
              key={p}
              preset={p}
              active={typography.fontSizePreset === p}
              onSelect={() => setPreset(p)}
            />
          ))}
        </div>
      </div>

      {/* Font Families */}
      <div className="settings-group">
        <div className="typo-font-rows">
          <div className="typo-font-row">
            <div className="typo-font-row-left">
              <div className="typo-font-row-label">UI Font</div>
              <div className="typo-font-row-desc">Text, headings and app interface</div>
            </div>
            <select
              id="typo-font-ui"
              className="typo-font-select"
              value={typography.fontFamilyUI}
              onChange={(e) => updateTypo({ fontFamilyUI: e.target.value })}
            >
              {UI_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="typo-font-row">
            <div className="typo-font-row-left">
              <div className="typo-font-row-label">Code Font</div>
              <div className="typo-font-row-desc">Code blocks, terminal and monospace</div>
            </div>
            <select
              id="typo-font-mono"
              className="typo-font-select"
              value={typography.fontFamilyMono}
              onChange={(e) => updateTypo({ fontFamilyMono: e.target.value })}
            >
              {MONO_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="settings-group">
        <PreviewBlock
          preset={typography.fontSizePreset}
          fontUI={typography.fontFamilyUI}
          fontMono={typography.fontFamilyMono}
        />
      </div>

      {/* Reset */}
      <div className="settings-group">
        <div className="typo-reset-row">
          <button type="button" className="typo-reset-btn" onClick={resetTypo}>
            ⟲ Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
