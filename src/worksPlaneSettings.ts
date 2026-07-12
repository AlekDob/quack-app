import { getJson, setJson } from "./localStore";

export interface PlaneWorkspaceConfig {
  enabled: boolean;
  baseUrl: string;
  workspaceSlug: string;
  projectId: string;
}

const key = (wsId: string) => `lcp.works.plane.${wsId}`;
const tokenKey = (wsId: string) => `lcp.works.plane.token.${wsId}`;

const defaultConfig = (): PlaneWorkspaceConfig => ({
  enabled: false,
  baseUrl: "http://pm.esopo.ai",
  workspaceSlug: "wacebo",
  projectId: "",
});

export function getPlaneConfig(wsId: string): PlaneWorkspaceConfig {
  return getJson(key(wsId), defaultConfig(), (v): v is PlaneWorkspaceConfig => {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o.baseUrl === "string" && typeof o.workspaceSlug === "string";
  });
}

export function setPlaneConfig(wsId: string, cfg: PlaneWorkspaceConfig): void {
  setJson(key(wsId), cfg);
}

export function getPlaneToken(wsId: string): string | null {
  return getJson<string | null>(tokenKey(wsId), null, (v): v is string | null =>
    v === null || typeof v === "string",
  );
}

export function setPlaneToken(wsId: string, token: string | null): void {
  setJson(tokenKey(wsId), token);
}
