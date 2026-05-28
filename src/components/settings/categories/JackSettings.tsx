import { useSettingsStore } from '../../../stores/settingsStore';
import { useShortcutsStore } from '../../../stores/shortcutsStore';
import { getModelOptions } from '../../../services/modelService';
import { useModelsConfig } from '../../../hooks/useAppConfig';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';

export default function JackSettings() {
  const jackModel = useSettingsStore((s) => s.claude.jackModel ?? '');
  const globalModel = useSettingsStore((s) => s.claude.model);
  const updateClaudeSettings = useSettingsStore((s) => s.updateClaudeSettings);
  const { models: remoteModels } = useModelsConfig();
  const modelOptions = getModelOptions(remoteModels);
  const formatShortcut = useShortcutsStore((s) => s.formatShortcut);
  const shortcuts = useShortcutsStore((s) => s.shortcuts);
  const jackShortcut = shortcuts.toggleJack;

  const effectiveModel = jackModel || globalModel;

  return (
    <>
      <SectionHeader
        title="Jack — Project Manager"
        description="Finestra supervisor cross-project per orchestrazione agenti"
      />

      <SettingsRow
        label="Modello"
        description="Modello AI per le conversazioni con Jack"
        control={
          <select
            value={effectiveModel}
            onChange={(e) => updateClaudeSettings({ jackModel: e.target.value })}
            className="mode-preset-select"
          >
            {modelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        }
      />

      <SettingsRow
        label="Shortcut"
        description="Scorciatoia per aprire la finestra Jack"
        control={
          <span style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 13,
            opacity: 0.8,
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 4,
          }}>
            {jackShortcut ? formatShortcut(jackShortcut.currentKeys) : '--'}
          </span>
        }
      />

      <SettingsRow
        label="Permessi"
        description="Jack ha accesso completo a tools e file system"
        control={
          <span style={{
            fontSize: 12,
            opacity: 0.6,
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 4,
          }}>
            Bypass
          </span>
        }
      />
    </>
  );
}
