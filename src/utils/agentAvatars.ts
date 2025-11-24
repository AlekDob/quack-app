/**
 * Agent Avatar Utilities
 *
 * Manages duck avatars for agents with proper dev/production path resolution.
 * Supports both default avatars and custom uploaded avatars.
 */

import { convertFileSrc } from '@tauri-apps/api/core';
import { getCustomAvatarUrl, isCustomAvatar } from './customAvatarStorage';

// Type augmentation for Tauri
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

// Available duck avatars from /images/ducks/new-avatars/
export const AVAILABLE_AVATARS = [
  'duck1.jpeg',
  'duck2.jpeg',
  'duck3.jpeg',
  'duck4.jpeg',
  'duck5.jpeg',
  'duck6.jpeg',
  'duck7.jpeg',
  'duck8.jpeg',
  'duck9.jpeg',
  'duck10.jpeg',
  'duck11.jpeg',
  'duck12.jpeg',
  'duck13.jpeg',
  'duck14.jpeg',
  'duck15.jpeg',
  'duck16.jpeg',
  'duck17.jpeg',
  'duck18.jpeg',
  'duck19.jpeg',
  'duck20.jpeg',
  'duck21.jpeg',
  'duck22.jpeg',
  'duck23.jpeg',
  'duck24.jpeg',
  'duck25.jpeg',
  'duck26.jpeg',
  'duck27.jpeg',
  'duck28.jpeg',
  'duck29.jpeg',
  'duck30.jpeg',
  'duck31.jpeg',
  'duck32.jpeg',
  'duck33.jpeg',
  'duck34.jpeg',
  'duck35.jpeg',
];

/**
 * Get the correct URL for an avatar image
 * Handles both dev mode and production build paths
 * @param avatarName - Avatar filename (e.g., "duck1.jpeg")
 * @returns Full URL to the avatar image
 */
export function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    // In Tauri v2, use convertFileSrc for proper asset protocol handling
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset');
  }
  // In dev mode, use standard public path
  return `/images/ducks/new-avatars/${avatarName}`;
}

/**
 * Get the droid avatar URL (default for agents without custom avatar)
 * @returns Full URL to the droid image
 */
export function getDuckdroidUrl(): string {
  // Cache buster to force image reload when updated
  const cacheBuster = `?v=2`;
  let url: string;
  if (window.__TAURI__) {
    // In Tauri v2, use convertFileSrc for proper asset protocol handling
    url = convertFileSrc('/images/droid.jpeg', 'asset') + cacheBuster;
    console.log('[getDuckdroidUrl] TAURI mode - URL:', url);
  } else {
    // In dev mode, use standard public path
    url = `/droid.jpeg${cacheBuster}`;
    console.log('[getDuckdroidUrl] DEV mode - URL:', url);
  }
  return url;
}

/**
 * Get the fallback duck avatar URL (for old avatars that don't exist anymore)
 * @returns Full URL to duck15.jpeg
 */
export function getFallbackDuckUrl(): string {
  let url: string;
  if (window.__TAURI__) {
    // In Tauri v2, use convertFileSrc for proper asset protocol handling
    url = convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset');
    console.log('[getFallbackDuckUrl] TAURI mode - URL:', url);
  } else {
    // In dev mode, use standard public path
    url = `/images/ducks/new-avatars/duck15.jpeg`;
    console.log('[getFallbackDuckUrl] DEV mode - URL:', url);
  }
  return url;
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
  console.log('[getAgentAvatar] Called with:', { agentName: _agentName, avatarFilename });

  // If no avatar specified or empty string, use default duckdroid
  if (!avatarFilename || avatarFilename.trim() === '') {
    console.log('[getAgentAvatar] No avatar or empty string, using duckdroid');
    return getDuckdroidUrl();
  }

  // Check if it's a custom avatar (UUID format)
  if (isCustomAvatar(avatarFilename)) {
    console.log('[getAgentAvatar] Custom avatar detected');
    // Return promise for custom avatar URL
    return getCustomAvatarUrl(avatarFilename);
  }

  // Check if it's a default avatar from new-avatars
  if (AVAILABLE_AVATARS.includes(avatarFilename)) {
    console.log('[getAgentAvatar] Default avatar found:', avatarFilename);
    return getAvatarUrl(avatarFilename);
  }

  // Fallback for old avatars that don't exist anymore - use duck15.jpeg
  console.log('[getAgentAvatar] Old avatar not found, using fallback duck15.jpeg');
  return getFallbackDuckUrl();
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
