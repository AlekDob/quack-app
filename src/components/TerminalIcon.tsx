import { memo } from 'react';

interface TerminalIconProps {
  className?: string;
  size?: number;
}

function TerminalIcon({ className = '', size = 16 }: TerminalIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="1"
        y="2"
        width="14"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M3.5 6L6 8L3.5 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10H10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default memo(TerminalIcon);
export { TerminalIcon };
