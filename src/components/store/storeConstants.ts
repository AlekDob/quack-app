import type { MarketplaceCategory } from '../../types';

export type StoreTab = 'all' | 'skills' | 'commands' | 'agents' | 'droids' | 'rules' | 'mcp' | 'hooks';

interface TabConfig {
  value: StoreTab;
  label: string;
  sidebarLabel: string;
}

export const TAB_CONFIG: TabConfig[] = [
  { value: 'all', label: 'All', sidebarLabel: 'Discover' },
  { value: 'skills', label: 'Skills', sidebarLabel: 'Skills' },
  { value: 'commands', label: 'Commands', sidebarLabel: 'Commands' },
  { value: 'agents', label: 'Agents', sidebarLabel: 'Agents' },
  { value: 'droids', label: 'Droids', sidebarLabel: 'Droids' },
  { value: 'rules', label: 'Rules', sidebarLabel: 'Rules' },
  { value: 'mcp', label: 'MCP', sidebarLabel: 'MCP Servers' },
  { value: 'hooks', label: 'Hooks', sidebarLabel: 'Hooks' },
];

export const CATEGORY_MAP: Record<StoreTab, MarketplaceCategory[]> = {
  all: [],
  skills: ['skills'],
  commands: ['commands'],
  agents: ['agents', 'agent-bundles'],
  droids: ['droids'],
  rules: ['rules'],
  mcp: ['mcp'],
  hooks: ['hooks'],
};
