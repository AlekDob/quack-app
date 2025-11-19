import SettingsIcon from './SettingsIcon';

export type SettingsCategory =
  | 'general'
  | 'ai-assistant'
  | 'license'
  | 'notifications'
  | 'appearance'
  | 'terminal'
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
  { id: 'ai-assistant', label: 'AI Assistant' },
  { id: 'license', label: 'License' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'debug', label: '🦆 Debug' },
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
