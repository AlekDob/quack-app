import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { getLicenseData, clearLicenseData } from '../../../config/features';
import './LicenseSettings.css';

const GUMROAD_SETUP_URL = 'https://alekdob.gumroad.com/l/tsvgt';
const GUMROAD_EXPERT_URL = 'https://alekdob.gumroad.com/l/nwuhis';

interface LicenseData {
  key: string;
  email?: string;
  activatedAt: number;
  expiresAt?: number;
  type: 'lifetime' | 'subscription';
  valid: boolean;
}

export default function LicenseSettings() {
  const [licenseData, setLicenseData] = useState<LicenseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLicenseData();
  }, []);

  const loadLicenseData = () => {
    try {
      const license = getLicenseData();
      if (license) {
        setLicenseData(license);
      }
    } catch (error) {
      console.error('Failed to load license:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDeactivateLicense = async () => {
    if (!licenseData) return;

    if (window.confirm('Are you sure you want to deactivate this license? This will remove the license from this device only.')) {
      try {
        try {
          await invoke('deactivate_license', { licenseKey: licenseData.key });
        } catch (apiError) {
          console.warn('API deactivation failed, clearing local data anyway:', apiError);
        }

        clearLicenseData();
        setLicenseData(null);
        window.location.reload();
      } catch (error) {
        console.error('Unexpected error during deactivation:', error);
        clearLicenseData();
        window.location.reload();
      }
    }
  };

  if (loading) {
    return (
      <div className="license-settings">
        <div className="license-loading">Loading license information...</div>
      </div>
    );
  }

  return (
    <div className="license-settings">
      {licenseData ? (
        // Pro / Legacy license holder view
        <div className="license-active">
          <div className="license-badge-container">
            <div className="license-badge-pro">
              <span className="license-badge-icon">👑</span>
              <span className="license-badge-text">Quack Supporter</span>
            </div>
          </div>

          <div className="license-info-card">
            <h3>License Information</h3>

            <div className="license-info-row">
              <span className="license-info-label">Status</span>
              <span className="license-info-value license-status-active">Active</span>
            </div>

            {licenseData.email && (
              <div className="license-info-row">
                <span className="license-info-label">Licensed to</span>
                <span className="license-info-value">{licenseData.email}</span>
              </div>
            )}

            <div className="license-info-row">
              <span className="license-info-label">License Type</span>
              <span className="license-info-value license-type">
                {licenseData.type === 'lifetime' ? 'Lifetime' : 'Subscription'}
              </span>
            </div>

            <div className="license-info-row">
              <span className="license-info-label">Activated on</span>
              <span className="license-info-value">{formatDate(licenseData.activatedAt)}</span>
            </div>

            {licenseData.expiresAt && (
              <div className="license-info-row">
                <span className="license-info-label">Expires on</span>
                <span className="license-info-value">{formatDate(licenseData.expiresAt)}</span>
              </div>
            )}
          </div>

          <div className="license-indie-message">
            Thank you for supporting Quack! All features are now free for everyone,
            and your early support helped make that possible.
          </div>

          <button
            className="license-deactivate-button"
            onClick={handleDeactivateLicense}
          >
            Deactivate License
          </button>
        </div>
      ) : (
        // Free user view — everything unlocked
        <div className="license-free">
          <div className="license-badge-container">
            <div className="license-badge-free" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <span className="license-badge-icon">🦆</span>
              <span className="license-badge-text">Quack Free Forever</span>
            </div>
          </div>

          <div className="license-upgrade-card">
            <h3>All Features Unlocked</h3>
            <p className="license-upgrade-description">
              Quack is completely free with no limits. Unlimited agents, groups,
              backgrounds, and all features are included.
            </p>

            <div className="license-features">
              <h4>What&apos;s Included:</h4>
              <ul className="license-features-list">
                <li><span className="feature-check">✓</span> Unlimited AI agents</li>
                <li><span className="feature-check">✓</span> Unlimited groups &amp; workspaces</li>
                <li><span className="feature-check">✓</span> All backgrounds &amp; themes</li>
                <li><span className="feature-check">✓</span> MCP server integrations</li>
                <li><span className="feature-check">✓</span> Second Brain knowledge store</li>
                <li><span className="feature-check">✓</span> Quack Store</li>
                <li><span className="feature-check">✓</span> All future updates</li>
              </ul>
            </div>

            <div className="license-cta-buttons">
              <p className="license-upgrade-description" style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#d1d5db' }}>
                Need help getting the most out of Quack?
              </p>
              <button
                className="license-purchase-button"
                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white' }}
                onClick={() => open(GUMROAD_SETUP_URL)}
              >
                Quack Setup &amp; Onboarding — &euro;79
              </button>
              <button
                className="license-purchase-button license-purchase-lifetime"
                style={{ background: 'linear-gradient(135deg, #f97316 0%, #eab308 100%)', color: 'white' }}
                onClick={() => open(GUMROAD_EXPERT_URL)}
              >
                Become a Quack Expert — &euro;149
              </button>
              <p className="license-indie-message">
                Quack is free forever — built with love from Italy &amp; Sweden 🦆
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
