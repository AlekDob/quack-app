import SettingsIcon from './SettingsIcon';

export type SettingsCategory =
  | 'general'
  | 'claude-code'
  | 'ai-assistant'
  | 'agent-modes'
  | 'second-brain'
  | 'ide'
  | 'license'
  | 'notifications'
  | 'appearance'
  | 'keyboard-shortcuts'
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
  { id: 'ai-assistant', label: 'AI Assistant' },
  { id: 'agent-modes', label: 'Agent Modes' },
  { id: 'second-brain', label: 'Second Brain' },
  { id: 'ide', label: 'External IDE' },
  { id: 'license', label: 'License' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'keyboard-shortcuts', label: 'Keyboard' },
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
