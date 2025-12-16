import { useState } from "react";
import {
  CheckCircle2,
  Archive,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { QuackMemory, MemoryCategory } from "../../types/memory";

/**
 * Memory Item Component
 *
 * Single memory card with category badge, confidence indicator,
 * expandable content, and action buttons.
 */

interface MemoryItemProps {
  memory: QuackMemory;
  onVerify: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  preference: "#3b82f6", // blue
  fact: "#10b981", // green
  decision: "#8b5cf6", // purple
  pattern: "#f97316", // orange
  mistake: "#ef4444", // red
  context: "#6b7280", // gray
};

const CONFIDENCE_COLORS = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#6b7280",
};

export default function MemoryItem({
  memory,
  onVerify,
  onArchive,
  onDelete,
}: MemoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = memory.content.length > 120;

  const handleVerify = () => onVerify(memory.id);
  const handleArchive = () => onArchive(memory.id);
  const handleDelete = () => onDelete(memory.id);

  const displayContent =
    !isExpanded && shouldTruncate
      ? memory.content.slice(0, 120) + "..."
      : memory.content;

  const categoryColor = CATEGORY_COLORS[memory.category];
  const confidenceColor = CONFIDENCE_COLORS[memory.confidence];

  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/8 transition-colors">
      {/* Header: Category + Confidence */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: `${categoryColor}20`,
            color: categoryColor,
            border: `1px solid ${categoryColor}40`,
          }}
        >
          {memory.category}
        </span>
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: confidenceColor }}
            title={`Confidence: ${memory.confidence}`}
          />
          {memory.userVerified && (
            <span title="Verified">
              <CheckCircle2 size={14} className="text-green-500" />
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-xs text-white/80 mb-2 leading-relaxed">
        {displayContent}
      </p>

      {/* Expand/Collapse Button */}
      {shouldTruncate && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 mb-2 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronDown size={14} />
              Show less
            </>
          ) : (
            <>
              <ChevronRight size={14} />
              Show more
            </>
          )}
        </button>
      )}

      {/* Footer: Metadata + Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div className="flex flex-col gap-0.5 text-xs text-white/40">
          <span>
            {memory.scope === "project" ? "Project" : "Global"}
          </span>
          <span title={new Date(memory.lastAccessedAt).toLocaleString()}>
            {formatRelativeTime(memory.lastAccessedAt)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {!memory.userVerified && (
            <button
              type="button"
              onClick={handleVerify}
              className="p-1.5 text-white/40 hover:text-green-500 hover:bg-green-500/10 rounded transition-colors"
              title="Verify"
            >
              <CheckCircle2 size={14} />
            </button>
          )}
          {!memory.isArchived && (
            <button
              type="button"
              onClick={handleArchive}
              className="p-1.5 text-white/40 hover:text-yellow-500 hover:bg-yellow-500/10 rounded transition-colors"
              title="Archive"
            >
              <Archive size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}
