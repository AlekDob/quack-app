import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { getFileManagerName } from '../utils/platform';

interface RevealInFinderButtonProps {
  path: string;
  className?: string;
  iconOnly?: boolean;
  label?: string;
}

export default function RevealInFinderButton({
  path,
  className = '',
  iconOnly = false,
  label,
}: RevealInFinderButtonProps) {
  const fileManagerName = getFileManagerName();
  const displayLabel = label ?? `Reveal in ${fileManagerName}`;

  const handleReveal = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening file when clicking reveal button
    try {
      await invoke('reveal_in_finder', { path });
    } catch (err) {
      console.error(`Failed to reveal in ${fileManagerName}:`, err);
      toast.error(`Failed to reveal in ${fileManagerName}: ${err}`);
    }
  };

  return (
    <button
      onClick={handleReveal}
      className={`reveal-in-finder-btn ${className}`}
      title={displayLabel}
      type="button"
    >
      {/* Folder icon SVG - compact size to match @ button */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2Z" />
      </svg>
      {!iconOnly && <span>{displayLabel}</span>}
    </button>
  );
}
