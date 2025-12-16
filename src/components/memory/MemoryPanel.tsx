import { useState, useCallback } from "react";
import {
  RefreshCw,
  Settings,
  Brain,
  Cloud,
  Database,
  Sparkles,
  Loader2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useUnifiedMemory } from "../../hooks/useUnifiedMemory";
import MemorySearch, { type SearchFilters } from "./MemorySearch";
import UnifiedMemoryList, { type GroupMode } from "./UnifiedMemoryList";
import { analyzeCurrentSession } from "../../services/memoryIntegration";
import type { MemorySource } from "../../types/memory";

/**
 * Memory Panel - Main container for Quack Memory UI
 *
 * Displays unified memories from both Quack (pattern-based) and MCP (AI) sources.
 * Shows statistics, search, filtering, and memory management.
 */

interface MemoryPanelProps {
  /** Optional API key for LLM-based features */
  apiKey?: string;
  /** Optional session ID */
  sessionId?: string;
  /** Optional project path */
  projectPath?: string;
  /** Optional conversation messages for session analysis */
  messages?: Array<{ role: string; content: string }>;
}

export default function MemoryPanel({
  apiKey,
  sessionId,
  projectPath,
  messages = [],
}: MemoryPanelProps) {
  const {
    unifiedItems,
    settings,
    stats,
    isLoading,
    error,
    refresh,
    filterItems,
    verifyMemory,
    archiveMemory,
    deleteMemory,
    extractQuackMemories,
  } = useUnifiedMemory();

  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<MemorySource | "all">("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("source");

  const isSearchMode = searchQuery.trim().length > 0;

  /**
   * Get filtered items based on current filters
   */
  const filteredItems = filterItems({
    source: sourceFilter === "all" ? undefined : sourceFilter,
    category: searchFilters.category,
    searchQuery: searchQuery || undefined,
  });

  /**
   * Handle session analysis with LLM
   */
  const handleAnalyzeSession = useCallback(async () => {
    if (!apiKey) {
      toast.error("API key required for session analysis");
      return;
    }

    if (messages.length < 2) {
      toast.error("Not enough messages to analyze");
      return;
    }

    setIsAnalyzing(true);
    try {
      const count = await analyzeCurrentSession(
        messages,
        apiKey,
        sessionId,
        projectPath
      );

      if (count > 0) {
        refresh();
        toast.success(`Extracted ${count} memories from session`);
      } else {
        toast.info("No new memories found in session");
      }
    } catch (err) {
      console.error("[MemoryPanel] Analysis failed:", err);
      toast.error("Session analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [apiKey, messages, sessionId, projectPath, refresh]);

  /**
   * Handle search with filters
   */
  const handleSearch = useCallback((query: string, filters: SearchFilters) => {
    setSearchQuery(query);
    setSearchFilters(filters);
  }, []);

  /**
   * Handle delete with source awareness
   */
  const handleDelete = useCallback(
    async (id: string, source: "quack" | "mcp") => {
      await deleteMemory(id, source);
    },
    [deleteMemory]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-[#f28c52]" />
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
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Statistics */}
        {!showSettings && (
          <>
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
                <Brain size={14} className="text-[#f28c52]" />
                <div className="flex flex-col">
                  <span className="text-xs text-white/40">Quack</span>
                  <span className="text-sm font-semibold text-white">
                    {stats.quack}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-lg">
                <Cloud size={14} className="text-[#00d9ff]" />
                <div className="flex flex-col">
                  <span className="text-xs text-white/40">MCP</span>
                  <span className="text-sm font-semibold text-white">
                    {stats.mcp}
                  </span>
                </div>
              </div>
            </div>

            {/* Source Filter Tabs */}
            <div className="flex gap-1 mb-3">
              {(["all", "mcp", "quack"] as const).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSourceFilter(source)}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    sourceFilter === source
                      ? source === "mcp"
                        ? "bg-[#00d9ff]/20 text-[#00d9ff] border border-[#00d9ff]/30"
                        : source === "quack"
                          ? "bg-[#f28c52]/20 text-[#f28c52] border border-[#f28c52]/30"
                          : "bg-white/10 text-white border border-white/20"
                      : "bg-white/5 text-white/50 hover:bg-white/10 border border-transparent"
                  }`}
                >
                  {source === "all"
                    ? "All"
                    : source === "mcp"
                      ? "AI (MCP)"
                      : "Pattern"}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Analyze Session Button */}
        {!showSettings && apiKey && messages.length >= 2 && (
          <button
            type="button"
            onClick={handleAnalyzeSession}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 bg-gradient-to-r from-[#f28c52]/20 to-[#f28c52]/10 hover:from-[#f28c52]/30 hover:to-[#f28c52]/20 border border-[#f28c52]/30 rounded-lg text-sm text-[#f28c52] transition-all disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Analyze Session
              </>
            )}
          </button>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Enabled</span>
              <span className="text-xs text-white/80">
                {settings.enabled ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Auto Extract</span>
              <span className="text-xs text-white/80">
                {settings.autoExtract ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Extraction Mode</span>
              <span className="text-xs text-white/80 capitalize">
                {settings.extractionMode || "hybrid"}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Group By</span>
              <select
                value={groupMode}
                onChange={(e) => setGroupMode(e.target.value as GroupMode)}
                className="text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
              >
                <option value="source">Source</option>
                <option value="category">Category</option>
                <option value="none">None</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Max Memories</span>
              <span className="text-xs text-white/80">
                {settings.maxMemories}
              </span>
            </div>

            {/* Tips */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-white/50 font-medium mb-2">Tips:</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <span
                    className="px-1 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: "#f28c5215",
                      color: "#f28c52",
                    }}
                  >
                    #
                  </span>
                  <span className="text-xs text-white/40">
                    Type # to save a manual memory
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className="px-1 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: "#00d9ff15",
                      color: "#00d9ff",
                    }}
                  >
                    MCP
                  </span>
                  <span className="text-xs text-white/40">
                    AI saves important facts automatically
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
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
            onVerify={verifyMemory}
            onArchive={archiveMemory}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
