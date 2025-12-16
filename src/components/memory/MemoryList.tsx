import MemoryItem from "./MemoryItem";
import type { QuackMemory, MemorySearchResult } from "../../types/memory";

/**
 * Memory List Component
 *
 * Renders list of memories or search results.
 * Shows empty states when no memories exist.
 */

interface MemoryListProps {
  memories: QuackMemory[];
  searchResults: MemorySearchResult[];
  isSearchMode: boolean;
  onVerify: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function MemoryList({
  memories,
  searchResults,
  isSearchMode,
  onVerify,
  onArchive,
  onDelete,
}: MemoryListProps) {
  // Determine which data to display
  const displayMemories = isSearchMode
    ? searchResults.map((r) => r.memory)
    : memories;

  // Filter out archived memories in normal mode
  const filteredMemories = isSearchMode
    ? displayMemories
    : displayMemories.filter((m) => !m.isArchived);

  // Empty states
  if (filteredMemories.length === 0) {
    if (isSearchMode) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="text-5xl mb-4">🔍</div>
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
        <div className="text-5xl mb-4">🧠</div>
        <h4 className="text-base font-semibold mb-2" style={{ color: "#f28c52" }}>
          No memories yet
        </h4>
        <p className="text-sm text-white/50 max-w-xs">
          As you interact with Quack, memories will be automatically extracted
          and stored here for future reference.
        </p>
      </div>
    );
  }

  // Group by category if not in search mode
  if (!isSearchMode) {
    return renderGroupedMemories(filteredMemories, onVerify, onArchive, onDelete);
  }

  // Render flat list for search results
  return (
    <div className="flex flex-col gap-3">
      {filteredMemories.map((memory) => (
        <MemoryItem
          key={memory.id}
          memory={memory}
          onVerify={onVerify}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

/**
 * Render memories grouped by category
 */
function renderGroupedMemories(
  memories: QuackMemory[],
  onVerify: (id: string) => void,
  onArchive: (id: string) => void,
  onDelete: (id: string) => void
) {
  // Group by category
  const grouped = memories.reduce(
    (acc, memory) => {
      if (!acc[memory.category]) {
        acc[memory.category] = [];
      }
      acc[memory.category].push(memory);
      return acc;
    },
    {} as Record<string, QuackMemory[]>
  );

  const categories = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide px-1">
            {category} ({grouped[category].length})
          </h4>
          <div className="flex flex-col gap-3">
            {grouped[category].map((memory) => (
              <MemoryItem
                key={memory.id}
                memory={memory}
                onVerify={onVerify}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
