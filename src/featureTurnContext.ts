// Token-cheap feature inject — outline / pointer only. Default OFF.
// Never dumps Comments, full body, or unrelated features.

import { fs } from "./ipc";
import { getJson } from "./localStore";
import {
  extractFeatureDocOutline,
  formatFeatureOutlineBlock,
} from "./featureDocOutline";
import {
  featureAbs,
  featureLabelFromSlug,
  listFeatureTaskLines,
} from "./featureCatalog";
import { FEATURE_DIR } from "./worksFeatureModules";

export type FeatureInjectDepth = "off" | "pointers" | "outline" | "pinky";

const injectKey = (wsId: string) => `lcp.features.inject.${wsId}`;
const depthKey = (wsId: string) => `lcp.features.injectDepth.${wsId}`;

export function getFeatureInjectEnabled(wsId: string): boolean {
  return getJson<boolean>(
    injectKey(wsId),
    false,
    (v): v is boolean => typeof v === "boolean",
  );
}

export function setFeatureInjectEnabled(wsId: string, on: boolean): void {
  localStorage.setItem(injectKey(wsId), JSON.stringify(on));
}

export function getFeatureInjectDepth(wsId: string): FeatureInjectDepth {
  return getJson<FeatureInjectDepth>(
    depthKey(wsId),
    "outline",
    (v): v is FeatureInjectDepth =>
      v === "off" ||
      v === "pointers" ||
      v === "outline" ||
      v === "pinky",
  );
}

export function setFeatureInjectDepth(
  wsId: string,
  depth: FeatureInjectDepth,
): void {
  localStorage.setItem(depthKey(wsId), JSON.stringify(depth));
}

export interface FeatureTurnContext {
  block: string;
  pointer: string;
  featurePath: string;
}

function uncheckedPreview(src: string, max: number): string[] {
  return listFeatureTaskLines(src)
    .filter((t) => !t.done)
    .slice(0, max)
    .map((t) => t.text);
}

function pendingCount(src: string): number {
  return listFeatureTaskLines(src).filter((t) => !t.done).length;
}

function resolveRel(slugOrPath: string): string {
  if (slugOrPath.includes("/")) return slugOrPath;
  const file = slugOrPath.endsWith(".md") ? slugOrPath : `${slugOrPath}.md`;
  return `${FEATURE_DIR}/${file}`;
}

function slugOf(slugOrPath: string): string {
  const base = slugOrPath.split("/").pop() ?? slugOrPath;
  return base.replace(/\.md$/i, "");
}

/** Build inject block for a linked feature. Caller gates with getFeatureInjectEnabled. */
export async function buildFeatureTurnContext(
  root: string,
  slugOrPath: string,
  wsId: string,
  scopeFiles: string[] = [],
): Promise<FeatureTurnContext | null> {
  const depth = getFeatureInjectDepth(wsId);
  if (depth === "off") return null;

  const featurePath = resolveRel(slugOrPath);
  const slug = slugOf(slugOrPath);
  const label = featureLabelFromSlug(slug);
  let src = "";
  try {
    src = await fs.readFile(featureAbs(root, featurePath));
  } catch {
    return {
      featurePath,
      block: `[Feature ${label}: ${featurePath} — file missing]`,
      pointer: `[Feature ${label} — Read ${featurePath}]`,
    };
  }

  const pending = pendingCount(src);
  const pointer =
    `[Feature ${label}: ${featurePath}` +
    (pending > 0 ? ` · ${pending} pending` : "") +
    ` — full outline already in this session; Read the feature doc, don't re-Explore]`;

  if (depth === "pointers") {
    return { featurePath, block: pointer, pointer };
  }

  const outline = extractFeatureDocOutline(src);
  const tasks = uncheckedPreview(src, 5);
  const lines = [
    `[Feature ${label}]`,
    `Path: ${featurePath}`,
    formatFeatureOutlineBlock(featurePath, outline),
  ];
  if (tasks.length > 0) {
    lines.push("Open tasks:");
    for (const t of tasks) lines.push(`  - [ ] ${t}`);
  }
  if (scopeFiles.length > 0) {
    lines.push("Files in scope (already edited — Read these first):");
    for (const f of scopeFiles.slice(0, 12)) lines.push(`  - ${f}`);
  }
  lines.push(
    "Update Tasks in the feature .md with Edit when done. Do not dump Comments into the reply.",
  );

  return { featurePath, block: lines.join("\n"), pointer };
}
