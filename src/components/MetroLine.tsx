import React from 'react';

interface MetroLineProps {
  color: string;
  height?: number;
  showDot?: boolean;
  dotType?: 'station' | 'fork';
}

/**
 * MetroLine - Ultra-minimal metro map style connector
 * Inspired by Moscow Metro Map - clean, simple, effective
 */
export default function MetroLine({
  color,
  height = 40,
  showDot = false,
  dotType = 'station'
}: MetroLineProps) {
  return (
    <div className="metro-line-container" style={{ position: 'absolute', left: '16px', height: `${height}px` }}>
      {/* The actual metro line - SUPER THIN */}
      <div
        className="metro-line"
        style={{
          position: 'absolute',
          left: '4px',
          top: 0,
          width: '2px', // MAX 2px as per requirements!
          height: '100%',
          background: color,
          opacity: 0.8,
        }}
      />

      {/* Metro station dot */}
      {showDot && (
        <div
          className="metro-dot"
          style={{
            position: 'absolute',
            left: dotType === 'fork' ? '1px' : '2px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: dotType === 'fork' ? '12px' : '8px',
            height: dotType === 'fork' ? '12px' : '8px',
            borderRadius: dotType === 'fork' ? '2px' : '50%',
            background: 'white',
            border: `2px solid ${color}`,
            zIndex: 10,
            ...(dotType === 'fork' && {
              background: `linear-gradient(135deg, #10b981 0%, #0891b2 100%)`,
              transform: 'translateY(-50%) rotate(45deg)',
            })
          }}
        />
      )}
    </div>
  );
}