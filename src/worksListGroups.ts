import type { WorkItem, WorkModule, WorkStory } from "./works";

export type WorksListGroup =
  | { kind: "story"; story: WorkStory; children: WorkItem[] }
  | { kind: "orphan"; item: WorkItem };

function itemHaystack(w: WorkItem, mod?: WorkModule): string {
  return [
    w.shortId,
    w.title,
    w.status,
    w.priority,
    mod?.name,
    mod?.featurePath,
    mod?.featureSlug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function storyHaystack(s: WorkStory, mod?: WorkModule): string {
  return [s.shortId, s.title, s.status, mod?.name, mod?.featurePath]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesQuery(hay: string, terms: string[]): boolean {
  return terms.every((t) => hay.includes(t));
}

export function buildWorksListGroups(
  stories: WorkStory[],
  items: WorkItem[],
  modules: WorkModule[],
  query: string,
): WorksListGroup[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const modById = new Map(modules.map((m) => [m.id, m]));
  const storyById = new Map(stories.map((s) => [s.id, s]));
  const filteredItems =
    terms.length === 0
      ? items
      : items.filter((w) =>
          matchesQuery(itemHaystack(w, modById.get(w.moduleId)), terms),
        );

  const childrenByStory = new Map<string, WorkItem[]>();
  const orphans: WorkItem[] = [];

  for (const w of filteredItems) {
    const parent = w.parentId ? storyById.get(w.parentId) : undefined;
    if (parent) {
      const list = childrenByStory.get(parent.id) ?? [];
      list.push(w);
      childrenByStory.set(parent.id, list);
    } else {
      orphans.push(w);
    }
  }

  const groups: WorksListGroup[] = [];
  const sortedStories = [...stories].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const story of sortedStories) {
    const kids = childrenByStory.get(story.id) ?? [];
    const storyMatches =
      terms.length === 0 ||
      matchesQuery(storyHaystack(story, modById.get(story.moduleId)), terms);
    if (kids.length === 0 && !storyMatches) continue;
    if (kids.length === 0 && storyMatches && terms.length > 0) {
      groups.push({ kind: "story", story, children: [] });
      continue;
    }
    if (kids.length > 0 || storyMatches) {
      kids.sort((a, b) => b.updatedAt - a.updatedAt);
      groups.push({ kind: "story", story, children: kids });
    }
  }

  orphans.sort((a, b) => b.updatedAt - a.updatedAt);
  for (const item of orphans) {
    groups.push({ kind: "orphan", item });
  }

  return groups;
}

export function countVisibleWorks(groups: WorksListGroup[]): number {
  let n = 0;
  for (const g of groups) {
    if (g.kind === "orphan") n++;
    else n += g.children.length;
  }
  return n;
}
