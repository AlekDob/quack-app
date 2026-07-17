// Merge a plan into a feature .md — Plan + Tasks sections (no Works story).

import {
  readFeatureMd,
  writeFeatureMd,
} from "./featureCatalog";

function extractChecklist(plan: string): string[] {
  const items: string[] = [];
  for (const line of plan.split("\n")) {
    const m = line.match(/^[-*]\s+\[[ xX]?\]\s+(.+)/);
    if (m) items.push(m[1]!.trim());
  }
  return items;
}

function upsertSection(src: string, heading: string, body: string): string {
  const re = new RegExp(
    `(^###?\\s+${heading}\\s*$)([\\s\\S]*?)(?=^###?\\s+|\\Z)`,
    "im",
  );
  if (re.test(src)) {
    return src.replace(re, `### ${heading}\n${body.trim()}\n\n`);
  }
  return `${src.trimEnd()}\n\n### ${heading}\n${body.trim()}\n`;
}

/** Write plan narrative + open tasks into the feature doc. */
export async function mergePlanIntoFeature(
  root: string,
  featureSlug: string,
  planText: string,
): Promise<void> {
  const plan = planText.trim();
  if (!plan) return;
  let src = await readFeatureMd(root, featureSlug);
  const checks = extractChecklist(plan);
  const narrative = plan
    .split("\n")
    .filter((l) => !/^[-*]\s+\[[ xX]?\]/.test(l))
    .join("\n")
    .trim();
  src = upsertSection(src, "Plan", narrative || plan);
  if (checks.length > 0) {
    const taskBlock = checks.map((t) => `- [ ] ${t}`).join("\n");
    src = upsertSection(src, "Tasks", taskBlock);
  }
  await writeFeatureMd(root, featureSlug, src);
}
