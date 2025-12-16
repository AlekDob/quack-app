import UnifiedMemoryItem from "./UnifiedMemoryItem";
import type { UnifiedMemoryItem as UnifiedMemoryItemType } from "../../services/mcpMemoryService";

/**
 * Unified Memory List Component
 *
 * Renders list of memories from both Quack and MCP sources.
 * Shows empty states when no memories exist.
 * Supports grouping by source or category.
 */

export type GroupMode = "none" | "source" | "category";

interface UnifiedMemoryListProps {
  items: UnifiedMemoryItemType[];
  isSearchMode: boolean;
  groupMode?: GroupMode;
  onVerify?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete: (id: string, source: "quack" | "mcp") => void;
}

export default function UnifiedMemoryList({
  items,
  isSearchMode,
  groupMode = "source",
  onVerify,
  onArchive,
  onDelete,
}: UnifiedMemoryListProps) {
  // Filter out archived Quack memories in normal mode
  const filteredItems = isSearchMode
    ? items
    : items.filter(
        (item) => item.source === "mcp" || !item.isArchived
      );

  // Empty states
  if (filteredItems.length === 0) {
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
          style={{ color: "#f28c52" }}
        >
          No memories yet
        </h4>
        <p className="text-sm text-white/50 max-w-xs mb-4">
          Memories will appear here from two sources:
        </p>
        <div className="flex flex-col gap-2 text-left text-xs">
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "#f28c5215",
                color: "#f28c52",
                border: "1px solid #f28c5230",
              }}
            >
              Quack
            </span>
            <span className="text-white/50">
              Type # to save manual memories
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "#00d9ff15",
                color: "#00d9ff",
                border: "1px solid #00d9ff30",
              }}
            >
              MCP
            </span>
            <span className="text-white/50">
              AI automatically saves important facts
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render based on group mode
  if (!isSearchMode && groupMode !== "none") {
    return renderGroupedItems(
      filteredItems,
      groupMode,
      onVerify,
      onArchive,
      onDelete
    );
  }

  // Render flat list for search results or no grouping
  return (
    <div className="flex flex-col gap-3">
      {filteredItems.map((item) => (
        <UnifiedMemoryItem
          key={item.id}
          item={item}
          onVerify={onVerify}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

/**
 * Render items grouped by source or category
 */
function renderGroupedItems(
  items: UnifiedMemoryItemType[],
  groupMode: GroupMode,
  onVerify?: (id: string) => void,
  onArchive?: (id: string) => void,
  onDelete?: (id: string, source: "quack" | "mcp") => void
) {
  // Group items
  const grouped = items.reduce(
    (acc, item) => {
      const key = groupMode === "source" ? item.source : item.category;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, UnifiedMemoryItemType[]>
  );

  // Sort keys
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    // For source grouping, put MCP first (AI memories are more reliable)
    if (groupMode === "source") {
      if (a === "mcp") return -1;
      if (b === "mcp") return 1;
    }
    return a.localeCompare(b);
  });

  const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    mcp: { label: "AI Memory (MCP)", color: "#00d9ff" },
    quack: { label: "Pattern Memory (Quack)", color: "#f28c52" },
  };

  return (
    <div className="flex flex-col gap-4">
      {sortedKeys.map((key) => {
        const groupLabel =
          groupMode === "source"
            ? SOURCE_LABELS[key]?.label || key
            : key.charAt(0).toUpperCase() + key.slice(1);

        const groupColor =
          groupMode === "source"
            ? SOURCE_LABELS[key]?.color || "#6b7280"
            : undefined;

        return (
          <div key={key} className="flex flex-col gap-2">
            <h4
              className="text-xs font-semibold uppercase tracking-wide px-1 flex items-center gap-2"
              style={{ color: groupColor || "rgba(255,255,255,0.5)" }}
            >
              {groupLabel}
              <span className="text-white/30 font-normal">
                ({grouped[key].length})
              </span>
            </h4>
            <div className="flex flex-col gap-3">
              {grouped[key].map((item) => (
                <UnifiedMemoryItem
                  key={item.id}
                  item={item}
                  onVerify={onVerify}
                  onArchive={onArchive}
                  onDelete={onDelete!}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
