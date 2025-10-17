/**
 * Agent Avatar Utilities
 *
 * Simplified: All agents use the same cyberduck avatar.
 */

import { convertFileSrc } from '@tauri-apps/api/core';

// Type augmentation for Tauri
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

// Helper to resolve asset path (works in both dev and production)
function resolveAssetPath(path: string): string {
  // In Tauri production, resources are in the bundle
  // In dev mode, we use the direct path
  if (window.__TAURI__) {
    // Tauri expects paths relative to the resource directory
    return convertFileSrc(path);
  }
  // Dev mode - serve from public
  return `/${path}`;
}

// Universal cyberduck avatar for all agents
const CYBERDUCK_AVATAR = resolveAssetPath('images/cyberduck.png');

/**
 * Get the avatar image path for an agent
 * @param _agentName - The full agent name (unused, kept for API compatibility)
 * @returns Avatar image path (always cyberduck.png)
 */
export function getAgentAvatar(_agentName: string): string | null {
  // Always return cyberduck avatar for all agents
  return CYBERDUCK_AVATAR;
}

/**
 * Check if an agent has a custom avatar
 * @returns Always true since all agents have the cyberduck avatar
 */
export function hasAgentAvatar(_agentName: string): boolean {
  return true;
}

/**
 * Get all available duck avatars
 * @returns Single cyberduck avatar
 */
export function getAvailableAvatars(): Record<string, string> {
  return { cyberduck: CYBERDUCK_AVATAR };
}
