import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';

export default function TerminalSettings() {
  return (
    <div className="settings-category">
      <SectionHeader
        title="Default Shell"
        description="Configure your default terminal shell"
      />
      <div className="settings-group">
        <SettingsRow
          label="Shell"
          description="The shell to use when creating new terminals"
          control={
            <select className="ios-select" disabled>
              <option>System Default (zsh)</option>
            </select>
          }
        />
      </div>

      <SectionHeader
        title="Font Settings"
        description="Customize terminal font appearance"
      />
      <div className="settings-group">
        <SettingsRow
          label="Font Family"
          description="Choose your preferred monospace font"
          control={
            <select className="ios-select" disabled>
              <option>Menlo</option>
            </select>
          }
        />
        <SettingsRow
          label="Font Size"
          description="Adjust the terminal font size"
          control={
            <select className="ios-select" disabled>
              <option>14px</option>
            </select>
          }
        />
      </div>

      <SectionHeader
        title="Behavior"
        description="Terminal behavior settings"
      />
      <div className="settings-group">
        <SettingsRow
          label="Auto Scroll"
          description="Automatically scroll to bottom on new output"
          control={<IOSSwitch checked={true} onChange={() => {}} disabled />}
        />
        <SettingsRow
          label="Cursor Blink"
          description="Enable cursor blinking animation"
          control={<IOSSwitch checked={true} onChange={() => {}} disabled />}
        />
        <SettingsRow
          label="Copy on Select"
          description="Automatically copy selected text to clipboard"
          control={<IOSSwitch checked={false} onChange={() => {}} disabled />}
        />
      </div>

      <div className="settings-info-box">
        <span className="info-icon">ℹ️</span>
        <span>Additional terminal settings coming in future updates</span>
      </div>
    </div>
  );
}
