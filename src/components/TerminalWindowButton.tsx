import './TerminalWindowButton.css';

interface TerminalWindowButtonProps {
  onCreateTerminal: () => void;
  disabled?: boolean;
}

export default function TerminalWindowButton({
  onCreateTerminal,
  disabled = false,
}: TerminalWindowButtonProps) {
  return (
    <button
      type="button"
      className="terminal-tool-button terminal-window-button"
      onClick={onCreateTerminal}
      disabled={disabled}
      data-tooltip="New Terminal Tab"
      aria-label="Create new terminal tab"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {/* Terminal window */}
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        {/* Terminal prompt line */}
        <path d="M4 6l2 1.5L4 9" strokeLinecap="round" strokeLinejoin="round" />
        {/* Plus icon */}
        <path d="M9 7.5v3M7.5 9h3" strokeLinecap="round" />
      </svg>
    </button>
  );
}
