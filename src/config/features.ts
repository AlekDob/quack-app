/**
 * Feature flags and licensing system for Quack
 * Manages Pro vs Free feature differentiation
 */

// License storage key
const LICENSE_KEY_STORAGE = 'quack_license_key';
const LICENSE_DATA_STORAGE = 'quack_license_data';

// Free tier limits — Quack is now FREE FOREVER with no limits
// Kept for backwards compatibility but everything is unlocked
const FREE_LIMITS = {
  maxTerminals: Infinity,
  maxGroups: Infinity,
  cloudSync: true,
  premiumBackgrounds: true,
  advancedAgency: true,
  savedCommandsSync: true,
  prioritySupport: false,
} as const;

// Pro features list
const PRO_FEATURES = {
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
  deviceId: string; // Unique device identifier for Supabase tracking
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
const hasFeature = (feature: keyof typeof PRO_FEATURES): boolean => {
  if (isPro()) {
    return PRO_FEATURES[feature];
  }
  return false;
};

/**
 * Get the limit for a specific resource
 */
const getLimit = (resource: keyof typeof FREE_LIMITS): number | boolean => {
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
const canCreateTerminal = (currentCount: number): boolean => {
  if (isPro()) return true;
  return currentCount < FREE_LIMITS.maxTerminals;
};

/**
 * Check if user can create another group
 */
const canCreateGroup = (currentCount: number): boolean => {
  if (isPro()) return true;
  return currentCount < FREE_LIMITS.maxGroups;
};

/**
 * Get upgrade message based on limit reached
 */
const getUpgradeMessage = (limitType: string): string => {
  const messages: Record<string, string> = {
    terminals: 'Quack is free with unlimited agents! Need help setting up? Check out our Setup & Expert plans.',
    groups: 'Quack is free with unlimited groups! Need help setting up? Check out our Setup & Expert plans.',
    backgrounds: 'All backgrounds are free! Need a custom setup? Check out our consulting services.',
    agency: 'All Quack features are free! Need help getting started? Book a setup session.',
    sync: 'Cloud sync is coming soon! Join our Discord for updates.',
  };
  return messages[limitType] || 'Quack is free forever! Visit quack.build for consulting and expert services.';
};

/**
 * Format license type for display
 */
const formatLicenseType = (type: 'lifetime' | 'subscription'): string => {
  return type === 'lifetime' ? 'Lifetime License' : 'Subscription';
};

/**
 * Calculate days until license expires (for subscriptions)
 */
const getDaysUntilExpiry = (expiresAt?: number): number | null => {
  if (!expiresAt) return null;
  const now = Date.now();
  const diff = expiresAt - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Check if license is expiring soon (within 7 days)
 */
const isExpiringSoon = (expiresAt?: number): boolean => {
  const days = getDaysUntilExpiry(expiresAt);
  return days !== null && days <= 7 && days > 0;
};

/**
 * Check if license needs revalidation (7 days since last check)
 */
const needsRevalidation = (lastValidatedAt?: number): boolean => {
  if (!lastValidatedAt) return true; // Never validated, need to validate

  const now = Date.now();
  const daysSinceValidation = (now - lastValidatedAt) / (1000 * 60 * 60 * 24);

  return daysSinceValidation >= 7;
};

/**
 * Revalidate license with Gumroad API
 * Returns true if license is still valid, false if it should be deactivated
 */
export const revalidateLicense = async (): Promise<boolean> => {
  try {
    const licenseData = getLicenseData();
    if (!licenseData) return false;

    // Import invoke dynamically to avoid issues in non-Tauri environments
    const { invoke } = await import('@tauri-apps/api/core');

    // Call backend revalidation (now requires deviceId for Gumroad + Supabase)
    const response = await invoke<{ valid: boolean; error?: string }>('revalidate_license', {
      licenseKey: licenseData.key,
      deviceId: licenseData.deviceId,
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
