import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

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
  label = 'Reveal in Finder',
}: RevealInFinderButtonProps) {
  const handleReveal = async () => {
    try {
      await invoke('reveal_in_finder', { path });
    } catch (err) {
      console.error('Failed to reveal in Finder:', err);
      toast.error(`Failed to reveal in Finder: ${err}`);
    }
  };

  return (
    <button
      onClick={handleReveal}
      className={`reveal-in-finder-button ${className}`}
      title={label}
      type="button"
    >
      {/* Folder icon SVG */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2Z" />
      </svg>
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
