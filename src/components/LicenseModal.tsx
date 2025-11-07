import React, { useState } from 'react';
import { X, Key, Loader2, CheckCircle, XCircle, Crown } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { saveLicenseData, type LicenseData } from '../config/features';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ValidationResponse {
  valid: boolean;
  license_data?: {
    key: string;
    email?: string;
    activated_at: number;
    expires_at?: number;
    license_type: string;
    valid: boolean;
  };
  error?: string;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);

  if (!isOpen) return null;

  const handleValidate = async () => {
    if (!licenseKey.trim()) {
      setValidationError('Please enter a license key');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(false);

    try {
      const response = await invoke<ValidationResponse>('validate_license', {
        licenseKey: licenseKey.trim(),
      });

      if (response.valid && response.license_data) {
        // Convert snake_case to camelCase for frontend
        const licenseData: LicenseData = {
          key: response.license_data.key,
          email: response.license_data.email,
          activatedAt: response.license_data.activated_at,
          expiresAt: response.license_data.expires_at,
          type: response.license_data.license_type as 'lifetime' | 'subscription',
          valid: response.license_data.valid,
        };

        // Save license data
        saveLicenseData(licenseData);

        setValidationSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setValidationError(response.error || 'Invalid license key');
      }
    } catch (error) {
      console.error('License validation error:', error);
      setValidationError(error instanceof Error ? error.message : 'Failed to validate license');
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleValidate();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Activate Quack Pro</h2>
              <p className="text-xs text-gray-400">Enter your license key</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* License Key Input */}
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Key className="w-4 h-4" />
              License Key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all font-mono text-sm"
              disabled={isValidating || validationSuccess}
            />
          </div>

          {/* Validation Messages */}
          {validationError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Validation Failed</p>
                <p className="text-xs text-red-300/80 mt-1">{validationError}</p>
              </div>
            </div>
          )}

          {validationSuccess && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-400">License Activated!</p>
                <p className="text-xs text-green-300/80 mt-1">Welcome to Quack Pro 🦆</p>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Your license key was sent to your email after purchase. If you haven't received it,
              check your spam folder or contact support.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
              disabled={isValidating}
            >
              Cancel
            </button>
            <button
              onClick={handleValidate}
              disabled={isValidating || validationSuccess || !licenseKey.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating...
                </>
              ) : validationSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Activated
                </>
              ) : (
                'Activate License'
              )}
            </button>
          </div>

          {/* Footer Link */}
          <div className="mt-4 pt-4 border-t border-gray-700/50 text-center">
            <p className="text-xs text-gray-500">
              Don't have a license?{' '}
              <a
                href="https://quack-app.com/buy" // Replace with actual URL
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                Purchase Quack Pro
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
