import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';

export default function AppearanceSettings() {

  return (
    <div className="settings-category">
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
