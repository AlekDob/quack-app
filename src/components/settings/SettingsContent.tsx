import type { ReactNode } from 'react';

interface SettingsContentProps {
  children: ReactNode;
}

export default function SettingsContent({ children }: SettingsContentProps) {
  return (
    <div className="settings-content">
      <div className="settings-content-inner">{children}</div>
    </div>
  );
}
