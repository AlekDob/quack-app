// Merge Claude/native plan markdown into a story body + acceptance checklist.

function extractChecklist(plan: string): string[] {
  const items: string[] = [];
  for (const line of plan.split("\n")) {
    const m = line.match(/^[-*]\s+\[[ xX]?\]\s+(.+)/);
    if (m) items.push(m[1]!.trim());
  }
  return items;
}

function titleFromPlan(plan: string): string | undefined {
  for (const line of plan.split("\n")) {
    const h = line.match(/^#+\s+(.+)/);
    if (h) return h[1]!.trim().slice(0, 120);
    const t = line.trim();
    if (t && !t.startsWith("-") && !t.startsWith("*")) return t.slice(0, 120);
  }
  return undefined;
}

export function titleFromPlanText(plan: string): string | undefined {
  return titleFromPlan(plan.trim());
}

export function mergePlanIntoStoryBody(planText: string, fallbackTitle: string): string {
  const plan = planText.trim();
  if (!plan) return "";
  const checks = extractChecklist(plan);
  const narrative = plan
    .split("\n")
    .filter((l) => !/^[-*]\s+\[[ xX]?\]/.test(l))
    .join("\n")
    .trim();
  const storyLead = narrative.includes("## User story")
    ? narrative
    : ["## User story", narrative || `Plan for **${fallbackTitle}**.`, ""].join("\n");
  const acceptance =
    checks.length > 0
      ? ["## Acceptance", ...checks.map((t) => `- [ ] ${t}`), ""].join("\n")
      : "## Acceptance\n- [ ] …\n";
  return `${storyLead}\n\n${acceptance}`.trim();
}
