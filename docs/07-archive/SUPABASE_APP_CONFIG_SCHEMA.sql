-- ============================================================================
-- QUACK APP - DYNAMIC CONFIGURATION SCHEMA
-- ============================================================================
-- This schema stores app configuration that can be updated without rebuilding
-- Pricing, feature flags, promotional messages, etc.
-- ============================================================================

-- Table: app_config
-- Stores key-value configuration for the app
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Config key (unique identifier)
  key TEXT NOT NULL UNIQUE,

  -- Config value (JSON for flexibility)
  value JSONB NOT NULL,

  -- Description for documentation
  description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_app_config_key ON app_config(key);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read (app needs to fetch config)
CREATE POLICY "Allow public read for app config" ON app_config
  FOR SELECT
  USING (true);

-- Policy: Only service role can write (admin only)
CREATE POLICY "Only service role can update config" ON app_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_app_config_updated_at ON app_config;
CREATE TRIGGER trigger_update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_config_updated_at();

-- ============================================================================
-- Insert default pricing configuration
-- ============================================================================
INSERT INTO app_config (key, value, description) VALUES
  (
    'pricing',
    '{
      "original_price": 59,
      "current_price": 0,
      "currency": "EUR",
      "billing_period": "lifetime",
      "badge_text": "Alpha Version",
      "badge_color": "purple"
    }'::jsonb,
    'Pricing configuration for upgrade modal'
  ),
  (
    'checkout',
    '{
      "gumroad_url": "https://alekdob.gumroad.com/l/tsvgt?wanted=true",
      "product_id": "tsvgt"
    }'::jsonb,
    'Checkout and payment configuration'
  ),
  (
    'features',
    '{
      "max_devices": 1,
      "cloud_sync_enabled": false,
      "premium_backgrounds_enabled": true
    }'::jsonb,
    'Feature flags and limits'
  ),
  (
    'promotional_banner',
    '{
      "enabled": false,
      "message": "🎉 Alpha testers get lifetime access!",
      "type": "info"
    }'::jsonb,
    'Promotional banner configuration'
  )
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Helper function to get config value
-- ============================================================================
CREATE OR REPLACE FUNCTION get_config(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value
  FROM app_config
  WHERE key = p_key;

  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DEPLOYMENT NOTES
-- ============================================================================
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Verify table created: app_config
-- 3. Check default values inserted (pricing, checkout, features)
-- 4. Update pricing anytime with:
--    UPDATE app_config
--    SET value = '{"original_price": 99, "current_price": 49, ...}'::jsonb
--    WHERE key = 'pricing';
-- ============================================================================
