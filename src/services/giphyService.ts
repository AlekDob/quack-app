/**
 * Giphy Service - GIF reactions for tool/MCP usage
 *
 * Fetches animated GIFs from Giphy API to display during tool execution,
 * making the streaming chat more visually engaging.
 */

// Giphy API key - bundled with app for all users
// Falls back to embedded key if env var not set (production builds)
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'w9lZ6fgXmVo8lFFSdlFRJ1qHpEzYfvAX';
const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

// Cache GIFs to avoid repeated API calls for same tools
const gifCache = new Map<string, GiphyGif>();

// Rate limiting: track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 500; // Minimum 500ms between requests

export interface GiphyGif {
  id: string;
  url: string; // Full size URL
  previewUrl: string; // Smaller preview for faster loading
  title: string;
  width: number;
  height: number;
}

export interface GiphySearchResponse {
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

  // Semantic Search tools
  'mcp__semantic-search__semantic_search_code': ['code search', 'finding code', 'magnifying glass'],
  'mcp__semantic-search__index_project': ['indexing files', 'organizing', 'cataloging'],
  'mcp__semantic-search__generate_embeddings': ['processing data', 'neural network', 'ai learning'],

  // Kanban tools
  'mcp__kanban-tools__kanban_list_tasks': ['todo list', 'checking tasks', 'clipboard'],
  'mcp__kanban-tools__kanban_create_task': ['creating task', 'adding item', 'new task'],
  'mcp__kanban-tools__kanban_move_task': ['moving task', 'drag drop', 'organizing'],
  'mcp__kanban-tools__kanban_update_task': ['updating', 'editing', 'modifying'],

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
 * Search for a LANDSCAPE GIF on Giphy
 * Fetches multiple results and filters for horizontal aspect ratio
 */
export async function searchGif(keyword: string): Promise<GiphyGif | null> {
  // API key is always available (bundled with app)
  if (!GIPHY_API_KEY) {
    console.warn('[GiphyService] API key not available');
    return null;
  }

  // Check cache first
  const cacheKey = keyword.toLowerCase();
  if (gifCache.has(cacheKey)) {
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
    // Fetch more results to find a landscape GIF
    const params = new URLSearchParams({
      api_key: GIPHY_API_KEY,
      q: keyword,
      limit: '15', // Fetch 15 to find a good landscape one
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

    // Find the first landscape GIF (width > height * MIN_LANDSCAPE_RATIO)
    let selectedGif = null;
    for (const gif of data.data) {
      const width = parseInt(gif.images.fixed_height.width, 10);
      const height = parseInt(gif.images.fixed_height.height, 10);
      const aspectRatio = width / height;

      if (aspectRatio >= MIN_LANDSCAPE_RATIO) {
        selectedGif = gif;
        console.log(`[GiphyService] Found landscape GIF: ${width}x${height} (ratio: ${aspectRatio.toFixed(2)})`);
        break;
      }
    }

    // If no landscape found, use the widest one available
    if (!selectedGif) {
      console.warn('[GiphyService] No landscape GIF found, selecting widest available');
      selectedGif = data.data.reduce((best, current) => {
        const bestRatio = parseInt(best.images.fixed_height.width, 10) / parseInt(best.images.fixed_height.height, 10);
        const currentRatio = parseInt(current.images.fixed_height.width, 10) / parseInt(current.images.fixed_height.height, 10);
        return currentRatio > bestRatio ? current : best;
      });
    }

    const result: GiphyGif = {
      id: selectedGif.id,
      url: selectedGif.images.fixed_height.url,
      previewUrl: selectedGif.images.fixed_height_small?.url || selectedGif.images.preview_gif?.url || selectedGif.images.fixed_height.url,
      title: selectedGif.title,
      width: parseInt(selectedGif.images.fixed_height.width, 10),
      height: parseInt(selectedGif.images.fixed_height.height, 10),
    };

    // Cache the result
    gifCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error('[GiphyService] Failed to fetch GIF:', error);
    return null;
  }
}

/**
 * Get a random GIF for a tool
 * Selects a random keyword from the tool's keyword list
 */
export async function getGifForTool(toolName: string): Promise<GiphyGif | null> {
  const keywords = getKeywordsForTool(toolName);
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

  console.log(`[GiphyService] Searching GIF for tool "${toolName}" with keyword "${randomKeyword}"`);

  return searchGif(randomKeyword);
}

/**
 * Check if Giphy service is configured and available
 * Always returns true since API key is bundled with the app
 */
export function isGiphyConfigured(): boolean {
  return !!GIPHY_API_KEY;
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
