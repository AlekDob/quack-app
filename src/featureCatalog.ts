// Lightweight feature-doc catalog — dir listing only, no Works hydrate.
// Perf: call from Features pane / composer menu open, never at chat mount.

import { fs, type DirEntry } from "./ipc";
import { joinPath } from "./pathUtils";
import {
  FEATURE_DIR,
  parseFeatureNum,
  parseFeatureTitle,
} from "./worksFeatureModules";

export type FeatureStatus = "draft" | "active" | "done" | "archived";

export interface FeatureEntry {
  slug: string;
  path: string;
  title: string;
  featureNum?: number;
  status: FeatureStatus;
  /** ISO date from frontmatter `created:` (fallback for timeline). */
  created?: string;
  /** ISO date — timeline bar start. */
  startDate?: string;
  /** ISO date — timeline bar end (target / done). */
  endDate?: string;
}

const STATUS_SET = new Set<FeatureStatus>([
  "draft",
  "active",
  "done",
  "archived",
]);

function parseStatus(head: string): FeatureStatus {
  const m = head.match(/^status:\s*(\w+)/m);
  const raw = m?.[1]?.toLowerCase();
  if (raw && STATUS_SET.has(raw as FeatureStatus)) return raw as FeatureStatus;
  return "active";
}

function parseIsoDate(head: string, key: string): string | undefined {
  const m = head.match(new RegExp(`^${key}:\\s*(\\d{4}-\\d{2}-\\d{2})`, "m"));
  return m?.[1];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function listFeatureFiles(dir: string): Promise<DirEntry[]> {
  if (!(await fs.exists(dir))) return [];
  return (await fs.listDir(dir)).filter(
    (e) => !e.is_dir && e.name.endsWith(".md"),
  );
}

async function entryFromFile(e: DirEntry): Promise<FeatureEntry> {
  const slug = e.name.replace(/\.md$/i, "");
  let title = slug;
  let status: FeatureStatus = "active";
  let created: string | undefined;
  let startDate: string | undefined;
  let endDate: string | undefined;
  try {
    const head = (await fs.readFile(e.path)).slice(0, 2000);
    title = parseFeatureTitle(head, slug);
    status = parseStatus(head);
    created = parseIsoDate(head, "created");
    startDate = parseIsoDate(head, "startDate") ?? created;
    endDate = parseIsoDate(head, "endDate");
  } catch {
    /* slug-derived title */
  }
  return {
    slug,
    path: `${FEATURE_DIR}/${e.name}`,
    title,
    featureNum: parseFeatureNum(slug),
    status,
    created,
    startDate,
    endDate,
  };
}

/** List feature docs under documentation/features/. Lazy — no cache. */
export async function listFeatures(root: string): Promise<FeatureEntry[]> {
  const dir = joinPath(root, FEATURE_DIR);
  let entries: DirEntry[];
  try {
    entries = await listFeatureFiles(dir);
  } catch {
    return [];
  }
  const out = await Promise.all(entries.map(entryFromFile));
  out.sort(
    (a, b) =>
      (a.featureNum ?? 9999) - (b.featureNum ?? 9999) ||
      a.slug.localeCompare(b.slug),
  );
  return out;
}

export function nextFeatureNum(entries: FeatureEntry[]): number {
  let max = 0;
  for (const e of entries) {
    if (e.featureNum != null && e.featureNum > max) max = e.featureNum;
  }
  return max + 1;
}

export function slugifyFeatureName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "feature";
}

const SCAFFOLD = (num: string, slug: string, title: string) => {
  const day = todayIso();
  return `---
type: feature-doc
project: quack-desktop
created: ${day}
startDate: ${day}
endDate: 
last_verified: ${day}
status: active
tags: [${slug.replace(/^\d{3}-/, "")}]
---

## ${num} — ${title}

**Purpose:** Describe this product component in one sentence.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|

### Tasks
- [ ] Document and implement

### Plan

### Notes

### Comments
`;
};

/** Create next NNN-slug.md scaffold. Returns the new entry. */
export async function createFeatureDoc(
  root: string,
  title: string,
): Promise<FeatureEntry> {
  const existing = await listFeatures(root);
  const num = nextFeatureNum(existing);
  const pad = String(num).padStart(3, "0");
  const slug = `${pad}-${slugifyFeatureName(title)}`;
  const rel = `${FEATURE_DIR}/${slug}.md`;
  const abs = joinPath(root, rel);
  const dir = joinPath(root, FEATURE_DIR);
  if (!(await fs.exists(dir))) await fs.createDir(dir);
  if (await fs.exists(abs)) {
    throw new Error(`Feature already exists: ${rel}`);
  }
  const day = todayIso();
  await fs.writeFile(abs, SCAFFOLD(pad, slug, title));
  return {
    slug,
    path: rel,
    title: `${pad} — ${title}`,
    featureNum: num,
    status: "active",
    created: day,
    startDate: day,
  };
}

