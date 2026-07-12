import { getJson } from "./localStore";
import { findWork, blocksToPlainText, type WorksSnapshot } from "./works";

const injectKey = (wsId: string) => `lcp.works.inject.${wsId}`;

export function getWorkInjectEnabled(wsId: string): boolean {
  return getJson<boolean>(
    injectKey(wsId),
    true,
    (v): v is boolean => typeof v === "boolean",
  );
}

export function formatWorkBlock(
  snap: WorksSnapshot,
  workId: string,
  siblingSummaries: string[],
): string | null {
  const w = findWork(snap, workId);
  if (!w) return null;
  const mod = snap.modules.find((m) => m.id === w.moduleId);
  const modLine = mod?.featurePath
    ? `Module: ${mod.name} (${mod.featurePath})`
    : `Module: ${mod?.name ?? ""}`;
  const body = blocksToPlainText(w.descriptionBlocks);
  const siblings =
    siblingSummaries.length > 0
      ? `\nLinked sessions:\n${siblingSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";
  return (
    `[Quack Work — ${w.shortId}: ${w.title}]\n` +
    `Status: ${w.status} · ${modLine} · Priority: ${w.priority}\n` +
    (body ? `${body}\n` : "") +
    siblings +
    `\n[/Quack Work]`
  );
}
