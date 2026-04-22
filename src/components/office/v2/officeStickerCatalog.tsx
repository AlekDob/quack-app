import type { ReactElement } from 'react';

export interface StickerDef {
  id: string;
  label: string;
  defaultW: number;
  defaultH: number;
  render: () => ReactElement;
}

function Plant() {
  return (
    <g>
      <ellipse cx="0" cy="14" rx="16" ry="5" fill="#3d2a1e" />
      <rect x="-12" y="-2" width="24" height="18" rx="2" fill="#4a3425" />
      <circle cx="-6" cy="-6" r="10" fill="#16a34a" />
      <circle cx="6" cy="-8" r="9" fill="#22c55e" />
      <circle cx="0" cy="-14" r="8" fill="#15803d" />
    </g>
  );
}

function Desk() {
  return (
    <g>
      <rect x="-28" y="-18" width="56" height="36" rx="3" fill="#6b4b2e" stroke="#3d2a1e" strokeWidth="1.5" />
      <rect x="-18" y="-12" width="36" height="18" rx="2" fill="#1a1a2e" stroke="#2a2a4a" strokeWidth="1" />
      <rect x="-8" y="8" width="16" height="6" rx="1" fill="#2a2a4a" />
    </g>
  );
}

function Chair() {
  return (
    <g>
      <rect x="-10" y="-10" width="20" height="20" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
      <rect x="-12" y="-14" width="24" height="6" rx="2" fill="#334155" />
      <circle cx="0" cy="0" r="3" fill="#64748b" />
    </g>
  );
}

function Sofa() {
  return (
    <g>
      <rect x="-32" y="-12" width="64" height="24" rx="4" fill="#6b7c9a" stroke="#475569" strokeWidth="1.5" />
      <rect x="-32" y="-14" width="14" height="28" rx="3" fill="#475569" />
      <rect x="18" y="-14" width="14" height="28" rx="3" fill="#475569" />
      <rect x="-18" y="-10" width="36" height="18" rx="3" fill="#94a3b8" />
    </g>
  );
}

function Bookshelf() {
  return (
    <g>
      <rect x="-16" y="-22" width="32" height="44" rx="2" fill="#4a3425" stroke="#2a1f1a" strokeWidth="1.5" />
      <line x1="-16" y1="-11" x2="16" y2="-11" stroke="#2a1f1a" strokeWidth="1" />
      <line x1="-16" y1="0" x2="16" y2="0" stroke="#2a1f1a" strokeWidth="1" />
      <line x1="-16" y1="11" x2="16" y2="11" stroke="#2a1f1a" strokeWidth="1" />
      <rect x="-13" y="-20" width="4" height="8" fill="#dc2626" />
      <rect x="-8" y="-20" width="4" height="8" fill="#2563eb" />
      <rect x="-3" y="-20" width="4" height="8" fill="#16a34a" />
      <rect x="-13" y="-9" width="4" height="8" fill="#f59e0b" />
      <rect x="-8" y="-9" width="4" height="8" fill="#7c3aed" />
      <rect x="-13" y="2" width="4" height="8" fill="#ec4899" />
      <rect x="-8" y="2" width="4" height="8" fill="#0891b2" />
    </g>
  );
}

function CoffeeMachine() {
  return (
    <g>
      <rect x="-12" y="-18" width="24" height="36" rx="3" fill="#1a1a2e" stroke="#0a0a18" strokeWidth="1.5" />
      <rect x="-9" y="-14" width="18" height="6" rx="1" fill="#0a0a18" />
      <circle cx="0" cy="-11" r="1.5" fill="#22c55e" />
      <rect x="-7" y="-4" width="14" height="10" rx="1" fill="#3a3a5a" />
      <rect x="-4" y="8" width="8" height="6" fill="#5a3d1f" />
      <rect x="-5" y="14" width="10" height="2" fill="#1a1a2e" />
    </g>
  );
}

function WaterCooler() {
  return (
    <g>
      <ellipse cx="0" cy="-16" rx="10" ry="4" fill="#60a5fa" opacity="0.6" />
      <rect x="-10" y="-16" width="20" height="14" fill="#93c5fd" opacity="0.8" />
      <rect x="-12" y="-2" width="24" height="20" rx="2" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="-4" y="4" width="8" height="4" rx="1" fill="#3b82f6" />
      <circle cx="0" cy="12" r="1.5" fill="#3b82f6" />
    </g>
  );
}

function Rug() {
  return (
    <g>
      <rect x="-30" y="-20" width="60" height="40" rx="2" fill="#7f1d1d" />
      <rect x="-28" y="-18" width="56" height="36" rx="1" fill="#dc2626" opacity="0.6" />
      <rect x="-26" y="-16" width="52" height="32" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.8" />
      <circle cx="0" cy="0" r="6" fill="#fbbf24" opacity="0.8" />
    </g>
  );
}

function Printer() {
  return (
    <g>
      <rect x="-16" y="-10" width="32" height="18" rx="2" fill="#334155" stroke="#0f172a" strokeWidth="1.5" />
      <rect x="-13" y="-7" width="26" height="4" rx="1" fill="#0f172a" />
      <rect x="-10" y="0" width="20" height="2" fill="#64748b" />
      <rect x="-12" y="8" width="24" height="6" rx="1" fill="#e5e7eb" />
      <circle cx="12" cy="-4" r="1" fill="#22c55e" />
    </g>
  );
}

function Window() {
  return (
    <g>
      <rect x="-24" y="-16" width="48" height="32" rx="1" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <rect x="-22" y="-14" width="44" height="28" fill="#1e3a8a" opacity="0.7" />
      <line x1="0" y1="-16" x2="0" y2="16" stroke="#334155" strokeWidth="2" />
      <line x1="-24" y1="0" x2="24" y2="0" stroke="#334155" strokeWidth="2" />
      <circle cx="-10" cy="-6" r="2" fill="#fde68a" opacity="0.6" />
    </g>
  );
}

export const STICKER_CATALOG: StickerDef[] = [
  { id: 'plant', label: 'Plant', defaultW: 40, defaultH: 40, render: Plant },
  { id: 'desk', label: 'Desk', defaultW: 72, defaultH: 48, render: Desk },
  { id: 'chair', label: 'Chair', defaultW: 32, defaultH: 32, render: Chair },
  { id: 'sofa', label: 'Sofa', defaultW: 80, defaultH: 40, render: Sofa },
  { id: 'bookshelf', label: 'Bookshelf', defaultW: 40, defaultH: 56, render: Bookshelf },
  { id: 'coffee-machine', label: 'Coffee', defaultW: 32, defaultH: 48, render: CoffeeMachine },
  { id: 'water-cooler', label: 'Water', defaultW: 32, defaultH: 48, render: WaterCooler },
  { id: 'rug', label: 'Rug', defaultW: 72, defaultH: 52, render: Rug },
  { id: 'printer', label: 'Printer', defaultW: 40, defaultH: 32, render: Printer },
  { id: 'window', label: 'Window', defaultW: 56, defaultH: 40, render: Window },
];

export function getStickerDef(kind: string): StickerDef | undefined {
  return STICKER_CATALOG.find(s => s.id === kind);
}
