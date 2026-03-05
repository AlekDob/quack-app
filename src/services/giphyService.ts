/**
 * Giphy Service - GIF reactions for tool/MCP usage
 *
 * Fetches animated GIFs from Giphy API to display during tool execution,
 * making the streaming chat more visually engaging.
 */

// Giphy API key - user must provide their own key in Settings
let giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY || '';
const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

/**
 * Set the Giphy API key at runtime (from Settings store)
 */
function setGiphyApiKey(key: string): void {
  giphyApiKey = key;
}

// Cache GIFs by toolId (unique per invocation) to avoid refetching on re-renders
// But allows variety between different tool invocations
const gifCache = new Map<string, GiphyGif>();

// Track which keywords we've used recently to avoid repetition
const recentKeywords: string[] = [];
const MAX_RECENT_KEYWORDS = 10;

// Rate limiting: track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 500; // Minimum 500ms between requests

interface GiphyGif {
  id: string;
  url: string; // Full size URL
  previewUrl: string; // Smaller preview for faster loading
  title: string;
  width: number;
  height: number;
}

interface GiphySearchResponse {
  data: Array<{
    id: string;
    title: string;
    images: {
      fixed_height: {
        url: string;
        width: string;
        height: string;
      };
      fixed_height_small: {
        url: string;
        width: string;
        height: string;
      };
      preview_gif: {
        url: string;
      };
    };
  }>;
  meta: {
    status: number;
    msg: string;
  };
}

/**
 * Tool-to-keyword mapping for appropriate GIF searches
 * Each tool has multiple keywords to add variety
 */
export const TOOL_GIF_KEYWORDS: Record<string, string[]> = {
  // Brain/Memory tools
  'mcp__brain__brain_search': ['brain thinking', 'searching database', 'detective'],
  'mcp__brain__brain_create_entity': ['writing notes', 'taking notes', 'lightbulb idea'],
  'mcp__brain__brain_add_observation': ['adding note', 'writing', 'remember'],
  'mcp__brain__brain_get_graph': ['network graph', 'connections', 'mind map'],
  'mcp__brain__brain_create_relation': ['connecting dots', 'linking', 'relationship'],
  'mcp__brain__brain_list_entities': ['list checking', 'inventory', 'browsing'],


  // IDE tools
  'mcp__ide-tools__ide_open': ['opening file', 'code editor', 'developer'],
  'mcp__ide-tools__ide_open_multiple': ['opening files', 'tabs', 'multitasking'],

  // File operations
  read: ['reading book', 'studying', 'examining'],
  write: ['typing fast', 'coding', 'writing code'],
  edit: ['editing document', 'fixing code', 'refactoring'],
  glob: ['finding files', 'searching folders', 'file explorer'],
  grep: ['searching text', 'detective', 'magnifying glass'],

  // Shell/System
  bash: ['terminal hacking', 'command line', 'matrix'],
  killshell: ['stopping process', 'terminator', 'stop sign'],

  // Web
  webfetch: ['fetching data', 'internet', 'downloading'],
  websearch: ['googling', 'internet search', 'web browser'],

  // Task/Agent
  task: ['robot working', 'ai assistant', 'automation'],

  // Notebook
  notebookedit: ['jupyter notebook', 'data science', 'python coding'],

  // Todo
  todowrite: ['checklist', 'todo list', 'productivity'],

  // Plan mode
  exitplanmode: ['planning complete', 'ready to go', 'thumbs up'],

  // Default fallback
  default: ['robot working', 'ai thinking', 'processing'],
};

/**
 * Get keywords for a specific tool
 */
export function getKeywordsForTool(toolName: string): string[] {
  const normalizedName = toolName.toLowerCase();

  // Direct match
  if (TOOL_GIF_KEYWORDS[normalizedName]) {
    return TOOL_GIF_KEYWORDS[normalizedName];
  }

  // Partial match for MCP tools (e.g., mcp__brain__brain_search)
  for (const [key, keywords] of Object.entries(TOOL_GIF_KEYWORDS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return keywords;
    }
  }

  return TOOL_GIF_KEYWORDS.default;
}

// Minimum aspect ratio for landscape GIFs (width/height)
// 1.2 means width must be at least 20% greater than height
const MIN_LANDSCAPE_RATIO = 1.2;

/**
 * Search for a LANDSCAPE GIF on Giphy with variety
 * Fetches multiple results and selects randomly from landscape options
 */
