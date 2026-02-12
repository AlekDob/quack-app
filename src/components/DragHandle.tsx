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
        width="8"
        height="14"
        viewBox="0 0 8 14"
        fill="currentColor"
        className={`
          transition-opacity duration-200
          ${isDragging ? 'opacity-80' : 'opacity-0 group-hover:opacity-60'}
        `}
        style={{ pointerEvents: 'none' }}
      >
        {/* Two columns of dots for the drag handle */}
        <circle cx="2" cy="3" r="1.2" />
        <circle cx="6" cy="3" r="1.2" />
        <circle cx="2" cy="7" r="1.2" />
        <circle cx="6" cy="7" r="1.2" />
        <circle cx="2" cy="11" r="1.2" />
        <circle cx="6" cy="11" r="1.2" />
      </svg>
    </div>
  );
};

export default DragHandle;