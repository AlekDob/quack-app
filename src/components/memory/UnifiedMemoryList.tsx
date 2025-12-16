import UnifiedMemoryItem from "./UnifiedMemoryItem";
import type { UnifiedMemoryItem as UnifiedMemoryItemType } from "../../services/mcpMemoryService";

/**
 * Unified Memory List Component
 *
 * Renders list of memories from MCP Memory.
 * Shows empty states when no memories exist.
 * Supports grouping by category.
 */

export type GroupMode = "none" | "category";

interface UnifiedMemoryListProps {
  items: UnifiedMemoryItemType[];
  isSearchMode: boolean;
  groupMode?: GroupMode;
  onDelete: (id: string) => void;
}

export default function UnifiedMemoryList({
  items,
  isSearchMode,
  groupMode = "category",
  onDelete,
}: UnifiedMemoryListProps) {
  // Empty states
  if (items.length === 0) {
    if (isSearchMode) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="text-5xl mb-4">&#128269;</div>
          <h4 className="text-base font-semibold mb-2 text-white/70">
            No results found
          </h4>
          <p className="text-sm text-white/50">
            Try adjusting your search query or filters
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="text-5xl mb-4">&#129504;</div>
        <h4
          className="text-base font-semibold mb-2"
          style={{ color: "#E84A7F" }}
        >
          No memories yet
        </h4>
        <p className="text-sm text-white/50 max-w-xs mb-4">
          Memories will be saved here when:
        </p>
        <div className="flex flex-col gap-2 text-left text-xs">
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "#E84A7F15",
                color: "#E84A7F",
                border: "1px solid #E84A7F30",
              }}
            >
              +
            </span>
            <span className="text-white/50">
              You add a memory in Knowledge Graph
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "#E84A7F15",
                color: "#E84A7F",
                border: "1px solid #E84A7F30",
              }}
            >
              AI
            </span>
            <span className="text-white/50">
              AI saves facts automatically during chat
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render based on group mode
  if (!isSearchMode && groupMode !== "none") {
    return renderGroupedItems(items, onDelete);
  }

  // Render flat list for search results or no grouping
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <UnifiedMemoryItem
          key={item.id}
          item={item}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

/**
 * Category colors
 */
const CATEGORY_COLORS: Record<string, string> = {
  preference: "#3b82f6",
  fact: "#10b981",
  decision: "#8b5cf6",
  pattern: "#f97316",
  mistake: "#ef4444",
  context: "#6b7280",
  person: "#E84A7F",
  project: "#E84A7F",
  technology: "#00d9ff",
  tool: "#00d9ff",
};

/**
 * Render items grouped by category
 */
function renderGroupedItems(
  items: UnifiedMemoryItemType[],
  onDelete: (id: string) => void
) {
  // Group items by category
  const grouped = items.reduce(
    (acc, item) => {
      const key = item.entityType || item.category || "other";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, UnifiedMemoryItemType[]>
  );

  // Sort keys alphabetically
  const sortedKeys = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-4">
      {sortedKeys.map((key) => {
        const groupColor = CATEGORY_COLORS[key.toLowerCase()] || "#E84A7F";

        return (
          <div key={key} className="flex flex-col gap-2">
            <h4
              className="text-xs font-semibold uppercase tracking-wide px-1 flex items-center gap-2"
              style={{ color: groupColor }}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
              <span className="text-white/30 font-normal">
                ({grouped[key].length})
              </span>
            </h4>
            <div className="flex flex-col gap-3">
              {grouped[key].map((item) => (
                <UnifiedMemoryItem
                  key={item.id}
                  item={item}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
