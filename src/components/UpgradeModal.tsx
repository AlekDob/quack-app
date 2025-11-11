import React from 'react';
import { X, Crown, Check, Sparkles, Zap, Shield } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { FREE_LIMITS } from '../config/features';
import { usePricingConfig, useCheckoutConfig, useFeaturesConfig } from '../hooks/useAppConfig';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateLicense: () => void;
  limitType?: 'terminals' | 'groups' | 'backgrounds' | 'agency' | 'sync';
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onActivateLicense,
  limitType = 'terminals',
}) => {
  const { pricing } = usePricingConfig();
  const { checkout } = useCheckoutConfig();
  const { features } = useFeaturesConfig();

  if (!isOpen) return null;

  // Map badge colors to Tailwind classes (for proper purging)
  const badgeColorClasses = {
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    green: 'bg-green-500/20 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
    orange: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
    red: 'bg-red-500/20 border-red-500/30 text-red-400',
  };

  const badgeClasses = badgeColorClasses[pricing.badge_color as keyof typeof badgeColorClasses] || badgeColorClasses.purple;

  // Generate subscription type text
  const getSubscriptionText = () => {
    if (pricing.billing_period === 'lifetime') {
      return 'Lifetime license';
    } else if (pricing.billing_period === 'year') {
      return 'Annual subscription';
    } else if (pricing.billing_period === 'month') {
      return 'Monthly subscription';
    }
    return 'License';
  };

  const limitMessages = {
    terminals: `You've reached the free tier limit of ${FREE_LIMITS.maxTerminals} agents.`,
    groups: `You've reached the free tier limit of ${FREE_LIMITS.maxGroups} group.`,
    backgrounds: 'Premium backgrounds are locked in the free tier.',
    agency: 'Advanced Quack Agency features require Pro.',
    sync: 'Cloud sync is only available in Pro.',
  };

  const proFeatures = [
    { icon: Zap, text: 'Unlimited Agents', highlight: limitType === 'terminals' },
    { icon: Crown, text: 'Unlimited Groups', highlight: limitType === 'groups' },
    { icon: Sparkles, text: 'Premium Backgrounds', highlight: limitType === 'backgrounds' },
    { icon: Shield, text: 'Advanced Agency Features', highlight: limitType === 'agency' },
    { icon: Check, text: 'Cloud Settings Sync', highlight: limitType === 'sync' },
    { icon: Check, text: 'Auto-Updates' },
    { icon: Check, text: 'Priority Support' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-pink-500/20 border-b border-gray-700 px-6 py-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Upgrade to Pro</h2>
              <p className="text-xs text-gray-300">Unlock all premium features</p>
            </div>
          </div>

          {/* Limit Message */}
          <div className="mt-3 p-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-300">{limitMessages[limitType]}</p>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Pricing */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-5 mb-6">
            <div className="flex items-baseline justify-center gap-2 mb-2">
              {pricing.original_price > pricing.current_price && (
                <span className="text-lg text-gray-400 line-through">
                  {pricing.currency === 'EUR' ? '€' : '$'}{pricing.original_price}
                </span>
              )}
              <span className="text-4xl font-bold text-white">
                {pricing.currency === 'EUR' ? '€' : '$'}{pricing.current_price}
              </span>
              {pricing.billing_period !== 'lifetime' && (
                <span className="text-sm text-gray-400">/{pricing.billing_period}</span>
              )}
            </div>
            <p className="text-center text-xs text-gray-400">
              {getSubscriptionText()} • Use on {features.max_devices === 1 ? '1 device' : `up to ${features.max_devices} devices`}
            </p>
            {pricing.badge_text && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                <span className={`px-2 py-1 border rounded ${badgeClasses}`}>
                  {pricing.badge_text}
                </span>
              </div>
            )}
          </div>

          {/* Features List */}
          <div className="space-y-2.5 mb-6">
            {proFeatures.map((feature, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  feature.highlight
                    ? 'bg-yellow-500/10 border border-yellow-500/30'
                    : 'bg-gray-800/30'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    feature.highlight
                      ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                      : 'bg-gray-700'
                  }`}
                >
                  <feature.icon
                    className={`w-4 h-4 ${feature.highlight ? 'text-white' : 'text-gray-400'}`}
                  />
                </div>
                <span
                  className={`text-sm font-medium ${
                    feature.highlight ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => {
                // Open Gumroad checkout in browser using Tauri shell
                open(checkout.gumroad_url);
              }}
              className="w-full px-6 py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-semibold transition-all shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" />
              Subscribe to Quack Pro
            </button>

            <button
              onClick={onActivateLicense}
              className="w-full px-6 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors text-sm"
            >
              Already have a license? Activate
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-700/50 text-center">
            <p className="text-xs text-gray-500">
              Secure payment via Gumroad • Cancel anytime • 14-day money-back guarantee
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
