import React from 'react';

const SettingsSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full bg-[#0a0a0a] rounded-lg p-6 animate-pulse">
      {/* Settings Header */}
      <div className="mb-6">
        <div className="h-8 w-32 bg-[#2a2a2a] rounded mb-2"></div>
        <div className="h-4 w-48 bg-[#1a1a1a] rounded"></div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-24 bg-[#2a2a2a] rounded-md flex-shrink-0"></div>
        ))}
      </div>

      {/* Settings Content */}
      <div className="space-y-6">
        {/* Setting Group 1 */}
        <div className="border border-[#2a2a2a] rounded-lg p-4">
          <div className="h-5 w-36 bg-[#2a2a2a] rounded mb-3"></div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-[#1a1a1a] rounded"></div>
              <div className="h-6 w-12 bg-[#2a2a2a] rounded-full"></div>
            </div>
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 bg-[#1a1a1a] rounded"></div>
              <div className="h-6 w-12 bg-[#2a2a2a] rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Setting Group 2 */}
        <div className="border border-[#2a2a2a] rounded-lg p-4">
          <div className="h-5 w-28 bg-[#2a2a2a] rounded mb-3"></div>
          <div className="space-y-3">
            <div className="h-10 w-full bg-[#1a1a1a] rounded"></div>
            <div className="h-10 w-full bg-[#1a1a1a] rounded"></div>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
        <div className="text-gray-500 flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          Loading settings...
        </div>
      </div>
    </div>
  );
};

export default SettingsSkeleton;