import { useState } from "react";
import {
  Trash2,
  ChevronDown,
  ChevronRight,
  Brain,
  Link2,
} from "lucide-react";
import type { MemoryCategory } from "../../types/memory";
import type { UnifiedMemoryItem as UnifiedMemoryItemType } from "../../services/mcpMemoryService";

/**
 * Unified Memory Item Component
 *
 * Displays MCP memory entities with category badges and actions.
 */

interface UnifiedMemoryItemProps {
  item: UnifiedMemoryItemType;
  onDelete: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  preference: "#3b82f6", // blue
  fact: "#10b981", // green
  decision: "#8b5cf6", // purple
  pattern: "#f97316", // orange
  mistake: "#ef4444", // red
  context: "#6b7280", // gray
  person: "#E84A7F", // rose
  project: "#E84A7F", // rose
  technology: "#00d9ff", // cyan
  tool: "#00d9ff", // cyan
  concept: "#a855f7", // violet
};

export default function UnifiedMemoryItem({
  item,
  onDelete,
}: UnifiedMemoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = item.content.length > 120;

  const handleDelete = () => onDelete(item.id);

  const displayContent =
    !isExpanded && shouldTruncate
      ? item.content.slice(0, 120) + "..."
      : item.content;

  const categoryColor =
    CATEGORY_COLORS[(item.entityType || item.category || "").toLowerCase()] ||
    "#E84A7F";

  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/8 transition-colors">
      {/* Header: Brain Icon + Category */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Brain Icon */}
          <Brain size={14} style={{ color: "#E84A7F" }} />

          {/* Category Badge */}
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: `${categoryColor}20`,
              color: categoryColor,
              border: `1px solid ${categoryColor}40`,
            }}
          >
            {item.entityType || item.category}
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-1">
          {/* Has Relations */}
          {item.relations && item.relations.length > 0 && (
            <span title={`${item.relations.length} relations`}>
              <Link2 size={14} style={{ color: "#E84A7F" }} />
            </span>
          )}
        </div>
      </div>

      {/* Entity Type Label - only show if different from content */}
      {item.entityType && item.entityType !== item.category && (
        <p className="text-xs font-medium mb-1" style={{ color: "#E84A7F" }}>
          {item.entityType}
        </p>
      )}

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

      {/* Relations (expanded) */}
      {isExpanded && item.relations && item.relations.length > 0 && (
        <div className="mb-2 p-2 bg-white/5 rounded border border-white/10">
          <p className="text-xs text-white/50 mb-1">Relations:</p>
          <div className="flex flex-wrap gap-1">
            {item.relations.map((rel, idx) => (
              <span
                key={`${rel.from}-${rel.relationType}-${rel.to}-${idx}`}
                className="text-xs px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: "#E84A7F10",
                  color: "#E84A7F",
                  borderColor: "#E84A7F20",
                }}
              >
                {rel.from === item.entityName
                  ? `${rel.relationType} -> ${rel.to}`
                  : `${rel.from} -> ${rel.relationType}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Metadata + Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div className="flex flex-col gap-0.5 text-xs text-white/40">
          {/* Timestamp */}
          {item.createdAt && (
            <span title={new Date(item.createdAt).toLocaleString()}>
              {formatRelativeTime(item.createdAt)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Delete */}
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
