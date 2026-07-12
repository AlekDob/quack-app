// Plan mode — virtual tab for Claude Code's ExitPlanMode proposal.
// Mirrors htmlPreview.ts: inline content stashed by key, no file on disk.

export interface PlanPayload {
  plan: string;
}

const stashByKey = new Map<string, PlanPayload>();

export function planKey(
  wsId: string,
  chatId: string | undefined,
  planId: string,
): string {
  return `plan:${wsId}|${chatId ?? "_"}|${planId}`;
}

export function parsePlanKey(
  k: string,
): { wsId: string; chatId: string | undefined; planId: string } | null {
  if (!k.startsWith("plan:")) return null;
  const body = k.slice(5);
  let i = 0;
  const take = (): string | null => {
    const j = body.indexOf("|", i);
    if (j < 0) return null;
    const s = body.slice(i, j);
    i = j + 1;
    return s;
  };
  const wsId = take();
  const chatRaw = take();
  const planId = body.slice(i);
  if (!wsId || !chatRaw || !planId) return null;
  return { wsId, chatId: chatRaw === "_" ? undefined : chatRaw, planId };
}

export function stashPlan(key: string, payload: PlanPayload): void {
  stashByKey.set(key, payload);
}

export function planPayload(key: string): PlanPayload | null {
  return stashByKey.get(key) ?? null;
}
