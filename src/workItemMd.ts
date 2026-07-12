// Work item markdown — one file per ticket under works/items/.
// Agents Read/Write these like feature docs; Quack syncs frontmatter ↔ index.

import { frontmatterField, frontmatterList } from "./subagents";
import { joinPath } from "./pathUtils";
import { worksRel } from "./worksDir";
import { blocksToMarkdown } from "./worksBlocks";
import type {
  WorkItem,
  WorkOrigin,
  WorkPriority,
  WorkStatus,
  WorksSnapshot,
  WorkBlock,
} from "./works";
import { moduleByFeatureSlug } from "./works";

export const WORKS_ITEMS_DIR = worksRel("items");

export function workItemRelPath(shortId: string): string {
  return joinPath(WORKS_ITEMS_DIR, `${shortId}.md`);
}

export interface ParsedWorkMd {
  id?: string;
  shortId?: string;
  status?: WorkStatus;
  priority?: WorkPriority;
  moduleSlug?: string;
  origin?: WorkOrigin;
  labelNames: string[];
  startDate?: string;
  targetDate?: string;
  linkedChatIds: string[];
  planApprovedAt?: number;
  planeIssueId?: string;
  parentId?: string;
  cycleId?: string;
  createdAt?: number;
  updatedAt?: number;
  title: string;
  bodyMd: string;
  brainRefs: string[];
}

const STATUSES = new Set<WorkStatus>([
  "backlog",
  "todo",
  "in_progress",
  "done",
  "cancelled",
]);

const PRIORITIES = new Set<WorkPriority>([
  "urgent",
  "high",
  "medium",
  "low",
]);

const ORIGINS = new Set<WorkOrigin>([
  "plan",
  "hotfix",
  "manual",
  "agent",
  "sync",
]);

function parseNum(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function stripTitleHeading(body: string, title: string): string {
  const lines = body.split("\n");
  if (lines[0]?.trim() === `# ${title}`) return lines.slice(1).join("\n").replace(/^\n+/, "");
  if (lines[0]?.trim().startsWith("# ")) return lines.slice(1).join("\n").replace(/^\n+/, "");
  return body;
}

export function parseWorkItemMd(
  src: string,
  snap: WorksSnapshot,
): ParsedWorkMd | null {
  const id = frontmatterField(src, "id");
  const shortId = frontmatterField(src, "shortId");
  const statusRaw = frontmatterField(src, "status");
  const status = statusRaw && STATUSES.has(statusRaw as WorkStatus)
    ? (statusRaw as WorkStatus)
    : undefined;
  const priorityRaw = frontmatterField(src, "priority");
  const priority = priorityRaw && PRIORITIES.has(priorityRaw as WorkPriority)
    ? (priorityRaw as WorkPriority)
    : undefined;
  const originRaw = frontmatterField(src, "origin");
  const origin = originRaw && ORIGINS.has(originRaw as WorkOrigin)
    ? (originRaw as WorkOrigin)
    : undefined;
  const moduleSlug = frontmatterField(src, "module");
  const fmTitle = frontmatterField(src, "title");
  const bodyMatch = src.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  let bodyMd = bodyMatch?.[1]?.trim() ?? src.trim();
  let title = fmTitle?.trim() ?? "";
  if (!title) {
    const h1 = bodyMd.split("\n").find((l) => l.trim().startsWith("# "));
    title = h1 ? h1.trim().slice(2).trim() : shortId ?? "Untitled work";
  }
  bodyMd = stripTitleHeading(bodyMd, title);
  if (!id && !shortId) return null;
  const mod = moduleSlug ? moduleByFeatureSlug(snap, moduleSlug.replace(/^feat:/, "")) : undefined;
  if (moduleSlug && !mod && !moduleSlug.startsWith("feat:")) {
    /* allow raw module id in legacy files */
  }
  return {
    id,
    shortId,
    status,
    priority,
    moduleSlug,
    origin,
    labelNames: frontmatterList(src, "labels"),
    startDate: frontmatterField(src, "startDate") || undefined,
    targetDate: frontmatterField(src, "targetDate") || undefined,
    linkedChatIds: frontmatterList(src, "linkedChats"),
    planApprovedAt: parseNum(frontmatterField(src, "planApprovedAt")),
    planeIssueId: frontmatterField(src, "planeIssueId") || undefined,
    parentId: frontmatterField(src, "parentId") || undefined,
    cycleId: frontmatterField(src, "cycleId") || undefined,
    createdAt: parseNum(frontmatterField(src, "createdAt")),
    updatedAt: parseNum(frontmatterField(src, "updatedAt")),
    title,
    bodyMd,
    brainRefs: frontmatterList(src, "refs").map((r) => r.trim()).filter(Boolean),
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

function moduleSlugForItem(item: WorkItem, snap: WorksSnapshot): string {
  const mod = snap.modules.find((m) => m.id === item.moduleId);
  if (mod?.featureSlug) return `feat:${mod.featureSlug}`;
  return item.moduleId;
}

function labelNamesForItem(item: WorkItem, snap: WorksSnapshot): string[] {
  return item.labelIds.flatMap((id) => {
    const l = snap.labels.find((x) => x.id === id);
    return l ? [l.name] : [];
  });
}

export function serializeWorkItemMd(
  item: WorkItem,
  snap: WorksSnapshot,
  bodyMd: string,
): string {
  const body = bodyMd.trim();
  const lines = [
    "---",
    fmLine("id", item.id),
    fmLine("shortId", item.shortId),
    fmLine("title", item.title),
    fmLine("status", item.status),
    fmLine("priority", item.priority),
    fmLine("module", moduleSlugForItem(item, snap)),
    fmLine("origin", item.origin),
    fmList("labels", labelNamesForItem(item, snap)),
    fmLine("startDate", item.startDate),
    fmLine("targetDate", item.targetDate),
    fmList("linkedChats", item.linkedChatIds),
    fmLine("planApprovedAt", item.planApprovedAt),
    fmLine("planeIssueId", item.planeIssueId),
    fmLine("parentId", item.parentId),
    fmLine("cycleId", item.cycleId),
    fmList("refs", item.brainRefs ?? []),
    fmLine("createdAt", item.createdAt),
    fmLine("updatedAt", item.updatedAt),
    "---",
    "",
    `# ${item.title}`,
    "",
    body,
    "",
  ];
  return lines.filter((l, i) => !(l === "" && i < 3)).join("\n");
}

export function blocksToBodyMd(blocks: WorkBlock[]): string {
  return blocksToMarkdown(blocks);
}
