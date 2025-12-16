import { useState } from "react";
import {
  CheckCircle2,
  Archive,
  Trash2,
  ChevronDown,
  ChevronRight,
  Brain,
  Cloud,
  Link2,
} from "lucide-react";
import type { MemoryCategory } from "../../types/memory";
import type { UnifiedMemoryItem as UnifiedMemoryItemType } from "../../services/mcpMemoryService";

/**
 * Unified Memory Item Component
 *
 * Displays both Quack memories (pattern-based) and MCP entities
 * with source badges and appropriate actions for each type.
 */

interface UnifiedMemoryItemProps {
  item: UnifiedMemoryItemType;
  onVerify?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete: (id: string, source: "quack" | "mcp") => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  preference: "#3b82f6", // blue
  fact: "#10b981", // green
  decision: "#8b5cf6", // purple
  pattern: "#f97316", // orange
  mistake: "#ef4444", // red
  context: "#6b7280", // gray
  person: "#ec4899", // pink
  project: "#14b8a6", // teal
  technology: "#06b6d4", // cyan
  tool: "#84cc16", // lime
  concept: "#a855f7", // violet
};

const CONFIDENCE_COLORS = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#6b7280",
};

const SOURCE_CONFIG = {
  quack: {
    label: "Quack",
    color: "#f28c52",
    icon: Brain,
    description: "Pattern-based extraction",
  },
  mcp: {
    label: "MCP",
    color: "#00d9ff",
    icon: Cloud,
    description: "AI semantic extraction",
  },
};

export default function UnifiedMemoryItem({
  item,
  onVerify,
  onArchive,
  onDelete,
}: UnifiedMemoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = item.content.length > 120;

  const handleVerify = () => onVerify?.(item.id);
  const handleArchive = () => onArchive?.(item.id);
  const handleDelete = () => onDelete(item.id, item.source);

  const displayContent =
    !isExpanded && shouldTruncate
      ? item.content.slice(0, 120) + "..."
      : item.content;

  const categoryColor =
    CATEGORY_COLORS[item.category as MemoryCategory] || CATEGORY_COLORS.context;
  const sourceConfig = SOURCE_CONFIG[item.source];
  const SourceIcon = sourceConfig.icon;

  // Confidence only for Quack memories
  const confidence = item.quackMemory?.confidence;
  const confidenceColor = confidence
    ? CONFIDENCE_COLORS[confidence]
    : undefined;

  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/8 transition-colors">
      {/* Header: Source Badge + Category + Indicators */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Source Badge */}
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: `${sourceConfig.color}15`,
              color: sourceConfig.color,
              border: `1px solid ${sourceConfig.color}30`,
            }}
            title={sourceConfig.description}
          >
            <SourceIcon size={10} />
            {sourceConfig.label}
          </span>

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
          {/* Confidence (Quack only) */}
          {confidenceColor && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: confidenceColor }}
              title={`Confidence: ${confidence}`}
            />
          )}

          {/* Verified (Quack only) */}
          {item.userVerified && (
            <span title="Verified">
              <CheckCircle2 size={14} className="text-green-500" />
            </span>
          )}

          {/* Has Relations (MCP only) */}
          {item.relations && item.relations.length > 0 && (
            <span title={`${item.relations.length} relations`}>
              <Link2 size={14} className="text-cyan-500" />
            </span>
          )}
        </div>
      </div>

      {/* Entity Name (MCP only) */}
      {item.entityName && (
        <p className="text-xs text-cyan-400/80 font-medium mb-1">
          {item.entityName}
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

      {/* Relations (MCP only, expanded) */}
      {isExpanded && item.relations && item.relations.length > 0 && (
        <div className="mb-2 p-2 bg-white/5 rounded border border-white/10">
          <p className="text-xs text-white/50 mb-1">Relations:</p>
          <div className="flex flex-wrap gap-1">
            {item.relations.map((rel, idx) => (
              <span
                key={`${rel.from}-${rel.relationType}-${rel.to}-${idx}`}
                className="text-xs px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20"
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
          {/* Scope (Quack only) */}
          {item.scope && (
            <span>{item.scope === "project" ? "Project" : "Global"}</span>
          )}

          {/* Timestamp */}
          {item.createdAt && (
            <span title={new Date(item.createdAt).toLocaleString()}>
              {formatRelativeTime(item.createdAt)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Verify (Quack only) */}
          {item.source === "quack" && !item.userVerified && onVerify && (
            <button
              type="button"
              onClick={handleVerify}
              className="p-1.5 text-white/40 hover:text-green-500 hover:bg-green-500/10 rounded transition-colors"
              title="Verify"
            >
              <CheckCircle2 size={14} />
            </button>
          )}

          {/* Archive (Quack only) */}
          {item.source === "quack" && !item.isArchived && onArchive && (
            <button
              type="button"
              onClick={handleArchive}
              className="p-1.5 text-white/40 hover:text-yellow-500 hover:bg-yellow-500/10 rounded transition-colors"
              title="Archive"
            >
              <Archive size={14} />
            </button>
          )}

          {/* Delete (both sources) */}
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