async function searchGif(keyword: string, cacheKey?: string): Promise<GiphyGif | null> {
  if (!giphyApiKey) {
    console.warn('[GiphyService] API key not available');
    return null;
  }

  // Check cache by cacheKey (toolId) if provided
  if (cacheKey && gifCache.has(cacheKey)) {
    return gifCache.get(cacheKey)!;
  }

  // Rate limiting
  const now = Date.now();
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL_MS) {
    console.warn('[GiphyService] Rate limited, skipping request');
    return null;
  }
  lastRequestTime = now;

  try {
    // Use random offset to get variety in results
    const randomOffset = Math.floor(Math.random() * 50); // Random offset 0-49

    // Fetch more results to find a landscape GIF
    const params = new URLSearchParams({
      api_key: giphyApiKey,
      q: keyword,
      limit: '25', // Fetch 25 for more variety
      offset: randomOffset.toString(), // Random offset for variety
      rating: 'g', // Family-friendly only
      lang: 'en',
    });

    const response = await fetch(`${GIPHY_API_URL}/search?${params}`);

    if (!response.ok) {
      console.error('[GiphyService] API error:', response.status, response.statusText);
      return null;
    }

    const data: GiphySearchResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      console.warn('[GiphyService] No GIFs found for:', keyword);
      return null;
    }

    // Collect all landscape GIFs
    const landscapeGifs = data.data.filter((gif) => {
      const width = parseInt(gif.images.fixed_height.width, 10);
      const height = parseInt(gif.images.fixed_height.height, 10);
      const aspectRatio = width / height;
      return aspectRatio >= MIN_LANDSCAPE_RATIO;
    });

    let selectedGif = null;

    if (landscapeGifs.length > 0) {
      // Pick a random one from the landscape options for variety
      const randomIndex = Math.floor(Math.random() * landscapeGifs.length);
      selectedGif = landscapeGifs[randomIndex];
      const width = parseInt(selectedGif.images.fixed_height.width, 10);
      const height = parseInt(selectedGif.images.fixed_height.height, 10);
      console.log(`[GiphyService] Selected random landscape GIF (${randomIndex + 1}/${landscapeGifs.length}): ${width}x${height}`);
    }

    // If no landscape found, use a random one from the widest available
    if (!selectedGif) {
      console.warn('[GiphyService] No landscape GIF found, selecting from widest available');
      // Sort by aspect ratio and pick randomly from top 5
      const sortedByRatio = [...data.data].sort((a, b) => {
        const ratioA = parseInt(a.images.fixed_height.width, 10) / parseInt(a.images.fixed_height.height, 10);
        const ratioB = parseInt(b.images.fixed_height.width, 10) / parseInt(b.images.fixed_height.height, 10);
        return ratioB - ratioA;
      });
      const topGifs = sortedByRatio.slice(0, 5);
      selectedGif = topGifs[Math.floor(Math.random() * topGifs.length)];
    }

    const result: GiphyGif = {
      id: selectedGif.id,
      url: selectedGif.images.fixed_height.url,
      previewUrl: selectedGif.images.fixed_height_small?.url || selectedGif.images.preview_gif?.url || selectedGif.images.fixed_height.url,
      title: selectedGif.title,
      width: parseInt(selectedGif.images.fixed_height.width, 10),
      height: parseInt(selectedGif.images.fixed_height.height, 10),
    };

    // Cache by toolId if provided (for re-render stability)
    if (cacheKey) {
      gifCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    console.error('[GiphyService] Failed to fetch GIF:', error);
    return null;
  }
}

/**
 * Get a random GIF for a tool with variety
 * Selects a keyword that hasn't been used recently, and uses random offset
 *
 * @param toolName - The tool name
 * @param toolId - Unique ID for this tool invocation (used for caching)
 */
async function getGifForTool(toolName: string, toolId?: string): Promise<GiphyGif | null> {
  const keywords = getKeywordsForTool(toolName);

  // Try to pick a keyword we haven't used recently
  let selectedKeyword = keywords[0];
  const unusedKeywords = keywords.filter(k => !recentKeywords.includes(k));

  if (unusedKeywords.length > 0) {
    // Pick from unused keywords
    selectedKeyword = unusedKeywords[Math.floor(Math.random() * unusedKeywords.length)];
  } else {
    // All keywords used recently, just pick a random one
    selectedKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  }

  // Track this keyword as recently used
  recentKeywords.push(selectedKeyword);
  if (recentKeywords.length > MAX_RECENT_KEYWORDS) {
    recentKeywords.shift(); // Remove oldest
  }

  console.log(`[GiphyService] Searching GIF for tool "${toolName}" with keyword "${selectedKeyword}" (toolId: ${toolId || 'none'})`);

  return searchGif(selectedKeyword, toolId);
}

/**
 * Check if Giphy service is configured and available
 * Returns true only if user has provided their own API key
 */
function isGiphyConfigured(): boolean {
  return !!giphyApiKey;
}

/**
 * Clear the GIF cache
 */
export function clearGifCache(): void {
  gifCache.clear();
}

/**
 * Get cache size for debugging
 */
export function getGifCacheSize(): number {
  return gifCache.size;
}
