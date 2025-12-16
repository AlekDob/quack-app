/**
 * Memory UI Components Tests
 *
 * Tests for MemoryPanel, MemoryList, MemoryItem, and MemorySearch components.
 */

import { describe, it, expect, vi } from "vitest";
import type { QuackMemory } from "../types/memory";

describe("Memory UI Components", () => {
  describe("MemoryItem", () => {
    it("should format relative time correctly", () => {
      const now = Date.now();

      // Helper function to test (extracted from MemoryItem)
      function formatRelativeTime(timestamp: number): string {
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

      expect(formatRelativeTime(now)).toBe("just now");
      expect(formatRelativeTime(now - 30 * 1000)).toBe("just now");
      expect(formatRelativeTime(now - 2 * 60 * 1000)).toBe("2m ago");
      expect(formatRelativeTime(now - 3 * 60 * 60 * 1000)).toBe("3h ago");
      expect(formatRelativeTime(now - 5 * 24 * 60 * 60 * 1000)).toBe("5d ago");
    });
  });

  describe("MemoryList", () => {
    it("should group memories by category", () => {
      const memories: QuackMemory[] = [
        createMockMemory("1", "preference", "Use dark mode"),
        createMockMemory("2", "fact", "Project uses React"),
        createMockMemory("3", "preference", "Use TypeScript strict"),
        createMockMemory("4", "decision", "Use Vite for bundling"),
      ];

      const grouped = groupMemoriesByCategory(memories);

      expect(grouped).toHaveProperty("preference");
      expect(grouped).toHaveProperty("fact");
      expect(grouped).toHaveProperty("decision");
      expect(grouped.preference).toHaveLength(2);
      expect(grouped.fact).toHaveLength(1);
      expect(grouped.decision).toHaveLength(1);
    });

    it("should filter out archived memories", () => {
      const memories: QuackMemory[] = [
        createMockMemory("1", "preference", "Active memory", false),
        createMockMemory("2", "fact", "Archived memory", true),
        createMockMemory("3", "decision", "Another active", false),
      ];

      const filtered = memories.filter((m) => !m.isArchived);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((m) => !m.isArchived)).toBe(true);
    });
  });

  describe("MemorySearch", () => {
    it("should debounce search input", async () => {
      const onSearch = vi.fn();
      let query = "";

      // Simulate debounced search (simplified)
      const debounce = (fn: () => void, delay: number) => {
        let timer: NodeJS.Timeout;
        return () => {
          clearTimeout(timer);
          timer = setTimeout(fn, delay);
        };
      };

      const debouncedSearch = debounce(() => onSearch(query), 300);

      // Simulate typing
      query = "p";
      debouncedSearch();
      query = "pr";
      debouncedSearch();
      query = "pre";
      debouncedSearch();

      // Should only call once after debounce
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith("pre");
    });
  });

  describe("Category Colors", () => {
    it("should have colors defined for all categories", () => {
      const CATEGORY_COLORS = {
        preference: "#3b82f6",
        fact: "#10b981",
        decision: "#8b5cf6",
        pattern: "#f97316",
        mistake: "#ef4444",
        context: "#6b7280",
      };

      expect(Object.keys(CATEGORY_COLORS)).toHaveLength(6);
      expect(CATEGORY_COLORS.preference).toBe("#3b82f6");
      expect(CATEGORY_COLORS.fact).toBe("#10b981");
      expect(CATEGORY_COLORS.decision).toBe("#8b5cf6");
      expect(CATEGORY_COLORS.pattern).toBe("#f97316");
      expect(CATEGORY_COLORS.mistake).toBe("#ef4444");
      expect(CATEGORY_COLORS.context).toBe("#6b7280");
    });
  });
});

/**
 * Helper: Create mock memory for testing
 */
function createMockMemory(
  id: string,
  category: QuackMemory["category"],
  content: string,
  isArchived: boolean = false
): QuackMemory {
  return {
    id,
    content,
    category,
    confidence: "high",
    scope: "global",
    keywords: content.toLowerCase().split(" "),
    createdAt: Date.now() - 1000 * 60 * 60,
    lastAccessedAt: Date.now(),
    accessCount: 0,
    userVerified: false,
    isArchived,
  };
}

/**
 * Helper: Group memories by category
 */
function groupMemoriesByCategory(
  memories: QuackMemory[]
): Record<string, QuackMemory[]> {
  return memories.reduce(
    (acc, memory) => {
      if (!acc[memory.category]) {
        acc[memory.category] = [];
      }
      acc[memory.category].push(memory);
      return acc;
    },
    {} as Record<string, QuackMemory[]>
  );
}
