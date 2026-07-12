// Work + Brain pre-turn inject toggles (see worksTurnContext.ts for manifest).

import { getJson } from "./localStore";

export { buildWorksTurnContext, buildStoryTurnContext, buildSiblingSummaries, getWorksInjectDepth, setWorksInjectDepth, manifestDocPaths } from "./worksTurnContext";
export type { WorksInjectDepth, WorksTurnContext } from "./worksTurnContext";

const injectKey = (wsId: string) => `lcp.works.inject.${wsId}`;

export function getWorkInjectEnabled(wsId: string): boolean {
  return getJson<boolean>(
    injectKey(wsId),
    true,
    (v): v is boolean => typeof v === "boolean",
  );
}

export function setWorkInjectEnabled(wsId: string, on: boolean): void {
  localStorage.setItem(injectKey(wsId), JSON.stringify(on));
}
