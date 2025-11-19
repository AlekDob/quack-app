import type { MCPTemplate } from "../types";

/**
 * MCP Template Card - Displays an MCP template as a clickable card
 * Used in both empty state and modal for quick template selection
 */

interface MCPTemplateCardProps {
  template: MCPTemplate;
  onClick: (template: MCPTemplate) => void;
}

export default function MCPTemplateCard({
  template,
  onClick,
}: MCPTemplateCardProps) {
  // Icon mapping based on template type
  const getIcon = () => {
    switch (template.type) {
      case "filesystem":
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        );
      case "database":
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        );
      case "github": // mapped to "api" visual
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        );
      case "slack": // mapped to "cloud" visual
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
        );
      case "puppeteer": // mapped to "productivity" visual
      case "playwright":
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      default:
        return (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        );
    }
  };

  return (
    <button
      type="button"
      onClick={() => onClick(template)}
      className="p-4 rounded-lg text-left transition-all duration-200 group"
      style={{
        background: "rgba(12, 16, 24, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(242, 140, 82, 0.08)";
        e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.3)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(12, 16, 24, 0.6)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Icon */}
      <div
        className="mb-3 transition-colors duration-200"
        style={{ color: "rgba(255, 255, 255, 0.4)" }}
      >
        {getIcon()}
      </div>

      {/* Name */}
      <div
        className="text-sm font-semibold mb-1.5 transition-colors duration-200"
        style={{ color: "rgba(255, 255, 255, 0.9)" }}
      >
        {template.name}
      </div>

      {/* Description */}
      <div
        className="text-xs leading-relaxed transition-colors duration-200"
        style={{ color: "rgba(255, 255, 255, 0.5)" }}
      >
        {template.description}
      </div>
    </button>
  );
}
