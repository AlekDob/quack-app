-- ============================================================================
-- QUACK PRO - GUMROAD LICENSE VALIDATION SCHEMA
-- ============================================================================
-- This schema stores valid license keys received from Gumroad webhooks
-- Combined with device tracking for max 3 devices per license
-- ============================================================================

-- Table: valid_licenses
-- Stores all valid license keys from Gumroad purchases
CREATE TABLE IF NOT EXISTS valid_licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- License key from Gumroad (unique identifier)
  license_key TEXT NOT NULL UNIQUE,

  -- Gumroad data
  order_id TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  email TEXT NOT NULL,

  -- Purchase info
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',

  -- Status tracking
  is_valid BOOLEAN NOT NULL DEFAULT true,
  is_refunded BOOLEAN NOT NULL DEFAULT false,
  is_disputed BOOLEAN NOT NULL DEFAULT false,
  is_chargebacked BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Additional metadata from Gumroad
  gumroad_data JSONB
);

-- Indexes for fast queries
CREATE INDEX idx_valid_licenses_license_key ON valid_licenses(license_key);
CREATE INDEX idx_valid_licenses_order_id ON valid_licenses(order_id);
CREATE INDEX idx_valid_licenses_email ON valid_licenses(email);
CREATE INDEX idx_valid_licenses_product_id ON valid_licenses(product_id);
CREATE INDEX idx_valid_licenses_is_valid ON valid_licenses(is_valid);

-- ============================================================================
-- IMPORTANT: Keep existing license_devices table unchanged
-- ============================================================================
-- The license_devices table (from previous migration) handles device tracking
-- It references license_key which can now come from valid_licenses table
-- ============================================================================

-- Row Level Security (RLS)
ALTER TABLE valid_licenses ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read for license verification
CREATE POLICY "Allow public read for license verification" ON valid_licenses
  FOR SELECT
  USING (true);

-- Policy: Only service role can write (webhook endpoint)
-- Note: Supabase Edge Functions run with service_role by default
CREATE POLICY "Only service role can insert/update" ON valid_licenses
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Function: Update updated_at timestamp automatically
-- ============================================================================
CREATE OR REPLACE FUNCTION update_valid_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on row update
DROP TRIGGER IF EXISTS trigger_update_valid_licenses_updated_at ON valid_licenses;
CREATE TRIGGER trigger_update_valid_licenses_updated_at
  BEFORE UPDATE ON valid_licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_valid_licenses_updated_at();

-- ============================================================================
-- Helper Function: Check if license key is valid and not refunded/disputed
-- ============================================================================
CREATE OR REPLACE FUNCTION is_license_valid(p_license_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_valid BOOLEAN;
BEGIN
  SELECT is_valid AND NOT is_refunded AND NOT is_disputed AND NOT is_chargebacked
  INTO v_is_valid
  FROM valid_licenses
  WHERE license_key = p_license_key;

  RETURN COALESCE(v_is_valid, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper Function: Get license details for verification
-- ============================================================================
CREATE OR REPLACE FUNCTION get_license_details(p_license_key TEXT)
RETURNS TABLE(
  license_key TEXT,
  email TEXT,
  product_id TEXT,
  is_valid BOOLEAN,
  is_refunded BOOLEAN,
  is_disputed BOOLEAN,
  purchased_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vl.license_key,
    vl.email,
    vl.product_id,
    vl.is_valid,
    vl.is_refunded,
    vl.is_disputed,
    vl.purchased_at
  FROM valid_licenses vl
  WHERE vl.license_key = p_license_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- NOTES FOR DEPLOYMENT
-- ============================================================================
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Verify tables created: valid_licenses
-- 3. Verify policies created: RLS enabled with correct policies
-- 4. Verify functions created: is_license_valid, get_license_details
-- 5. The license_devices table remains unchanged and continues to work
-- ============================================================================
