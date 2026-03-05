/**
 * Custom Avatar Storage Utilities
 *
 * Manages custom avatar uploads and retrieval with Tauri backend integration.
 */

import { invoke } from '@tauri-apps/api/core';
import { getDuckdroidUrl } from './agentAvatars';

export interface CustomAvatarInfo {
  id: string;
  filename: string;
  originalName: string;
  createdAt: number;
  size: number;
}

/**
 * Upload a custom avatar image
 * @param file - Image file to upload
 * @returns Custom avatar info
 */
export async function uploadCustomAvatar(file: File): Promise<CustomAvatarInfo> {
  // Convert file to base64
  const base64Data = await fileToBase64(file);

  // Remove data URL prefix (e.g., "data:image/png;base64,")
  const base64Clean = base64Data.split(',')[1];

  // Save via Tauri backend
  const avatarInfo = await invoke<CustomAvatarInfo>('save_custom_avatar', {
    dataBase64: base64Clean,
    originalName: file.name,
  });

  return avatarInfo;
}

/**
 * List all custom avatars
 * @returns Array of custom avatar info
 */
export async function listCustomAvatars(): Promise<CustomAvatarInfo[]> {
  return await invoke<CustomAvatarInfo[]>('list_custom_avatars');
}

/**
 * Delete a custom avatar
 * @param avatarId - Avatar ID to delete
 */
export async function deleteCustomAvatar(avatarId: string): Promise<void> {
  await invoke('delete_custom_avatar', { avatarId });
}

/**
 * Get the file path for a custom avatar
 * @param avatarId - Avatar ID
 * @returns Full file path
 */
export async function getCustomAvatarPath(avatarId: string): Promise<string> {
  return await invoke<string>('get_custom_avatar_path', { avatarId });
}

/**
 * Get the URL for displaying a custom avatar
 * @param avatarId - Avatar ID or filename
 * @returns URL for displaying the avatar (Blob URL)
 */
export async function getCustomAvatarUrl(avatarId: string): Promise<string> {
  try {
    // Read the image file as bytes from backend
    const bytes = await invoke<number[]>('read_custom_avatar_bytes', {
      avatarId: avatarId
    });

    // Convert to Uint8Array
    const uint8Array = new Uint8Array(bytes);

    // Detect MIME type from file extension
    const path = await getCustomAvatarPath(avatarId);
    const ext = path.split('.').pop()?.toLowerCase() || 'png';
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    const mimeType = mimeTypes[ext] || 'image/png';

    // Create Blob and generate URL
    const blob = new Blob([uint8Array], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    return blobUrl;
  } catch (error) {
    console.error('Failed to get custom avatar URL:', error);
    // Return fallback/placeholder - use getDuckdroidUrl for proper Tauri path
    return getDuckdroidUrl();
  }
}

/**
 * Check if an avatar ID is a custom avatar
 * @param avatarId - Avatar ID to check
 * @returns true if it's a custom avatar (UUID format)
 */
export function isCustomAvatar(avatarId: string): boolean {
  // Custom avatars use UUID format (with dashes)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(avatarId);
}

/**
 * Revoke a blob URL to free memory
 * @param blobUrl - The blob URL to revoke
 */
export function revokeAvatarUrl(blobUrl: string): void {
  if (blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Convert a File object to base64 string
 * @param file - File to convert
 * @returns Base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Validate image file before upload
 * @param file - File to validate
 * @returns Error message if invalid, null if valid
 */
export function validateAvatarFile(file: File): string | null {
  // Check file size (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return 'Avatar image must be smaller than 5MB';
  }

  // Check file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return 'Avatar must be PNG, JPG, JPEG, GIF, or WEBP format';
  }

  return null;
}
