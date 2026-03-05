import React from 'react';

const ModalSkeleton: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1a1a1a] rounded-lg p-6 w-96 animate-pulse">
        {/* Modal Header */}
        <div className="mb-4">
          <div className="h-6 w-32 bg-[#2a2a2a] rounded"></div>
        </div>

        {/* Modal Content */}
        <div className="space-y-3">
          <div className="h-4 w-full bg-[#2a2a2a] rounded"></div>
          <div className="h-4 w-3/4 bg-[#2a2a2a] rounded"></div>
          <div className="h-4 w-5/6 bg-[#2a2a2a] rounded"></div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <div className="h-10 w-24 bg-[#2a2a2a] rounded-md"></div>
          <div className="h-10 w-24 bg-[#2a2a2a] rounded-md"></div>
        </div>

        {/* Loading indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500 flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Loading...
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalSkeleton;