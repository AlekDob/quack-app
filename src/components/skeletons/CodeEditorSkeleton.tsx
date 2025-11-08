import React from 'react';

const CodeEditorSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full bg-[#1a1a1a] rounded-lg overflow-hidden animate-pulse">
      {/* Editor header bar */}
      <div className="h-10 bg-[#2a2a2a] border-b border-[#3a3a3a] flex items-center px-4">
        <div className="w-24 h-5 bg-[#3a3a3a] rounded"></div>
      </div>

      {/* Line numbers and code area */}
      <div className="flex h-[calc(100%-40px)]">
        {/* Line numbers */}
        <div className="w-12 bg-[#252525] border-r border-[#3a3a3a] p-2">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="h-5 mb-1">
              <div className="w-4 h-3 bg-[#3a3a3a] rounded mx-auto"></div>
            </div>
          ))}
        </div>

        {/* Code content */}
        <div className="flex-1 p-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="mb-2">
              <div
                className="h-4 bg-[#3a3a3a] rounded"
                style={{ width: `${Math.random() * 50 + 30}%` }}
              ></div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="text-gray-400 flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          Loading editor...
        </div>
      </div>
    </div>
  );
};

export default CodeEditorSkeleton;