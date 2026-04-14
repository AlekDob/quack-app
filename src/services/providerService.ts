// providerService.ts — Test API key validity for LLM providers

const TIMEOUT_MS = 5000;

interface ConnectionResult {
  ok: boolean;
  error?: string;
  models?: string[];
}

interface ProviderConfig {
  url: string;
  headers?: Record<string, string>;
  extractModels: (data: Record<string, unknown>) => string[];
}

function buildAuthHeader(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

function fetchWithTimeout(
  url: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { headers, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function extractIds(
  data: Record<string, unknown>,
  key: string,
  field: string
): string[] {
  const items = data[key];
  if (!Array.isArray(items)) return [];
  return items.map((m: Record<string, unknown>) => String(m[field]));
}

function getProviderConfig(
  provider: string,
  apiKey: string,
  baseUrl?: string
): ProviderConfig | null {
  const configs: Record<string, ProviderConfig> = {
    openai: {
      url: 'https://api.openai.com/v1/models',
      headers: buildAuthHeader(apiKey),
      extractModels: (d) => extractIds(d, 'data', 'id'),
    },
    google: {
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      extractModels: (d) => extractIds(d, 'models', 'name'),
    },
    openrouter: {
      url: 'https://openrouter.ai/api/v1/models',
      headers: buildAuthHeader(apiKey),
      extractModels: (d) => extractIds(d, 'data', 'id'),
    },
    minimax: {
      url: 'https://api.minimax.io/v1/models',
      headers: buildAuthHeader(apiKey),
      extractModels: (d) => extractIds(d, 'data', 'id'),
    },
    zai: {
      url: 'https://api.z.ai/api/coding/paas/v4/models',
      headers: buildAuthHeader(apiKey),
      extractModels: (d) => extractIds(d, 'data', 'id'),
    },
    ollama: {
      url: `${baseUrl || 'http://localhost:11434'}/api/tags`,
      extractModels: (d) => extractIds(d, 'models', 'name'),
    },
    custom: {
      url: `${baseUrl}/v1/models`,
      headers: apiKey ? buildAuthHeader(apiKey) : {},
      extractModels: (d) => extractIds(d, 'data', 'id'),
    },
  };
  return configs[provider] ?? null;
}

async function fetchModels(
  config: ProviderConfig
): Promise<ConnectionResult> {
  const response = await fetchWithTimeout(
    config.url,
    config.headers
  );
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
  }
  const data = await response.json() as Record<string, unknown>;
  return { ok: true, models: config.extractModels(data) };
}

function handleFetchError(err: unknown): ConnectionResult {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { ok: false, error: 'Connection timed out after 5s' };
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  return { ok: false, error: message };
}

/** Test an LLM provider's API key by hitting its models endpoint. */
export async function testProviderConnection(
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<ConnectionResult> {
  if (provider === 'anthropic') {
    return { ok: apiKey.length > 0 };
  }
  const config = getProviderConfig(provider, apiKey, baseUrl);
  if (!config) {
    return { ok: false, error: `Unknown provider: ${provider}` };
  }
  try {
    return await fetchModels(config);
  } catch (err) {
    return handleFetchError(err);
  }
}
