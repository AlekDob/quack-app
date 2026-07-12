import { getJson } from "./localStore";
import { findWork, type WorksSnapshot } from "./works";
import { workItemRelPath } from "./workItemMd";

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
  const filePath = w.filePath || workItemRelPath(w.shortId);
  const modLine = mod?.featurePath
    ? `Feature doc: ${mod.featurePath}`
    : `Module: ${mod?.name ?? ""}`;
  const bodyPreview = (w.bodyMd ?? "").trim().slice(0, 1200);
  const siblings =
    siblingSummaries.length > 0
      ? `\nLinked sessions:\n${siblingSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";
  return (
    `[Quack Work — ${w.shortId}: ${w.title}]\n` +
    `Work file: ${filePath}\n` +
    `Status: ${w.status} · Priority: ${w.priority} · ${modLine}\n` +
    `Read and edit the work file for the full description and acceptance criteria.\n` +
    (bodyPreview ? `\nPreview:\n${bodyPreview}\n` : "") +
    siblings +
    `\n[/Quack Work]`
  );
}
