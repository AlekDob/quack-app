import './FileDiffButton.css';

interface FileDiffButtonProps {
  filePath: string;
  onDiffClick: (filePath: string) => void;
  disabled?: boolean;
}

/**
 * FileDiffButton - Button to open diff viewer for a file
 *
 * Displays a "Diff" button with an icon that opens the DiffDrawer
 * to show file changes. Used in EditSummaryBar for each modified file.
 *
 * Inspired by Cursor's diff navigation
 */
export default function FileDiffButton({ filePath, onDiffClick, disabled = false }: FileDiffButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger parent onClick
    onDiffClick(filePath);
  };

  return (
    <button
      className="file-diff-btn"
      onClick={handleClick}
      disabled={disabled}
      title="View file differences"
      type="button"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Split view icon - two rectangles */}
        <rect x="3" y="3" width="8" height="18" />
        <rect x="13" y="3" width="8" height="18" />
      </svg>
      <span>Diff</span>
    </button>
  );
}
