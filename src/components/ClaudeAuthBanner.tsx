import React, { useState } from 'react';
import { AlertCircle, X, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

interface ClaudeAuthBannerProps {
  onOpenSettings: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const ClaudeAuthBanner: React.FC<ClaudeAuthBannerProps> = ({
  onOpenSettings,
  onDismiss,
  dismissible = true,
  isExpanded = true,
  onToggle,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggle = () => {
    if (isExpanded) {
      setIsAnimating(true);
      setTimeout(() => {
        onToggle?.();
        setIsAnimating(false);
      }, 400);
    } else {
      onToggle?.();
    }
  };

  // Collapsed state - small badge
  if (!isExpanded) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          animation: 'popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        }}
      >
        <style>{`
          @keyframes popIn {
            0% {
              transform: translateX(-50%) scale(0) rotate(-180deg);
              opacity: 0;
            }
            100% {
              transform: translateX(-50%) scale(1) rotate(0deg);
              opacity: 1;
            }
          }
        `}</style>
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-orange-400/20"
          title="Expand authentication notice"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Auth Required</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Expanded state - full banner at bottom
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        animation: isAnimating
          ? 'slideDownFadeOut 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards'
          : 'slideUpFadeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      className="bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 border-t border-orange-500/50 px-6 py-4 flex items-start justify-between overflow-hidden backdrop-blur-sm"
    >
      <style>{`
        @keyframes slideDownFadeIn {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slideUpFadeOut {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-100%) scale(0.8);
            opacity: 0;
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
      `}</style>

      {/* Animated warning icon background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <AlertCircle
          className="absolute top-2 left-8 w-4 h-4 text-orange-400"
          style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
        />
        <AlertCircle
          className="absolute bottom-2 right-20 w-3 h-3 text-red-400"
          style={{ animation: 'pulse-glow 2s ease-in-out infinite 0.5s' }}
        />
      </div>

      {/* Left side: Icon + Text */}
      <div className="flex items-start gap-3 relative z-10 flex-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <AlertCircle className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white mb-1">
            Claude Code CLI Not Available
          </p>
          <p className="text-xs text-gray-200 mb-2">
            To use AI chat features, please authenticate Claude Code from your terminal:
          </p>
          <ol className="text-xs text-gray-200 space-y-1 list-decimal list-inside">
            <li className="flex items-center gap-2">
              <Terminal className="w-3 h-3 text-orange-300 flex-shrink-0" />
              <span>
                Run: <code className="px-1.5 py-0.5 bg-black/30 rounded text-orange-200 font-mono">claude /login</code>
              </span>
            </li>
            <li>Follow the authentication process in your browser</li>
            <li>Restart Quack to detect the credentials</li>
          </ol>
        </div>
      </div>

      {/* Right side: Buttons */}
      <div className="flex items-center gap-2 relative z-10">
        {/* Collapse button */}
        {onToggle && (
          <button
            onClick={handleToggle}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Collapse banner"
          >
            <ChevronDown className="w-4 h-4 text-gray-400 hover:text-gray-200" />
          </button>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white text-sm font-semibold transition-all shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-105 flex items-center gap-2"
        >
          <Terminal className="w-4 h-4" />
          Open Settings
        </button>

        {/* Dismiss button */}
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 transition-all hover:scale-105"
            title="Dismiss banner (will show again on restart)"
          >
            <X className="w-5 h-5 text-white/80 hover:text-red-300" />
          </button>
        )}
      </div>
    </div>
  );
};
