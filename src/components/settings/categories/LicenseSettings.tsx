import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { getLicenseData, clearLicenseData } from '../../../config/features';
import './LicenseSettings.css';

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
        // Try to deactivate via API, but if it fails, we still clear local data
        try {
          await invoke('deactivate_license', { licenseKey: licenseData.key });
        } catch (apiError) {
          console.warn('API deactivation failed, clearing local data anyway:', apiError);
          // Continue to clear local data even if API call fails
        }

        // Always clear local data
        clearLicenseData();
        setLicenseData(null);

        // Reload the page to update license state across all components
        window.location.reload();
      } catch (error) {
        console.error('Unexpected error during deactivation:', error);
        // Still try to clear local data
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
        // Pro user view
        <div className="license-active">
          <div className="license-badge-container">
            <div className="license-badge-pro">
              <span className="license-badge-icon">👑</span>
              <span className="license-badge-text">Quack Pro</span>
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

          <div className="license-features">
            <h4>Pro Features</h4>
            <ul className="license-features-list">
              <li><span className="feature-check">✓</span> Unlimited AI Assistant sessions</li>
              <li><span className="feature-check">✓</span> Priority support</li>
              <li><span className="feature-check">✓</span> Advanced terminal customization</li>
              <li><span className="feature-check">✓</span> Custom backgrounds and themes</li>
              <li><span className="feature-check">✓</span> MCP server integrations</li>
            </ul>
          </div>

          <button
            className="license-deactivate-button"
            onClick={handleDeactivateLicense}
          >
            Deactivate License
          </button>
        </div>
      ) : (
        // Free user view
        <div className="license-free">
          <div className="license-badge-container">
            <div className="license-badge-free">
              <span className="license-badge-icon">🆓</span>
              <span className="license-badge-text">Quack Free</span>
            </div>
          </div>

          <div className="license-upgrade-card">
            <h3>Upgrade to Quack Pro</h3>
            <p className="license-upgrade-description">
              Unlock powerful features and take your development workflow to the next level with Quack Pro.
            </p>

            <div className="license-features">
              <h4>Pro Features Include:</h4>
              <ul className="license-features-list">
                <li><span className="feature-check">✓</span> Unlimited AI Assistant sessions</li>
                <li><span className="feature-check">✓</span> Priority support</li>
                <li><span className="feature-check">✓</span> Advanced terminal customization</li>
                <li><span className="feature-check">✓</span> Custom backgrounds and themes</li>
                <li><span className="feature-check">✓</span> MCP server integrations</li>
                <li><span className="feature-check">✓</span> Early access to new features</li>
              </ul>
            </div>

            <div className="license-cta-buttons">
              <button
                className="license-activate-button"
                onClick={() => {
                  // Emit event to open license modal (handled by App.tsx)
                  window.dispatchEvent(new CustomEvent('open-license-modal'));
                }}
              >
                Activate License
              </button>
              <button
                className="license-purchase-button"
                onClick={() => {
                  // Open Lemon Squeezy checkout in browser
                  open('https://quackbuild.lemonsqueezy.com/checkout/buy/69111d6b-9f87-4eeb-a1d6-202980eaa47f');
                }}
              >
                <span className="license-purchase-icon">👑</span>
                Purchase Quack Pro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
