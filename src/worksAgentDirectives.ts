// Parse + apply Works directives the agent emits at the end of a turn, so the
// user does nothing: agents associate the chat to an existing story/work,
// create a new one when scope warrants, and keep state current. The story body
// is written as an AGENT-EFFICIENCY card (scope / entry points / decisions /
// acceptance) — the next session reads it instead of re-exploring, which is the
// whole token-saving point (see decisions/004). Never deletes; every action is
// surfaced to the user (toast + Works board).

import {
  createStory,
  createWorkFromStory,
  updateStory,
  getWorksSnapshot,
  hydrateWorks,
} from "./worksCache";
import { linkStoryToChat, linkWorkToChat } from "./quackPlanHarness";
import { findStory, type WorkStory, type WorksSnapshot } from "./works";

export interface AppliedWorksAction {
  kind: "linked" | "created-story" | "created-work" | "updated";
  shortId: string;
  title: string;
}

interface Fields {
  [key: string]: string;
}

const ID_RE = /^\[Works link\]\s+([SW]-\d+)/gim;
const NEW_STORY_RE = /\[Works new-story\]([\s\S]*?)\[\/Works new-story\]/gi;
const NEW_WORK_RE = /\[Works new-work\]([\s\S]*?)\[\/Works new-work\]/gi;
const UPDATE_RE = /\[Works update\]\s+([SW]-\d+)([\s\S]*?)\[\/Works update\]/gi;

