import React from 'react';
import { X, Rocket, Users, Check, BookOpen, Award } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

const GUMROAD_SETUP_URL = 'https://alekdob.gumroad.com/l/tsvgt';
const GUMROAD_EXPERT_URL = 'https://alekdob.gumroad.com/l/nwuhis';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateLicense: () => void;
  limitType?: 'terminals' | 'groups' | 'backgrounds' | 'agency' | 'sync';
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-green-500/20 via-emerald-500/20 to-teal-500/20 border-b border-gray-700 px-6 py-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Quack is Free Forever</h2>
              <p className="text-xs text-gray-300">Need help getting started? We&apos;ve got you covered.</p>
            </div>
          </div>

          <div className="mt-3 p-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-300">
              All features are unlocked — unlimited agents, groups, backgrounds, and more.
              Our consulting services help you get the most out of Quack.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Setup Card */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Quack Setup &amp; Onboarding</h3>
                <p className="text-xs text-gray-400">1 hour personal session</p>
              </div>
              <span className="ml-auto text-lg font-bold text-white">&euro;79</span>
            </div>

            <div className="space-y-1.5 mb-4">
              {[
                'CLAUDE.md & workspace setup',
                'Agent & skill configuration',
                'MCP integrations',
                '2 weeks Discord follow-up',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-300">
                  <Check className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => open(GUMROAD_SETUP_URL)}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              Book Setup — &euro;79
            </button>
          </div>

          {/* Expert Card */}
          <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-yellow-500 flex items-center justify-center flex-shrink-0">
                <Award className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Quack Expert</h3>
                <p className="text-xs text-gray-400">2 hours + resell consulting</p>
              </div>
              <span className="ml-auto text-lg font-bold text-white">&euro;149</span>
            </div>

            <div className="space-y-1.5 mb-4">
              {[
                '2 hours of expert setup',
                'Advanced agent & MCP setup',
                'Dedicated Discord channel',
                'Listed on Quack Experts page',
                'Resell Quack consulting',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-300">
                  <Check className="w-3 h-3 text-orange-400 flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => open(GUMROAD_EXPERT_URL)}
              className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-400 hover:to-yellow-400 text-white text-sm font-semibold transition-colors"
            >
              Become an Expert — &euro;149
            </button>
          </div>

          {/* Enterprise CTA */}
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-gray-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">Enterprise</h3>
                <p className="text-xs text-gray-400">Team setup, training & custom agents — from &euro;299</p>
              </div>
              <button
                onClick={() => open('mailto:quack@quack.build')}
                className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors"
              >
                Contact us
              </button>
            </div>
          </div>

          {/* Indie message */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-sm text-emerald-300/90">
              Quack is free forever — built with love from Italy &amp; Sweden
            </p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              Our consulting keeps Quack alive and quacking! 🦆
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
