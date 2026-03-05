import { useEffect, useState } from 'react';
import type { ModelConfig } from '../services/modelService';

// Default fallback values if Supabase is unreachable
const DEFAULT_CONFIG = {
  pricing: {
    original_price: 59,
    current_price: 0,
    currency: 'EUR',
    billing_period: 'lifetime',
    badge_text: 'Alpha Version',
    badge_color: 'purple',
  },
  checkout: {
    gumroad_url: 'https://alekdob.gumroad.com/l/tsvgt?wanted=true',
    product_id: 'tsvgt',
  },
  features: {
    max_devices: 1,
    cloud_sync_enabled: false,
    premium_backgrounds_enabled: true,
  },
  promotional_banner: {
    enabled: false,
    message: '🎉 Alpha testers get lifetime access!',
    type: 'info',
  },
};

interface PricingConfig {
  original_price: number;
  current_price: number;
  currency: string;
  billing_period: string;
  badge_text: string;
  badge_color: string;
}

interface CheckoutConfig {
  gumroad_url: string;
  product_id: string;
}

interface FeaturesConfig {
  max_devices: number;
  cloud_sync_enabled: boolean;
  premium_backgrounds_enabled: boolean;
}

interface PromotionalBannerConfig {
  enabled: boolean;
  message: string;
  type: string;
}

interface AppConfig {
  pricing: PricingConfig;
  checkout: CheckoutConfig;
  features: FeaturesConfig;
  promotional_banner: PromotionalBannerConfig;
  models?: ModelConfig[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Cache config in localStorage with 1 hour TTL
const CACHE_KEY = 'quack_app_config';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
// Bump version when adding new config keys to invalidate stale caches
// v3: Added opus46 (Opus 4.6) and renamed opus45 (Legacy) in Supabase models
const CACHE_VERSION = 3;

interface CachedConfig {
  data: AppConfig;
  timestamp: number;
  version?: number;
}

function getCachedConfig(): AppConfig | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedConfig = JSON.parse(cached);
    const now = Date.now();

    // Check if cache version matches and is still valid
    if (parsed.version === CACHE_VERSION && now - parsed.timestamp < CACHE_TTL) {
      return parsed.data;
    }

    // Cache expired
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch (error) {
    console.error('Error reading cached config:', error);
    return null;
  }
}

function setCachedConfig(config: AppConfig): void {
  try {
    const cached: CachedConfig = {
      data: config,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error('Error caching config:', error);
  }
}

async function fetchAppConfig(): Promise<AppConfig> {
  // Check cache first
  const cached = getCachedConfig();
  if (cached) {
    console.log('📦 Using cached app config');
    return cached;
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('⚠️ Supabase not configured, using default config');
      return DEFAULT_CONFIG;
    }

    console.log('🔄 Fetching app config from Supabase...');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_config?select=key,value`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[AppConfig] Raw Supabase data:', JSON.stringify(data.map((d: { key: string }) => d.key)));

    // Transform array of {key, value} into config object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: Record<string, any> = {};
    data.forEach((item: { key: string; value: unknown }) => {
      config[item.key] = item.value;
    });

    // Merge with defaults (in case some keys are missing)
    const mergedConfig: AppConfig = {
      pricing: config.pricing || DEFAULT_CONFIG.pricing,
      checkout: config.checkout || DEFAULT_CONFIG.checkout,
      features: config.features || DEFAULT_CONFIG.features,
      promotional_banner: config.promotional_banner || DEFAULT_CONFIG.promotional_banner,
      models: config.models,
    };

    // Cache the result
    setCachedConfig(mergedConfig);

    console.log('[AppConfig] Loaded successfully. Models:', mergedConfig.models?.length ?? 'none');
    console.log('[AppConfig] Models detail:', JSON.stringify(mergedConfig.models?.map(m => ({ id: m.id, modelId: m.modelId })) || []));
    return mergedConfig;
  } catch (error) {
    console.error('❌ Error fetching app config:', error);
    console.log('📦 Using default config as fallback');
    return DEFAULT_CONFIG;
  }
}

function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppConfig()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}

function usePricingConfig() {
  const { config, loading } = useAppConfig();
  return { pricing: config.pricing, loading };
}

function useCheckoutConfig() {
  const { config, loading } = useAppConfig();
  return { checkout: config.checkout, loading };
}

function useFeaturesConfig() {
  const { config, loading } = useAppConfig();
  return { features: config.features, loading };
}

export function useModelsConfig() {
  const { config, loading } = useAppConfig();
  return { models: config.models, loading };
}