/** Parse `key: value` lines inside a directive body into a flat map. */
function parseFields(body: string): Fields {
  const out: Fields = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*([a-zA-Z][\w+-]*)\s*:\s*(.+?)\s*$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

/** Build the token-efficient story body an agent reads next session. */
export function buildEfficiencyBody(f: Fields): string {
  const list = (v?: string) =>
    (v ?? "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  const scope = list(f.scope).map((s) => `- ${s}`).join("\n");
  const acc = list(f.acceptance).map((s) => `- [ ] ${s}`).join("\n");
  return [
    "## Scope (files in play — Read these first)",
    scope || "- (none yet)",
    "",
    "## Entry points",
    f.entry ? f.entry : "- (none yet)",
    "",
    "## Decisions",
    f.decisions ? f.decisions : "- (none yet)",
    "",
    "## Acceptance",
    acc || "- [ ] (define)",
    ...(f.notes ? ["", "## Notes", f.notes] : []),
  ].join("\n");
}

export interface ParsedDirectives {
  links: string[]; // S-/W- shortIds
  newStories: Fields[];
  newWorks: Fields[]; // each needs `story: S-NNN` (parent) + title
  updates: { shortId: string; fields: Fields }[];
}

export function parseWorksDirectives(text: string): ParsedDirectives {
  const links: string[] = [];
  for (const m of text.matchAll(ID_RE)) links.push(m[1].toUpperCase());
  const newStories = [...text.matchAll(NEW_STORY_RE)].map((m) =>
    parseFields(m[1]),
  );
  const newWorks = [...text.matchAll(NEW_WORK_RE)].map((m) => parseFields(m[1]));
  const updates = [...text.matchAll(UPDATE_RE)].map((m) => ({
    shortId: m[1].toUpperCase(),
    fields: parseFields(m[2]),
  }));
  return { links, newStories, newWorks, updates };
}

export function hasWorksDirectives(text: string): boolean {
  return (
    /\[Works link\]/i.test(text) ||
    /\[Works new-story\]/i.test(text) ||
    /\[Works new-work\]/i.test(text) ||
    /\[Works update\]/i.test(text)
  );
}

function shortIdToId(
  snap: WorksSnapshot,
  shortId: string,
): { kind: "story" | "work"; id: string; title: string } | null {
  const st = snap.stories.find((s) => s.shortId.toUpperCase() === shortId);
  if (st) return { kind: "story", id: st.id, title: st.title };
  const w = snap.items.find((i) => i.shortId.toUpperCase() === shortId);
  if (w) return { kind: "work", id: w.id, title: w.title };
  return null;
}

/** Apply parsed directives; returns the actions taken for user-facing chips. */
export async function applyWorksDirectives(
  wsId: string,
  chatId: string,
  root: string,
  d: ParsedDirectives,
): Promise<AppliedWorksAction[]> {
  const done: AppliedWorksAction[] = [];
  const snap = getWorksSnapshot(root) ?? (await hydrateWorks(root));

  for (const shortId of d.links) {
    const hit = shortIdToId(snap, shortId);
    if (!hit) continue;
    if (hit.kind === "story") await linkStoryToChat(wsId, chatId, root, hit.id);
    else await linkWorkToChat(wsId, chatId, root, hit.id);
    done.push({ kind: "linked", shortId, title: hit.title });
  }

  for (const f of d.newStories) {
    if (!f.title) continue;
    const story = await createStory(root, {
      title: f.title,
      status: "active",
      bodyMd: buildEfficiencyBody(f),
    });
    await linkStoryToChat(wsId, chatId, root, story.id);
    done.push({ kind: "created-story", shortId: story.shortId, title: story.title });
  }

  await applyNewWorks(wsId, chatId, root, d.newWorks, done);
  await applyUpdates(root, d.updates, done);
  return done;
}

async function applyNewWorks(
  wsId: string,
  chatId: string,
  root: string,
  newWorks: Fields[],
  done: AppliedWorksAction[],
): Promise<void> {
  if (newWorks.length === 0) return;
  const snap = getWorksSnapshot(root) ?? (await hydrateWorks(root));
  for (const f of newWorks) {
    const parent = f.story
      ? snap.stories.find((s) => s.shortId.toUpperCase() === f.story.toUpperCase())
      : undefined;
    if (!f.title || !parent) continue; // new work needs a parent story
    const w = await createWorkFromStory(root, parent.id, {
      title: f.title,
      bodyMd: buildEfficiencyBody(f),
    });
    if (!w) continue;
    await linkWorkToChat(wsId, chatId, root, w.id);
    done.push({ kind: "created-work", shortId: w.shortId, title: w.title });
  }
}

async function applyUpdates(
  root: string,
  updates: { shortId: string; fields: Fields }[],
  done: AppliedWorksAction[],
): Promise<void> {
  for (const u of updates) {
    const snap = getWorksSnapshot(root) ?? (await hydrateWorks(root));
    const hit = shortIdToId(snap, u.shortId);
    if (!hit || hit.kind !== "story") continue; // updates target stories today
    const story = findStory(snap, hit.id);
    if (!story) continue;
    const patch = buildStoryPatch(story, u.fields);
    if (Object.keys(patch).length === 0) continue;
    await updateStory(root, hit.id, patch);
    done.push({ kind: "updated", shortId: u.shortId, title: story.title });
  }
}

/** Merge an update directive into a story: status + append scope + check items. */
function buildStoryPatch(story: WorkStory, f: Fields): Partial<WorkStory> {
  const patch: Partial<WorkStory> = {};
  if (f.status && /^(draft|active|done)$/.test(f.status)) {
    patch.status = f.status as WorkStory["status"];
  }
  let body = story.bodyMd ?? "";
  const add = (f["scope+"] ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const file of add) {
    if (!body.includes(file)) body = appendUnderHeading(body, "## Scope", `- ${file}`);
  }
  const doneItem = f["acceptance-done"]?.trim();
  if (doneItem) body = body.replace(`- [ ] ${doneItem}`, `- [x] ${doneItem}`);
  if (body !== (story.bodyMd ?? "")) patch.bodyMd = body;
  return patch;
}

/** Append a line right under a markdown heading (or at end if absent). */
function appendUnderHeading(body: string, heading: string, line: string): string {
  const idx = body.indexOf(heading);
  if (idx < 0) return `${body}\n\n${heading}\n${line}`;
  const nl = body.indexOf("\n", idx);
  const at = nl < 0 ? body.length : nl + 1;
  return body.slice(0, at) + line + "\n" + body.slice(at);
}

/** Compact one-line index of open stories/works so the agent can associate. */
export function formatOpenItemsIndex(snap: WorksSnapshot, max = 12): string | null {
  const open = snap.stories.filter((s) => s.status !== "done");
  if (open.length === 0) return null;
  const rows = open.slice(0, max).map((s) => `  ${s.shortId} — ${s.title} (${s.status})`);
  return (
    "[Works — open stories you can associate this chat with]\n" +
    rows.join("\n") +
    "\n[/Works]"
  );
}
