import SettingsIcon from './SettingsIcon';

export type SettingsCategory =
  | 'general'
  | 'claude-code'
  | 'codex'
  | 'ai-assistant'
  | 'agent-modes'
  | 'second-brain'
  | 'ide'
  | 'terminal'
  | 'license'
  | 'notifications'
  | 'remote-api'
  | 'appearance'
  | 'typography'
  | 'keyboard-shortcuts'
  | 'token-usage'
  | 'debug'
  | 'about';

interface CategoryItem {
  id: SettingsCategory;
  label: string;
}

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onSelectCategory: (category: SettingsCategory) => void;
}

const categories: CategoryItem[] = [
  { id: 'general', label: 'General' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'ai-assistant', label: 'AI Assistant' },
  { id: 'agent-modes', label: 'Agent Modes' },
  { id: 'second-brain', label: 'Second Brain' },
  { id: 'ide', label: 'External IDE' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'license', label: 'License' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'remote-api', label: 'Remote API' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'typography', label: 'Typography' },
  { id: 'keyboard-shortcuts', label: 'Keyboard' },
  { id: 'token-usage', label: 'Token Usage' },
  { id: 'debug', label: 'Debug' },
  { id: 'about', label: 'About' },
];

export default function SettingsSidebar({ activeCategory, onSelectCategory }: SettingsSidebarProps) {
  return (
    <nav className="settings-sidebar">
      <div className="settings-sidebar-list">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`settings-sidebar-item ${activeCategory === category.id ? 'active' : ''}`}
            onClick={() => onSelectCategory(category.id)}
          >
            <SettingsIcon category={category.id} className="settings-sidebar-icon" />
            <span className="settings-sidebar-label">{category.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
