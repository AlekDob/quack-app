/**
 * GitHub Releases API Service
 * Fetches release information from GitHub for update checking
 */

// GitHub API configuration
const GITHUB_OWNER = 'AlekDob';
const GITHUB_REPO = 'quack-releases';
const GITHUB_API_BASE = 'https://api.github.com';

// Cache configuration
const CACHE_KEY_LATEST = 'quack_latest_release';
const CACHE_KEY_ALL = 'quack_all_releases';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Rate limiting
const LAST_CHECK_KEY = 'quack_last_update_check';
const MIN_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour minimum between checks

/**
 * GitHub Release Asset interface
 */
export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
  download_count: number;
}

/**
 * GitHub Release interface
 */
export interface GitHubRelease {
  tag_name: string; // e.g., "v0.1.0" or "v0.1.0.intel"
  name: string; // e.g., "Quack 0.1.0"
  published_at: string; // ISO 8601 date string
  body: string; // Release notes in markdown
  html_url: string; // URL to release page
  assets: GitHubReleaseAsset[];
  prerelease: boolean;
  draft: boolean;
}

/**
 * Cached data interface
 */
interface CachedData<T> {
  data: T;
  timestamp: number;
}

/**
 * Get cached data from localStorage
 */
function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed: CachedData<T> = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - parsed.timestamp < CACHE_TTL) {
      console.log(`📦 Using cached data for ${key}`);
      return parsed.data;
    }

    // Cache expired
    localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.error(`Error reading cached data for ${key}:`, error);
    return null;
  }
}

/**
 * Save data to localStorage cache
 */
function setCachedData<T>(key: string, data: T): void {
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    console.error(`Error caching data for ${key}:`, error);
  }
}

/**
 * Check if enough time has passed since last check (rate limiting)
 */
export function canCheckForUpdates(): boolean {
  try {
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    if (!lastCheck) return true;

    const lastCheckTime = parseInt(lastCheck, 10);
    const now = Date.now();

    return now - lastCheckTime >= MIN_CHECK_INTERVAL;
  } catch (error) {
    console.error('Error checking last update time:', error);
    return true; // Allow check if error
  }
}

/**
 * Update last check timestamp
 */
function updateLastCheckTime(): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error updating last check time:', error);
  }
}

/**
 * Fetch the latest release from GitHub
 * @param force - Force fresh fetch, bypassing cache
 * @returns Promise<GitHubRelease | null> - Latest release or null if error
 */
export async function fetchLatestRelease(force: boolean = false): Promise<GitHubRelease | null> {
  // Check cache first (unless forced)
  if (!force) {
    const cached = getCachedData<GitHubRelease>(CACHE_KEY_LATEST);
    if (cached) {
      return cached;
    }
  }

  try {
    console.log('🔄 Fetching latest release from GitHub API...');

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('No releases found on GitHub');
        return null;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data: GitHubRelease = await response.json();

    // Cache the result
    setCachedData(CACHE_KEY_LATEST, data);

    // Update last check time
    updateLastCheckTime();

    console.log('✅ Latest release fetched successfully:', data.tag_name);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.error('❌ GitHub API request timed out');
      } else {
        console.error('❌ Error fetching latest release:', error.message);
      }
    } else {
      console.error('❌ Unknown error fetching latest release');
    }
    return null;
  }
}

/**
 * Fetch all releases from GitHub (for changelog)
 * @param limit - Maximum number of releases to fetch (default: 10)
 * @returns Promise<GitHubRelease[] | null> - Array of releases or null if error
 */
export async function fetchAllReleases(limit: number = 10): Promise<GitHubRelease[] | null> {
  // Check cache first
  const cached = getCachedData<GitHubRelease[]>(CACHE_KEY_ALL);
  if (cached) {
    return cached;
  }

  try {
    console.log('🔄 Fetching all releases from GitHub API...');

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=${limit}`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('No releases found on GitHub');
        return [];
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data: GitHubRelease[] = await response.json();

    // Filter out drafts and prereleases (optional)
    const publishedReleases = data.filter(release => !release.draft);

    // Cache the result
    setCachedData(CACHE_KEY_ALL, publishedReleases);

    console.log(`✅ Fetched ${publishedReleases.length} releases successfully`);
    return publishedReleases;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.error('❌ GitHub API request timed out');
      } else {
        console.error('❌ Error fetching releases:', error.message);
      }
    } else {
      console.error('❌ Unknown error fetching releases');
    }
    return null;
  }
}

/**
 * Clear all release caches (useful for testing)
 */
export function clearReleaseCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY_LATEST);
    localStorage.removeItem(CACHE_KEY_ALL);
    localStorage.removeItem(LAST_CHECK_KEY);
    console.log('🗑️ Release cache cleared');
  } catch (error) {
    console.error('Error clearing release cache:', error);
  }
}

/**
 * Get time since last update check in human-readable format
 * @returns string - e.g., "5 minutes ago", "never"
 */
export function getTimeSinceLastCheck(): string {
  try {
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    if (!lastCheck) return 'never';

    const lastCheckTime = parseInt(lastCheck, 10);
    const now = Date.now();
    const diff = now - lastCheckTime;

    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } catch (error) {
    console.error('Error calculating time since last check:', error);
    return 'unknown';
  }
}
