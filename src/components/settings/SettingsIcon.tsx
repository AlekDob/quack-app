import type { SettingsCategory } from './SettingsSidebar';

interface SettingsIconProps {
  category: SettingsCategory;
  className?: string;
}

export default function SettingsIcon({ category, className = '' }: SettingsIconProps) {
  const iconProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (category) {
    case 'general':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6"/>
          <path d="M21 12h-6m-6 0H3"/>
        </svg>
      );

    case 'ai-assistant':
      return (
        <svg {...iconProps}>
          <path d="M12 8V4H8"/>
          <rect x="8" y="4" width="8" height="8" rx="2"/>
          <path d="M12 12v8m4-4H8"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      );

    case 'license':
      return (
        <svg {...iconProps}>
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <line x1="2" y1="10" x2="22" y2="10"/>
          <path d="M6 15h.01M10 15h4"/>
        </svg>
      );

    case 'notifications':
      return (
        <svg {...iconProps}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      );

    case 'appearance':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a7 7 0 0 0 0 20"/>
        </svg>
      );

    case 'terminal':
      return (
        <svg {...iconProps}>
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
      );

    case 'debug':
      return (
        <svg {...iconProps}>
          <path d="m8 2 1.88 1.88"/>
          <path d="M14.12 3.88 16 2"/>
          <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
          <path d="M12 20v-9"/>
          <path d="M6.53 9C4.6 8.8 3 7.1 3 5"/>
          <path d="M6 13H2"/>
          <path d="M3 21c0-2.1 1.7-3.9 3.8-4"/>
          <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/>
          <path d="M22 13h-4"/>
          <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>
        </svg>
      );

    case 'about':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
      );

    default:
      return null;
  }
}
