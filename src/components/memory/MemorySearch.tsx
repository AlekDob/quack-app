import { useState, useEffect, useCallback } from "react";
import { Search, Filter } from "lucide-react";
import type { MemoryCategory, MemoryScope } from "../../types/memory";

/**
 * Memory Search Component
 *
 * Search input with debounce and filter dropdowns for category and scope.
 * Compact design for sidebar usage.
 */

interface MemorySearchProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  resultsCount: number;
  isSearching: boolean;
}

export interface SearchFilters {
  category?: MemoryCategory;
  scope?: MemoryScope;
}

const CATEGORIES: { value: MemoryCategory; label: string }[] = [
  { value: "preference", label: "Preferences" },
  { value: "fact", label: "Facts" },
  { value: "decision", label: "Decisions" },
  { value: "pattern", label: "Patterns" },
  { value: "mistake", label: "Mistakes" },
  { value: "context", label: "Context" },
];

const SCOPES: { value: MemoryScope; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "project", label: "Project" },
];

export default function MemorySearch({
  onSearch,
  resultsCount,
  isSearching,
}: MemorySearchProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query, filters);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filters, onSearch]);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setFilters((prev) => ({
      ...prev,
      category: category ? (category as MemoryCategory) : undefined,
    }));
  }, []);

  const handleScopeChange = useCallback((scope: string) => {
    setFilters((prev) => ({
      ...prev,
      scope: scope ? (scope as MemoryScope) : undefined,
    }));
  }, []);

  const hasActiveFilters = !!(filters.category || filters.scope);

  return (
    <div className="flex flex-col gap-2">
      {/* Search Input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          size={16}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memories..."
          className="w-full pl-9 pr-20 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#f28c52]/50"
        />
        {query && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
            {isSearching ? "..." : `${resultsCount}`}
          </span>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <Filter size={14} />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 bg-[#f28c52]/20 text-[#f28c52] rounded text-xs">
              {Object.keys(filters).filter((k) => filters[k as keyof SearchFilters]).length}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter Dropdowns */}
      {showFilters && (
        <div className="flex flex-col gap-2 p-3 bg-white/5 border border-white/10 rounded-lg">
          {/* Category Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Category</label>
            <select
              value={filters.category || ""}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#f28c52]/50"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Scope</label>
            <select
              value={filters.scope || ""}
              onChange={(e) => handleScopeChange(e.target.value)}
              className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#f28c52]/50"
            >
              <option value="">All scopes</option>
              {SCOPES.map((scope) => (
                <option key={scope.value} value={scope.value}>
                  {scope.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
