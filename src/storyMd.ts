// Story markdown — one file per user story under works/stories/.

import { frontmatterField, frontmatterList } from "./subagents";
import { joinPath } from "./pathUtils";
import { worksRel } from "./worksDir";
import type { StoryStatus, WorkStory, WorksSnapshot } from "./works";
import { moduleByFeatureSlug } from "./works";

export const WORKS_STORIES_DIR = worksRel("stories");

export function storyRelPath(shortId: string): string {
  return joinPath(WORKS_STORIES_DIR, `${shortId}.md`);
}

export interface ParsedStoryMd {
  id?: string;
  shortId?: string;
  status?: StoryStatus;
  moduleSlug?: string;
  cycleId?: string;
  createdAt?: number;
  updatedAt?: number;
  title: string;
  bodyMd: string;
  brainRefs: string[];
  linkedChatIds: string[];
}

const STATUSES = new Set<StoryStatus>(["draft", "active", "done"]);

function stripTitleHeading(body: string, title: string): string {
  const lines = body.split("\n");
  if (lines[0]?.trim() === `# ${title}`) return lines.slice(1).join("\n").replace(/^\n+/, "");
  if (lines[0]?.trim().startsWith("# ")) return lines.slice(1).join("\n").replace(/^\n+/, "");
  return body;
}

export function parseStoryMd(src: string): ParsedStoryMd | null {
  const id = frontmatterField(src, "id");
  const shortId = frontmatterField(src, "shortId");
  const statusRaw = frontmatterField(src, "status");
  const status = statusRaw && STATUSES.has(statusRaw as StoryStatus)
    ? (statusRaw as StoryStatus)
    : undefined;
  const fmTitle = frontmatterField(src, "title");
  const bodyMatch = src.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  let bodyMd = bodyMatch?.[1]?.trim() ?? src.trim();
  let title = fmTitle?.trim() ?? "";
  if (!title) {
    const h1 = bodyMd.split("\n").find((l) => l.trim().startsWith("# "));
    title = h1 ? h1.trim().slice(2).trim() : shortId ?? "Untitled story";
  }
  bodyMd = stripTitleHeading(bodyMd, title);
  if (!id && !shortId) return null;
  return {
    id,
    shortId,
    status,
    moduleSlug: frontmatterField(src, "module") || undefined,
    cycleId: frontmatterField(src, "cycleId") || undefined,
    createdAt: Number(frontmatterField(src, "createdAt")) || undefined,
    updatedAt: Number(frontmatterField(src, "updatedAt")) || undefined,
    title,
    bodyMd,
    brainRefs: frontmatterList(src, "refs").map((r) => r.trim()).filter(Boolean),
    linkedChatIds: frontmatterList(src, "linkedChats"),
  };
}

function fmLine(key: string, value: string | number | undefined): string {
  if (value === undefined || value === "") return "";
  return `${key}: ${value}`;
}

function fmList(key: string, items: string[]): string {
  if (items.length === 0) return "";
  return `${key}:\n${items.map((s) => `  - ${s}`).join("\n")}`;
}

function moduleSlugForStory(story: WorkStory, snap: WorksSnapshot): string {
  const mod = snap.modules.find((m) => m.id === story.moduleId);
  if (mod?.featureSlug) return `feat:${mod.featureSlug}`;
  return story.moduleId;
}

export function serializeStoryMd(
  story: WorkStory,
  snap: WorksSnapshot,
  bodyMd: string,
): string {
  const body = bodyMd.trim();
  const lines = [
    "---",
    fmLine("id", story.id),
    fmLine("shortId", story.shortId),
    fmLine("title", story.title),
    fmLine("status", story.status),
    fmLine("module", moduleSlugForStory(story, snap)),
    fmLine("cycleId", story.cycleId),
    fmList("refs", story.brainRefs ?? []),
    fmList("linkedChats", story.linkedChatIds ?? []),
    fmLine("createdAt", story.createdAt),
    fmLine("updatedAt", story.updatedAt),
    "---",
    "",
    `# ${story.title}`,
    "",
    body,
    "",
  ];
  return lines.filter((l, i) => !(l === "" && i < 3)).join("\n");
}

export function defaultStoryBody(title: string): string {
  return [
    "## User story",
    `As a **user**, I want **${title}**, so that **…**.`,
    "",
    "## Acceptance",
    "- [ ] …",
    "",
  ].join("\n");
}

export function moduleIdFromSlug(
  snap: WorksSnapshot,
  slug?: string,
): string | undefined {
  if (!slug) return undefined;
  const bare = slug.replace(/^feat:/, "");
  const mod = moduleByFeatureSlug(snap, bare);
  if (mod) return mod.id;
  return snap.modules.find((m) => m.id === slug)?.id;
}
