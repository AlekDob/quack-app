import type { WorkItem, WorksSnapshot } from "./works";
import { getPlaneConfig, getPlaneToken } from "./worksPlaneSettings";
import { updateWorkItem } from "./worksCache";

function planeHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-API-Key": token,
  };
}

function projectBase(cfg: ReturnType<typeof getPlaneConfig>): string {
  return `${cfg.baseUrl.replace(/\/$/, "")}/api/v1/workspaces/${cfg.workspaceSlug}/projects/${cfg.projectId}`;
}

export async function pushWorkToPlane(
  wsId: string,
  root: string,
  item: WorkItem,
): Promise<string | null> {
  const cfg = getPlaneConfig(wsId);
  const token = getPlaneToken(wsId);
  if (!cfg.enabled || !token || !cfg.projectId) return null;
  const body = {
    name: item.title,
    description_html: `<p>${(item.bodyMd ?? "").replace(/\n/g, "<br>")}</p>`,
    priority: item.priority,
  };
  const base = projectBase(cfg);
  if (item.planeIssueId) {
    await fetch(`${base}/issues/${item.planeIssueId}/`, {
      method: "PATCH",
      headers: planeHeaders(token),
      body: JSON.stringify(body),
    });
    return item.planeIssueId;
  }
  const res = await fetch(`${base}/issues/`, {
    method: "POST",
    headers: planeHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Plane push failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  await updateWorkItem(root, item.id, { planeIssueId: data.id });
  return data.id;
}

export async function syncWorksToPlane(
  wsId: string,
  root: string,
  snap: WorksSnapshot,
): Promise<number> {
  let n = 0;
  for (const item of snap.items) {
    if (item.status === "cancelled") continue;
    await pushWorkToPlane(wsId, root, item);
    n += 1;
  }
  return n;
}
