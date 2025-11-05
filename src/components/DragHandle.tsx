import React from 'react';

interface DragHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  isDragging?: boolean;
  className?: string;
}

const DragHandle: React.FC<DragHandleProps> = ({ isDragging = false, className = '', ...props }) => {
  return (
    <div
      className={`drag-handle select-none touch-none ${className}`}
      {...props}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        ...props.style,
      }}
    >
      <svg
        width="12"
        height="20"
        viewBox="0 0 12 20"
        fill="currentColor"
        className={`
          transition-opacity duration-200
          ${isDragging ? 'opacity-80' : 'opacity-0 group-hover:opacity-60'}
        `}
        style={{ pointerEvents: 'none' }}
      >
        {/* Two columns of dots for the drag handle */}
        <circle cx="3" cy="4" r="1.5" />
        <circle cx="9" cy="4" r="1.5" />
        <circle cx="3" cy="10" r="1.5" />
        <circle cx="9" cy="10" r="1.5" />
        <circle cx="3" cy="16" r="1.5" />
        <circle cx="9" cy="16" r="1.5" />
      </svg>
    </div>
  );
};

export default DragHandle;