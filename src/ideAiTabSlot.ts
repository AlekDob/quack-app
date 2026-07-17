/**
 * IDE-mode AI tab slot: at most one `ai:` tab per tabs pane.
 * The Agent Hub is the session list; the editor bar stays file-centric.
 */

export interface TabsPaneLike {
  kind: "tabs";
  tabs: string[];
  active: string | null;
}

/** Swap/place `key` as the sole AI tab in this pane. */
export function placeAiKeyInTabsPane<T extends TabsPaneLike>(
  pane: T,
  key: string,
): T {
  const withoutOtherAi = pane.tabs.filter(
    (t) => !t.startsWith("ai:") || t === key,
  );
  const tabs = withoutOtherAi.includes(key)
    ? withoutOtherAi
    : [...withoutOtherAi, key];
  return { ...pane, tabs, active: key };
}

/** Collapse leftover multi-AI tabs to a single slot. */
export function pruneAiTabsInPane<T extends TabsPaneLike>(pane: T): T {
  const aiTabs = pane.tabs.filter((t) => t.startsWith("ai:"));
  if (aiTabs.length <= 1) return pane;
  const keep =
    pane.active && pane.active.startsWith("ai:")
      ? pane.active
      : aiTabs[aiTabs.length - 1]!;
  return placeAiKeyInTabsPane(pane, keep);
}
