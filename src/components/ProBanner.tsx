import React, { useState } from 'react';
import { Crown, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface ProBannerProps {
  onUpgrade: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const ProBanner: React.FC<ProBannerProps> = ({
  onUpgrade,
  onDismiss,
  dismissible = false,
  isExpanded = true,
  onToggle,
}) => {
  // When collapsed, show compact badge in bottom-right
  if (!isExpanded) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          right: '12px',
          zIndex: 100,
        }}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-yellow-400/20"
          title="Expand Pro banner"
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Upgrade</span>
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // When expanded, show full banner at bottom
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
      className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-t border-yellow-500/50 px-6 py-3 flex items-center justify-between overflow-hidden backdrop-blur-sm"
    >
      {/* Animated sparkles background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <Sparkles className="absolute top-1 left-4 w-3 h-3 text-yellow-400 animate-pulse" />
        <Sparkles className="absolute bottom-2 right-16 w-2 h-2 text-orange-400 animate-pulse delay-200" />
        <Sparkles className="absolute top-2 right-40 w-2.5 h-2.5 text-yellow-300 animate-pulse delay-500" />
      </div>

      {/* Left side: Icon + Text */}
      <div className="flex items-center gap-3 relative z-10 flex-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            Upgrade to <span className="text-yellow-300">Quack Pro</span>
          </p>
          <p className="text-xs text-gray-300">
            Get unlimited <span className="font-medium text-yellow-200">Agents</span> and advanced features
          </p>
        </div>
      </div>

      {/* Right side: Buttons */}
      <div className="flex items-center gap-2 relative z-10">
        {/* Collapse button */}
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Collapse banner"
          >
            <ChevronDown className="w-4 h-4 text-gray-400 hover:text-gray-200" />
          </button>
        )}

        {/* Upgrade button */}
        <button
          onClick={onUpgrade}
          className="px-5 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white text-sm font-semibold transition-all shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:scale-105 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade Now
        </button>

        {/* Dismiss button */}
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-gray-200" />
          </button>
        )}
      </div>
    </div>
  );
};
