import React, { useState } from 'react';
import { X, Crown, Check, Sparkles, Zap, Shield, Infinity } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { FREE_LIMITS } from '../config/features';

const GUMROAD_SUBSCRIPTION_URL = 'https://alekdob.gumroad.com/l/hmrki';
const GUMROAD_LIFETIME_URL = 'https://alekdob.gumroad.com/l/tsvgt';

type PlanTab = 'subscription' | 'lifetime';

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
  const [selectedPlan, setSelectedPlan] = useState<PlanTab>('subscription');

  if (!isOpen) return null;

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

  const handlePurchase = () => {
    const url = selectedPlan === 'lifetime'
      ? GUMROAD_LIFETIME_URL
      : GUMROAD_SUBSCRIPTION_URL;
    open(url);
  };

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
          {/* Plan Toggle */}
          <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
            <button
              onClick={() => setSelectedPlan('subscription')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                selectedPlan === 'subscription'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Subscription
            </button>
            <button
              onClick={() => setSelectedPlan('lifetime')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                selectedPlan === 'lifetime'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Lifetime
            </button>
          </div>

          {/* Pricing Card */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-5 mb-6">
            {selectedPlan === 'subscription' ? (
              <>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="px-2 py-0.5 border rounded text-xs bg-yellow-500/20 border-yellow-500/30 text-yellow-400">
                    Early Bird
                  </span>
                </div>
                <div className="flex items-baseline justify-center gap-2 mb-1">
                  <span className="text-lg text-gray-500 line-through">&euro;15</span>
                  <span className="text-4xl font-bold text-white">&euro;9</span>
                  <span className="text-sm text-gray-400">/month</span>
                </div>
                <p className="text-center text-xs text-gray-400 mb-2">
                  or <span className="text-gray-500 line-through">&euro;159</span> &euro;89/year (save 2 months)
                </p>
                <p className="text-center text-xs text-gray-500">
                  Cancel anytime - up to 3 devices
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="px-2 py-0.5 border rounded text-xs bg-yellow-500/20 border-yellow-500/30 text-yellow-400">
                    Early Bird
                  </span>
                </div>
                <div className="flex items-baseline justify-center gap-2 mb-1">
                  <span className="text-lg text-gray-500 line-through">&euro;399</span>
                  <span className="text-4xl font-bold text-white">&euro;179</span>
                </div>
                <p className="text-center text-xs text-gray-400 mb-2">
                  One-time payment - forever yours
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                  <span className="px-2 py-1 border rounded bg-purple-500/20 border-purple-500/30 text-purple-400">
                    + 1h Onboarding with the founder
                  </span>
                </div>
              </>
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
            {selectedPlan === 'lifetime' && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-purple-400 to-purple-600">
                  <Infinity className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-purple-400">
                  Lifetime updates + 1h onboarding
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handlePurchase}
              className="w-full px-6 py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-semibold transition-all shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" />
              {selectedPlan === 'lifetime' ? 'Buy Lifetime License' : 'Subscribe to Quack Pro'}
            </button>

            <button
              onClick={onActivateLicense}
              className="w-full px-6 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors text-sm"
            >
              Already have a license? Activate
            </button>
          </div>

          {/* Indie message */}
          <div className="mt-5 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
            <p className="text-sm text-orange-300/90">
              Built with love by two indie devs from Italy 🍕🇮🇹
            </p>
            <p className="text-xs text-orange-400/70 mt-0.5">
              Your support keeps Quack alive and quacking! 🦆
            </p>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Secure payment via Gumroad • 14-day money-back guarantee
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
