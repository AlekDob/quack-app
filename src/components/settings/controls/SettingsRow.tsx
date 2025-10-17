import type { ReactNode } from 'react';

interface SettingsRowProps {
  label: string;
  description?: string;
  control: ReactNode;
}

export default function SettingsRow({ label, description, control }: SettingsRowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row-left">
        <div className="settings-row-label">{label}</div>
        {description && <div className="settings-row-description">{description}</div>}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}
