import React from 'react';
import { Heart, X, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

interface ProBannerProps {
  onLearnMore: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const ProBanner: React.FC<ProBannerProps> = ({
  onLearnMore,
  onDismiss,
  dismissible = false,
  isExpanded = true,
  onToggle,
}) => {
  // When collapsed, show compact badge
  if (!isExpanded) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
        }}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-emerald-400/20"
          title="Need help getting started?"
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Need help?</span>
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
      className="bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 border-t border-emerald-500/30 px-6 py-3 flex items-center justify-center overflow-hidden backdrop-blur-sm"
    >
      {/* Centered content */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Heart className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            Quack is <span className="text-emerald-300">Free Forever</span>
          </p>
          <p className="text-xs text-gray-300">
            Need help setting up? Check out our <span className="font-medium text-emerald-200">consulting services</span>
          </p>
        </div>

        {/* Learn more button */}
        <button
          onClick={onLearnMore}
          className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:scale-105 flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Learn More
        </button>

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
