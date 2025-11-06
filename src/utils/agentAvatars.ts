/**
 * Agent Avatar Utilities
 *
 * Manages duck avatars for agents with proper dev/production path resolution.
 * Supports both default avatars and custom uploaded avatars.
 */

import { getCustomAvatarUrl, isCustomAvatar } from './customAvatarStorage';

// Type augmentation for Tauri
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

// Available duck avatars from /images/ducks/avatars/
export const AVAILABLE_AVATARS = [
  '24d6c816fe40a284f2451b1469c5e6d63d236e53.png',
  '5a1b030fb3b46f153f9b4f786a56570d828d2d2f.png',
  '5c275f841f212073cbddbe734d1979a6c2f17ab8.png',
  '5ef21f43a917b3bbe86dad58669fdad1c9f3e7c1.png',
  '68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg',
  '94ab4eb6a469bf7f9de538e5c2f3dc3f2637fddf.jpeg',
  '99d6b811344a0bd98d18246ca8208314e8b490f3.png',
  '9e56d5e5edfcef59ce2aba2b96130dad44ce1135.png',
  'ab7cadc881ab08dcc27d8a8a1f3cb3e8af002216.png',
  'bafc4d0ca4264fb26f014f27c641d860ff356f7a.png',
  'c036fd117629d44e78464dd12d95760f0f0b3d9b.png',
  'd305287d5c861601e285b34ec5a8c7835ae9f8ea.png',
  'de8b5bfa62130bde399a6cb5255323ac949756ec.png',
  'e34736e96c3537509d80e78454d6e88ebe18cc2a.png',
  'e98b4d01e977b8572b85c44cad2e32bbfde68902.jpeg',
  'fa574b2f56d31adfc5900e4bfd116f9cddff17a0.png',
];

/**
 * Get the correct URL for an avatar image
 * Handles both dev mode and production build paths
 * @param avatarName - Avatar filename (e.g., "24d6c816fe40a284f2451b1469c5e6d63d236e53.png")
 * @returns Full URL to the avatar image
 */
export function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    // In Tauri v2, use asset:// protocol for bundled resources
    return `asset://localhost/images/ducks/avatars/${avatarName}`;
  }
  // In dev mode, use standard public path
  return `/images/ducks/avatars/${avatarName}`;
}

/**
 * Get the duckdroid avatar URL (default for agents without custom avatar)
 * @returns Full URL to the duckdroid image
 */
export function getDuckdroidUrl(): string {
  if (window.__TAURI__) {
    // In Tauri v2, use asset:// protocol for bundled resources
    return `asset://localhost/images/duckdroid.png`;
  }
  // In dev mode, use standard public path
  return `/duckdroid.png`;
}

/**
 * Get a random duck avatar for a new agent
 * @returns Random avatar filename
 */
export function getRandomAvatar(): string {
  return AVAILABLE_AVATARS[Math.floor(Math.random() * AVAILABLE_AVATARS.length)];
}

/**
 * Get the avatar image path for an agent
 * @param _agentName - The full agent name (unused, kept for API compatibility)
 * @param avatarFilename - Optional specific avatar filename (default or custom)
 * @returns Avatar image URL or Promise for custom avatars
 */
export function getAgentAvatar(_agentName: string, avatarFilename?: string): string | Promise<string> {
  // If no avatar specified, use default duckdroid
  if (!avatarFilename) {
    return getDuckdroidUrl();
  }

  // Check if it's a custom avatar (UUID format)
  if (isCustomAvatar(avatarFilename)) {
    // Return promise for custom avatar URL
    return getCustomAvatarUrl(avatarFilename);
  }

  // Check if it's a default avatar
  if (AVAILABLE_AVATARS.includes(avatarFilename)) {
    return getAvatarUrl(avatarFilename);
  }

  // Fallback to duckdroid if avatar not found
  return getDuckdroidUrl();
}

/**
 * Check if an agent has a valid avatar
 * @param avatarFilename - Avatar filename to check
 * @returns true if avatar is valid (default or custom)
 */
export function hasAgentAvatar(avatarFilename?: string): boolean {
  if (!avatarFilename) return false;

  // Check if it's a custom avatar (UUID format)
  if (isCustomAvatar(avatarFilename)) {
    return true;
  }

  // Check if it's a default avatar
  return AVAILABLE_AVATARS.includes(avatarFilename);
}

/**
 * Get all available duck avatars with their URLs
 * @returns Record of avatar filename to URL
 */
export function getAvailableAvatars(): Record<string, string> {
  const avatars: Record<string, string> = {};
  AVAILABLE_AVATARS.forEach(avatar => {
    avatars[avatar] = getAvatarUrl(avatar);
  });
  return avatars;
}