export function featureAbs(root: string, relOrSlug: string): string {
  if (relOrSlug.includes("/")) return joinPath(root, relOrSlug);
  const file = relOrSlug.endsWith(".md") ? relOrSlug : `${relOrSlug}.md`;
  return joinPath(root, FEATURE_DIR, file);
}

export function featureLabelFromSlug(slug: string): string {
  const num = parseFeatureNum(slug);
  const tail = slug.replace(/^\d{3}-/, "").replace(/-/g, " ");
  if (num != null) return `${String(num).padStart(3, "0")} · ${tail}`;
  return tail || slug;
}

/** Set or insert a YAML frontmatter field. Empty value removes the line. */
export function setFeatureFrontmatterField(
  src: string,
  key: string,
  value: string,
): string {
  const line = value.trim() ? `${key}: ${value.trim()}` : "";
  if (!src.startsWith("---")) {
    return line ? `---\n${line}\n---\n\n${src}` : src;
  }
  const end = src.indexOf("\n---", 3);
  if (end === -1) return src;
  let fm = src.slice(0, end + 4);
  const body = src.slice(end + 4);
  const re = new RegExp(`^${key}:.*$`, "m");
  if (re.test(fm)) {
    fm = line ? fm.replace(re, line) : fm.replace(new RegExp(`^${key}:.*\\n?`, "m"), "");
    return fm + body;
  }
  if (!line) return src;
  const insertAt = fm.indexOf("\n", 3);
  if (insertAt === -1) return src;
  return fm.slice(0, insertAt + 1) + `${line}\n` + fm.slice(insertAt + 1) + body;
}

export function setFeatureStatusInMd(
  src: string,
  status: FeatureStatus,
): string {
  let next = setFeatureFrontmatterField(src, "status", status);
  if (status === "done" || status === "archived") {
    const hasEnd = /^endDate:\s*\d{4}-\d{2}-\d{2}/m.test(next);
    if (!hasEnd) next = setFeatureFrontmatterField(next, "endDate", todayIso());
  }
  return next;
}

/** Toggle the n-th `- [ ]` / `- [x]` task (0-based among task lines). */
export function toggleFeatureTaskInMd(src: string, index: number): string {
  let i = 0;
  return src
    .split("\n")
    .map((line) => {
      const open = line.match(/^(\s*-\s+)\[ \](\s+.*)$/);
      const done = line.match(/^(\s*-\s+)\[x\](\s+.*)$/i);
      if (!open && !done) return line;
      if (i++ !== index) return line;
      if (open) return `${open[1]}[x]${open[2]}`;
      return `${done![1]}[ ]${done![2]}`;
    })
    .join("\n");
}

export function listFeatureTaskLines(
  src: string,
): { text: string; done: boolean; index: number }[] {
  const out: { text: string; done: boolean; index: number }[] = [];
  let index = 0;
  for (const line of src.split("\n")) {
    const open = line.match(/^\s*-\s+\[ \](.+)$/);
    const done = line.match(/^\s*-\s+\[x\](.+)$/i);
    if (open) {
      out.push({ text: open[1]!.trim(), done: false, index: index++ });
    } else if (done) {
      out.push({ text: done[1]!.trim(), done: true, index: index++ });
    }
  }
  return out;
}

export function appendFeatureComment(src: string, text: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `- ${stamp}: ${text.trim()}`;
  if (/^###?\s+Comments\s*$/im.test(src)) {
    return src.replace(
      /^(###?\s+Comments\s*)$/im,
      `$1\n${line}`,
    );
  }
  return `${src.trimEnd()}\n\n### Comments\n${line}\n`;
}

export async function readFeatureMd(
  root: string,
  slugOrPath: string,
): Promise<string> {
  return fs.readFile(featureAbs(root, slugOrPath));
}

export async function writeFeatureMd(
  root: string,
  slugOrPath: string,
  content: string,
): Promise<void> {
  await fs.writeFile(featureAbs(root, slugOrPath), content);
}
