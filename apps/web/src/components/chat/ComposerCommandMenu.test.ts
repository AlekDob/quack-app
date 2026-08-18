import { describe, expect, it } from "vitest";
import { groupCommandItems, type ComposerCommandItem } from "./ComposerCommandMenu";

describe("groupCommandItems", () => {
  it("groups mention suggestions as plugins, chats, local, then subagents", () => {
    const items: ComposerCommandItem[] = [
      {
        id: "agent:codex:mini",
        type: "agent",
        provider: "codex",
        alias: "mini",
        color: "violet",
        label: "@mini",
        description: "GPT-5.4 Mini",
      },
      {
        id: "path:file:/workspace/AGENTS.md",
        type: "path",
        path: "/workspace/AGENTS.md",
        pathKind: "file",
        label: "AGENTS.md",
        description: "/workspace",
      },
      {
        id: "plugin:github",
        type: "plugin",
        plugin: {
          id: "plugin/github",
          name: "GitHub",
          source: {
            type: "local",
            path: "/test/plugins/github",
          },
          interface: {
            displayName: "GitHub",
            shortDescription: "Triage PRs and CI",
          },
          installed: true,
          enabled: true,
          installPolicy: "AVAILABLE",
          authPolicy: "ON_USE",
        },
        mention: {
          name: "GitHub",
          path: "plugin://GitHub@codex",
        },
        label: "GitHub",
        description: "Triage PRs and CI",
      },
      {
        id: "local-root",
        type: "local-root",
        label: "@local",
        description: "Browse folders on this computer",
      },
      {
        id: "thread:thread-1",
        type: "thread",
        threadId: "thread-1",
        provider: "codex",
        mention: { name: "Release prep", path: "thread://thread-1" },
        label: "Release prep",
        description: "Quack",
      },
    ];

    expect(groupCommandItems(items, "mention", true)).toEqual([
      {
        id: "plugins",
        label: "Plugins",
        items: [items[2]],
      },
      {
        id: "chats",
        label: "Chats",
        items: [items[4]],
      },
      {
        id: "local",
        label: "Local",
        items: [items[1], items[3]],
      },
      {
        id: "subagents",
        label: "Subagents",
        items: [items[0]],
      },
    ]);
  });

  it("lifts Linear create to the first mention group when it is the first item", () => {
    const createItem: ComposerCommandItem = {
      id: "linear-create",
      type: "linear-create",
      title: "",
      label: "New Linear issue",
      description: "Create a Linear issue",
    };
    const pathItem: ComposerCommandItem = {
      id: "path:file:/workspace/AGENTS.md",
      type: "path",
      path: "/workspace/AGENTS.md",
      pathKind: "file",
      label: "AGENTS.md",
      description: "/workspace",
    };
    const issueItem: ComposerCommandItem = {
      id: "linear-issue:ale-22",
      type: "linear-issue",
      issue: {
        id: "issue-1",
        identifier: "ALE-22",
        title: "Kanban",
        url: "https://linear.app/issue/ALE-22",
        stateName: "In Progress",
        projectName: "Quack",
      },
      label: "ALE-22 Kanban",
      description: "Quack",
    };

    expect(groupCommandItems([createItem, pathItem, issueItem], "mention", true)).toEqual([
      {
        id: "linear",
        label: "Linear",
        items: [createItem, issueItem],
      },
      {
        id: "local",
        label: "Local",
        items: [pathItem],
      },
    ]);
  });

  it("groups slash-menu skills separately from app and provider commands", () => {
    const items: ComposerCommandItem[] = [
      {
        id: "slash:review",
        type: "slash-command",
        command: "review",
        label: "/review",
        description: "Review changes",
        source: "app",
      },
      {
        id: "provider-command:codex:help",
        type: "provider-native-command",
        provider: "codex",
        command: "help",
        label: "/help",
        description: "Show help",
      },
      {
        id: "skill:/workspace/.codex/skills/check-code/SKILL.md",
        type: "skill",
        skill: {
          name: "check-code",
          description: "Review recent code changes",
          path: "/workspace/.codex/skills/check-code/SKILL.md",
          enabled: true,
          scope: "project",
        },
        label: "check-code",
        description: "Review recent code changes",
      },
    ];

    expect(groupCommandItems(items, "slash-command", true)).toEqual([
      {
        id: "built-in",
        label: "Built-in",
        items: [items[0]],
      },
      {
        id: "provider",
        label: "Provider",
        items: [items[1]],
      },
      {
        id: "skills",
        label: "Skills",
        items: [items[2]],
      },
    ]);
  });
});
