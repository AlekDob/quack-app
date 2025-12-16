import { useState, useCallback } from "react";
import {
  RefreshCw,
  Brain,
  Database,
} from "lucide-react";
import { useUnifiedMemory } from "../../hooks/useUnifiedMemory";
import MemorySearch, { type SearchFilters } from "./MemorySearch";
import UnifiedMemoryList, { type GroupMode } from "./UnifiedMemoryList";

/**
 * Memory Panel - Main container for MCP Memory UI
 *
 * Displays memories from MCP Memory (knowledge graph).
 * Shows statistics, search, filtering, and memory management.
 */

interface MemoryPanelProps {
  /** Optional session ID */
  sessionId?: string;
  /** Optional project path */
  projectPath?: string;
}

export default function MemoryPanel({
  sessionId,
  projectPath,
}: MemoryPanelProps) {
  const {
    unifiedItems,
    stats,
    isLoading,
    error,
    refresh,
    filterItems,
    deleteMemory,
  } = useUnifiedMemory();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [groupMode, setGroupMode] = useState<GroupMode>("category");

  const isSearchMode = searchQuery.trim().length > 0;

  /**
   * Get filtered items based on current filters
   */
  const filteredItems = filterItems({
    category: searchFilters.category,
    searchQuery: searchQuery || undefined,
  });

  /**
   * Handle search with filters
   */
  const handleSearch = useCallback((query: string, filters: SearchFilters) => {
    setSearchQuery(query);
    setSearchFilters(filters);
  }, []);

  /**
   * Handle delete
   */
  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMemory(id);
    },
    [deleteMemory]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain size={16} style={{ color: "#E84A7F" }} />
            <h3 className="text-sm font-semibold text-white">Memory</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => refresh()}
              disabled={isLoading}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                size={14}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-lg">
            <Database size={14} className="text-white/40" />
            <div className="flex flex-col">
              <span className="text-xs text-white/40">Total</span>
              <span className="text-sm font-semibold text-white">
                {stats.total}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-lg">
            <Brain size={14} style={{ color: "#E84A7F" }} />
            <div className="flex flex-col">
              <span className="text-xs text-white/40">Entities</span>
              <span className="text-sm font-semibold text-white">
                {stats.entities}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-lg">
            <span className="text-xs" style={{ color: "#E84A7F" }}>~</span>
            <div className="flex flex-col">
              <span className="text-xs text-white/40">Relations</span>
              <span className="text-sm font-semibold text-white">
                {stats.relations}
              </span>
            </div>
          </div>
        </div>

        {/* Group By */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-white/50">Group by:</span>
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className="text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
          >
            <option value="category">Category</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      {/* Search */}
      {stats.total > 0 && (
        <div className="px-4 pb-3">
          <MemorySearch
            onSearch={handleSearch}
            resultsCount={isSearchMode ? filteredItems.length : 0}
            isSearching={false}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="px-4 pb-3">
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#EF4444",
            }}
          >
            <p className="font-medium mb-1">Error</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-white/60">
            Loading memories...
          </div>
        ) : (
          <UnifiedMemoryList
            items={filteredItems}
            isSearchMode={isSearchMode}
            groupMode={groupMode}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
