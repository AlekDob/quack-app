import { useState } from 'react';
import SettingsSidebar from './SettingsSidebar';
import type { SettingsCategory } from './SettingsSidebar';
import SettingsContent from './SettingsContent';
import GeneralSettings from './categories/GeneralSettings';
import ClaudeCodeSettings from './categories/ClaudeCodeSettings';
import AIAssistantSettings from './categories/AIAssistantSettings';
import AgentModesSettings from './categories/AgentModesSettings';
import SecondBrainSettings from './categories/SecondBrainSettings';
import IDESettings from './categories/IDESettings';
import TerminalSettings from './categories/TerminalSettings';
import LicenseSettings from './categories/LicenseSettings';
import NotificationSettings from './categories/NotificationSettings';
import RemoteApiSettings from './categories/RemoteApiSettings';
import AppearanceSettings from './categories/AppearanceSettings';
import TypographySettings from './categories/TypographySettings';
import KeyboardShortcutsSettings from './categories/KeyboardShortcutsSettings';
import DebugSettings from './categories/DebugSettings';
import AboutSettings from './categories/AboutSettings';
import './UnifiedSettings.css';

interface UnifiedSettingsProps {
  onClose: () => void;
  initialCategory?: SettingsCategory;
  currentBackground?: string;
  onSelectBackground?: (background: string) => void;
  onOpenTelegramSetup?: () => void;
}

export default function UnifiedSettings({
  onClose,
  initialCategory = 'general',
  currentBackground,
  onSelectBackground,
  onOpenTelegramSetup,
}: UnifiedSettingsProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory);
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      onClose();
    }, 250); // Match animation duration
  };

  const renderCategory = () => {
    switch (activeCategory) {
      case 'general':
        return <GeneralSettings />;
      case 'claude-code':
        return <ClaudeCodeSettings />;
      case 'ai-assistant':
        return <AIAssistantSettings />;
      case 'agent-modes':
        return <AgentModesSettings />;
      case 'second-brain':
        return <SecondBrainSettings />;
      case 'ide':
        return <IDESettings />;
      case 'terminal':
        return <TerminalSettings />;
      case 'license':
        return <LicenseSettings />;
      case 'notifications':
        return <NotificationSettings onOpenTelegramSetup={onOpenTelegramSetup} />;
      case 'remote-api':
        return <RemoteApiSettings />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'typography':
        return <TypographySettings />;
      case 'keyboard-shortcuts':
        return <KeyboardShortcutsSettings />;
      case 'debug':
        return <DebugSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className={`unified-settings-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className="unified-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="unified-settings-header">
          <h2>Settings</h2>
          <button className="unified-settings-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="unified-settings-body">
          <SettingsSidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
          <SettingsContent>{renderCategory()}</SettingsContent>
        </div>
      </div>
    </div>
  );
}
