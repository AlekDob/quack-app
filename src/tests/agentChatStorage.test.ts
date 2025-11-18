/**
 * Tests for Agent Chat Storage Service
 *
 * Tests defensive validation, corruption handling, and storage operations
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveAgentChatsToStorage, loadAgentChatsFromStorage } from "../services/agentChatStorage";
import type { AgentChat } from "../types";

// Mock Tauri Store
const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(() => Promise.resolve(mockStore)),
  },
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock test mode context
vi.mock("../contexts/TestModeContext", () => ({
  getTestModeStoreName: (name: string) => name,
}));

describe("agentChatStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveAgentChatsToStorage", () => {
    it("should save agent chats with all required fields", async () => {
      const chats: AgentChat[] = [
        {
          id: "chat-1",
          name: "Project Alpha",
          terminals: ["term-1", "term-2"],
          createdAt: new Date().toISOString(),
        } as AgentChat,
      ];

      await saveAgentChatsToStorage(chats);

      expect(mockStore.set).toHaveBeenCalledWith("agentChats", chats);
      expect(mockStore.save).toHaveBeenCalled();
    });

    it("should save empty array correctly", async () => {
      await saveAgentChatsToStorage([]);

      expect(mockStore.set).toHaveBeenCalledWith("agentChats", []);
      expect(mockStore.save).toHaveBeenCalled();
    });

    it("should handle save errors gracefully", async () => {
      mockStore.set.mockRejectedValueOnce(new Error("Storage full"));

      await saveAgentChatsToStorage([{ id: "1", name: "Test" } as AgentChat]);

      // Should not throw, just log error
      expect(mockStore.set).toHaveBeenCalled();
    });
  });

  describe("loadAgentChatsFromStorage", () => {
    it("should load valid agent chats", async () => {
      const chats: AgentChat[] = [
        { id: "chat-1", name: "Project Alpha" } as AgentChat,
        { id: "chat-2", name: "Project Beta" } as AgentChat,
      ];

      mockStore.get.mockResolvedValueOnce(chats);

      const result = await loadAgentChatsFromStorage();

      expect(result).toEqual(chats);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no data exists", async () => {
      mockStore.get.mockResolvedValueOnce(null);

      const result = await loadAgentChatsFromStorage();

      expect(result).toEqual([]);
    });

    it("should return empty array when data is undefined", async () => {
      mockStore.get.mockResolvedValueOnce(undefined);

      const result = await loadAgentChatsFromStorage();

      expect(result).toEqual([]);
    });

    it("should detect and handle non-array corruption", async () => {
      mockStore.get.mockResolvedValueOnce({ corrupted: "data" });

      const result = await loadAgentChatsFromStorage();

      expect(result).toEqual([]);
      expect(mockStore.delete).toHaveBeenCalledWith("agentChats");
      expect(mockStore.save).toHaveBeenCalled();
    });

    it("should filter out invalid entries (missing id)", async () => {
      const chats = [
        { id: "chat-1", name: "Valid" },
        { name: "Invalid - no id" }, // ❌ Missing id
        { id: "chat-3", name: "Valid 2" },
      ];

      mockStore.get.mockResolvedValueOnce(chats);

      const result = await loadAgentChatsFromStorage();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("chat-1");
      expect(result[1].id).toBe("chat-3");
    });

    it("should filter out invalid entries (missing name)", async () => {
      const chats = [
        { id: "chat-1", name: "Valid" },
        { id: "chat-2" }, // ❌ Missing name
      ];

      mockStore.get.mockResolvedValueOnce(chats);

      const result = await loadAgentChatsFromStorage();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("chat-1");
    });

    it("should filter out null entries", async () => {
      const chats = [
        { id: "chat-1", name: "Valid" },
        null, // ❌ Null entry
        { id: "chat-3", name: "Valid 2" },
      ];

      mockStore.get.mockResolvedValueOnce(chats);

      const result = await loadAgentChatsFromStorage();

      expect(result).toHaveLength(2);
    });

    it("should filter out non-object entries", async () => {
      const chats = [
        { id: "chat-1", name: "Valid" },
        "string-entry", // ❌ String instead of object
        42, // ❌ Number instead of object
        { id: "chat-4", name: "Valid 2" },
      ];

      mockStore.get.mockResolvedValueOnce(chats);

      const result = await loadAgentChatsFromStorage();

      expect(result).toHaveLength(2);
    });

    it("should handle storage errors gracefully", async () => {
      mockStore.get.mockRejectedValueOnce(new Error("Storage unavailable"));

      const result = await loadAgentChatsFromStorage();

      expect(result).toEqual([]);
    });

    it("should handle mixed valid/invalid data", async () => {
      const chats = [
        { id: "1", name: "Valid 1" },
        null,
        { id: "2" }, // Missing name
        { name: "No ID" }, // Missing id
        { id: "3", name: "Valid 2" },
        "corrupted",
        { id: "4", name: "Valid 3" },
      ];

      mockStore.get.mockResolvedValueOnce(chats);

      const result = await loadAgentChatsFromStorage();

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.id)).toEqual(["1", "3", "4"]);
    });
  });
});
