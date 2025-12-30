import { useIDEStore, selectHasPreferredIDE } from '../stores/ideStore';

interface OpenInIDEButtonProps {
  path: string;
  line?: number;
  className?: string;
  iconOnly?: boolean;
}

export default function OpenInIDEButton({
  path,
  line,
  className = '',
  iconOnly = true,
}: OpenInIDEButtonProps) {
  const hasPreferredIDE = useIDEStore(selectHasPreferredIDE);
  const openFileInIDE = useIDEStore((state) => state.openFileInIDE);

  // Don't render if no IDE is configured
  if (!hasPreferredIDE) {
    return null;
  }

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click handlers
    try {
      await openFileInIDE(path, line);
    } catch (err) {
      console.error('Failed to open in IDE:', err);
    }
  };

  return (
    <button
      onClick={handleOpen}
      className={`open-in-ide-button ${className}`}
      title="Open in IDE"
      type="button"
    >
      {/* IDE icon SVG - compact size to match @ button */}
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
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 8l3 3-3 3" />
        <path d="M13 11h4" />
      </svg>
      {!iconOnly && <span>Open in IDE</span>}
    </button>
  );
}
