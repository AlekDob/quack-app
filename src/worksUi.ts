import type { WorkItem, WorkModule } from "./works";

export function formatModuleLabel(
  m: Pick<WorkModule, "name" | "featureNum">,
): string {
  if (m.featureNum != null) {
    return `${String(m.featureNum).padStart(3, "0")} · ${m.name}`;
  }
  return m.name;
}

export function formatWorkHitTitle(item: WorkItem): string {
  return `${item.shortId} · ${item.title}`;
}

export function sortWorkModules(modules: WorkModule[]): WorkModule[] {
  return [...modules].sort((a, b) => {
    const an = a.featureNum ?? 10000;
    const bn = b.featureNum ?? 10000;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name);
  });
}

export function modulePathLine(m?: WorkModule): string {
  if (!m) return "No module";
  return m.featurePath ?? formatModuleLabel(m);
}
