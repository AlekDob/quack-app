/**
 * Feature flags and licensing system for Quack
 * Manages Pro vs Free feature differentiation
 */

// License storage key
const LICENSE_KEY_STORAGE = 'quack_license_key';
const LICENSE_DATA_STORAGE = 'quack_license_data';

// Free tier limits
export const FREE_LIMITS = {
  maxTerminals: 3,
  maxGroups: 1,
  cloudSync: false,
  premiumBackgrounds: false,
  advancedAgency: false,
  savedCommandsSync: false,
  prioritySupport: false,
} as const;

// Pro features list
export const PRO_FEATURES = {
  unlimitedTerminals: true,
  unlimitedGroups: true,
  cloudSync: true,
  premiumBackgrounds: true,
  advancedAgency: true,
  savedCommandsSync: true,
  prioritySupport: true,
  autoUpdates: true,
  customThemes: true,
} as const;

export interface LicenseData {
  key: string;
  email?: string;
  activatedAt: number;
  expiresAt?: number; // For subscription model
  type: 'lifetime' | 'subscription';
  valid: boolean;
  lastValidatedAt?: number; // Timestamp of last revalidation check
}

/**
 * Check if user has a valid Pro license
 */
export const isPro = (): boolean => {
  try {
    const licenseData = localStorage.getItem(LICENSE_DATA_STORAGE);
    if (!licenseData) return false;

    const license: LicenseData = JSON.parse(licenseData);

    // Check if license is valid
    if (!license.valid) return false;

    // For subscription, check expiration
    if (license.type === 'subscription' && license.expiresAt) {
      return Date.now() < license.expiresAt;
    }

    // Lifetime license
    return true;
  } catch (error) {
    console.error('Error checking Pro status:', error);
    return false;
  }
};

/**
 * Get license data if available
 */
export const getLicenseData = (): LicenseData | null => {
  try {
    const licenseData = localStorage.getItem(LICENSE_DATA_STORAGE);
    if (!licenseData) return null;
    return JSON.parse(licenseData);
  } catch (error) {
    console.error('Error getting license data:', error);
    return null;
  }
};

/**
 * Save license data after validation
 */
export const saveLicenseData = (license: LicenseData): void => {
  try {
    localStorage.setItem(LICENSE_DATA_STORAGE, JSON.stringify(license));
    localStorage.setItem(LICENSE_KEY_STORAGE, license.key);
  } catch (error) {
    console.error('Error saving license data:', error);
    throw new Error('Failed to save license data');
  }
};

/**
 * Clear license data (logout/deactivate)
 */
export const clearLicenseData = (): void => {
  try {
    localStorage.removeItem(LICENSE_DATA_STORAGE);
    localStorage.removeItem(LICENSE_KEY_STORAGE);
  } catch (error) {
    console.error('Error clearing license data:', error);
  }
};

/**
 * Check if a specific feature is available
 */
export const hasFeature = (feature: keyof typeof PRO_FEATURES): boolean => {
  if (isPro()) {
    return PRO_FEATURES[feature];
  }
  return false;
};

/**
 * Get the limit for a specific resource
 */
export const getLimit = (resource: keyof typeof FREE_LIMITS): number | boolean => {
  if (isPro()) {
    // Pro users have unlimited/all features
    if (resource === 'maxTerminals' || resource === 'maxGroups') {
      return Infinity;
    }
    return true;
  }
  return FREE_LIMITS[resource];
};

/**
 * Check if user can create another terminal
 */
export const canCreateTerminal = (currentCount: number): boolean => {
  if (isPro()) return true;
  return currentCount < FREE_LIMITS.maxTerminals;
};

/**
 * Check if user can create another group
 */
export const canCreateGroup = (currentCount: number): boolean => {
  if (isPro()) return true;
  return currentCount < FREE_LIMITS.maxGroups;
};

/**
 * Get upgrade message based on limit reached
 */
export const getUpgradeMessage = (limitType: string): string => {
  const messages: Record<string, string> = {
    terminals: `You've reached the free tier limit of ${FREE_LIMITS.maxTerminals} terminals. Upgrade to Pro for unlimited terminals!`,
    groups: `You've reached the free tier limit of ${FREE_LIMITS.maxGroups} group. Upgrade to Pro for unlimited groups!`,
    backgrounds: 'Premium backgrounds are available in Pro. Upgrade to unlock beautiful terminal themes!',
    agency: 'Advanced Quack Agency features require Pro. Upgrade for the full experience!',
    sync: 'Cloud sync is a Pro feature. Upgrade to sync your settings across devices!',
  };
  return messages[limitType] || 'This feature requires Quack Pro. Upgrade to unlock!';
};

/**
 * Format license type for display
 */
export const formatLicenseType = (type: 'lifetime' | 'subscription'): string => {
  return type === 'lifetime' ? 'Lifetime License' : 'Subscription';
};

/**
 * Calculate days until license expires (for subscriptions)
 */
export const getDaysUntilExpiry = (expiresAt?: number): number | null => {
  if (!expiresAt) return null;
  const now = Date.now();
  const diff = expiresAt - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Check if license is expiring soon (within 7 days)
 */
export const isExpiringSoon = (expiresAt?: number): boolean => {
  const days = getDaysUntilExpiry(expiresAt);
  return days !== null && days <= 7 && days > 0;
};

/**
 * Check if license needs revalidation (7 days since last check)
 */
export const needsRevalidation = (lastValidatedAt?: number): boolean => {
  if (!lastValidatedAt) return true; // Never validated, need to validate

  const now = Date.now();
  const daysSinceValidation = (now - lastValidatedAt) / (1000 * 60 * 60 * 24);

  return daysSinceValidation >= 7;
};

/**
 * Revalidate license with Lemon Squeezy API
 * Returns true if license is still valid, false if it should be deactivated
 */
export const revalidateLicense = async (): Promise<boolean> => {
  try {
    const licenseData = getLicenseData();
    if (!licenseData) return false;

    // Import invoke dynamically to avoid issues in non-Tauri environments
    const { invoke } = await import('@tauri-apps/api/core');

    // Call backend revalidation
    const response = await invoke<{ valid: boolean; error?: string }>('revalidate_license', {
      licenseKey: licenseData.key,
    });

    if (response.valid) {
      // Update lastValidatedAt timestamp
      const updatedLicense: LicenseData = {
        ...licenseData,
        lastValidatedAt: Date.now(),
      };
      saveLicenseData(updatedLicense);
      return true;
    } else {
      // License is no longer valid (refunded, expired, etc.)
      console.warn('License revalidation failed:', response.error);
      clearLicenseData();
      return false;
    }
  } catch (error) {
    console.error('Error during license revalidation:', error);
    // Don't clear license on network errors - only clear if API explicitly says invalid
    return true; // Assume valid if we can't reach API
  }
};
