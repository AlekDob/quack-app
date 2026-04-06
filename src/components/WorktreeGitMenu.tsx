// Brain: fix-worktree-hooks-violation
// Git operations dropdown menu, extracted from WorktreeAgentCard to keep files under 300 lines

import type { TerminalInfo } from "../types";

interface WorktreeGitMenuProps {
  agent: TerminalInfo;
  onOperation: (operation: string, agent: TerminalInfo) => void;
  onClose: () => void;
}

interface MenuItemProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}

function MenuItem({ onClick, icon, label, danger = false }: MenuItemProps) {
  const color = danger ? "rgba(231, 76, 60, 0.9)" : "rgba(255, 255, 255, 0.9)";
  const hoverBg = danger ? "rgba(231, 76, 60, 0.1)" : "rgba(78, 205, 196, 0.1)";

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="menu-item"
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        width: "100%", padding: "10px 12px", background: "transparent",
        border: "none", color, fontSize: "13px",
        cursor: "pointer", borderRadius: "4px", transition: "background 0.2s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
        {icon}
      </svg>
      {label}
    </button>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.1)", margin: "4px 8px" }} />;
}

export default function WorktreeGitMenu({ agent, onOperation, onClose }: WorktreeGitMenuProps) {
  function op(operation: string) {
    onOperation(operation, agent);
    onClose();
  }

  return (
    <div className="git-operations-menu" style={{
      position: "absolute", top: "100%", right: "8px", marginTop: "4px",
      background: "rgba(20, 22, 28, 0.98)", border: "1px solid rgba(255, 255, 255, 0.1)",
      borderRadius: "8px", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
      minWidth: "200px", zIndex: 9999, overflow: "hidden",
    }}>
      <div className="menu-items" style={{ padding: "4px" }}>
        <MenuItem onClick={() => op("pull")} label="Pull latest"
          icon={<path d="M8 12L4 8h3V2h2v6h3l-4 4zm-6 2h12v2H2v-2z" />} />
        <MenuItem onClick={() => op("push")} label="Push to remote"
          icon={<path d="M8 4L4 8h3v6h2V8h3L8 4zM2 2h12v2H2V2z" />} />
        <MenuItem onClick={() => op("create-pr")} label="Create PR"
          icon={<path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346z" />} />
        <Divider />
        <MenuItem onClick={() => op("view-commits")} label="View commits"
          icon={<path d="M10.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z" />} />
        <Divider />
        <MenuItem onClick={() => op("delete-worktree")} label="Delete worktree" danger
          icon={<path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />} />
      </div>
    </div>
  );
}
