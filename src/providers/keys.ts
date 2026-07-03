import type { ProviderId } from "./types";
import { invalidateModelDiscovery } from "../modelDiscoveryStore";
import { getString, remove, setString } from "../localStore";

const STORAGE_PREFIX = "lcp.providers.";
const keyFor = (id: ProviderId) => `${STORAGE_PREFIX}${id}.apiKey`;

export function getApiKey(providerId: ProviderId): string {
  return getString(keyFor(providerId)) ?? "";
}

export function setApiKey(providerId: ProviderId, key: string): void {
  // Trim — keys pasted with a trailing newline/space go verbatim into
  // fetch headers, where the invalid header value throws a cryptic
  // TypeError on the first send.
  const cleaned = key.trim();
  if (cleaned) setString(keyFor(providerId), cleaned);
  else remove(keyFor(providerId));
  invalidateModelDiscovery();
}

export function hasApiKey(providerId: ProviderId): boolean {
  return getApiKey(providerId).length > 0;
}
