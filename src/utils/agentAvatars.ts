/**
 * Agent Avatar Utilities
 *
 * Maps agent names to their corresponding duck avatar images.
 * Images should be placed in /images/ducks/ with filenames matching agent names.
 *
 * Matching logic:
 * - If agent name contains the image filename (without extension), use that image
 * - Case-insensitive matching
 * - Example: "mike project manager" matches "mike.png"
 */

// Available duck avatars in /images/ducks/
const DUCK_AVATARS: Record<string, string> = {
  mike: '/images/ducks/mike.png',
  julie: '/images/ducks/julie.png',
  john: '/images/ducks/john.png',
  giuseppe: '/images/ducks/giuseppe.png',
};

/**
 * Get the avatar image path for an agent based on their name
 * @param agentName - The full agent name (e.g., "mike project manager")
 * @returns Avatar image path or null if no match found
 */
export function getAgentAvatar(agentName: string): string | null {
  if (!agentName) return null;

  const nameLower = agentName.toLowerCase();

  // Try to find a matching duck avatar
  for (const [key, imagePath] of Object.entries(DUCK_AVATARS)) {
    if (nameLower.includes(key)) {
      return imagePath;
    }
  }

  return null;
}

/**
 * Check if an agent has a custom avatar
 */
export function hasAgentAvatar(agentName: string): boolean {
  return getAgentAvatar(agentName) !== null;
}

/**
 * Get all available duck avatars
 */
export function getAvailableAvatars(): Record<string, string> {
  return { ...DUCK_AVATARS };
}
