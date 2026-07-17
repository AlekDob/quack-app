// Card for agent-emitted [Works new-story] — opens the Works story drawer on click.

import { useState } from "react";
import { Icon } from "./Icon";
import { openStoryDrawer } from "../storyDrawer";
import {
  applyWorksDirectives,
  findStoryByTitle,
  type WorksNewStoryFields,
} from "../worksAgentDirectives";
import { getWorksSnapshot, hydrateWorks } from "../worksCache";
import { findStory } from "../works";

type Props = {
  wsId: string;
  chatId: string;
  root: string;
  fields: WorksNewStoryFields;
  chatStoryId?: string;
};

function scopePreview(scope?: string, max = 3): string {
  const files = (scope ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (files.length === 0) return "";
  const head = files.slice(0, max).join(", ");
  return files.length > max ? `${head} +${files.length - max}` : head;
}

export function WorksStoryChip({
  wsId,
  chatId,
  root,
  fields,
  chatStoryId,
}: Props) {
  const [busy, setBusy] = useState(false);

  const viewStory = async () => {
    setBusy(true);
    try {
      let snap = getWorksSnapshot(root) ?? (await hydrateWorks(root));
      let story = resolveStory(snap, fields.title ?? "", chatStoryId);
      if (!story) {
        const actions = await applyWorksDirectives(wsId, chatId, root, {
          links: [],
          newStories: [fields],
          newWorks: [],
          updates: [],
        });
        const hit = actions.find((a) => a.kind === "created-story");
        snap = getWorksSnapshot(root) ?? (await hydrateWorks(root));
        story = hit
          ? snap.stories.find((s) => s.shortId === hit.shortId)
          : findStoryByTitle(snap, fields.title ?? "");
      }
      if (!story) return;
      openStoryDrawer({ wsId, root, storyId: story.id });
    } finally {
      setBusy(false);
    }
  };

  const preview = scopePreview(fields.scope);

  return (
    <div className="works-story-chip">
      <div className="works-story-chip-head">
        <Icon name="check-square" size={11} className="works-story-chip-icon" />
        <span className="works-story-chip-label">New story</span>
      </div>
      <div className="works-story-chip-body">
        <p className="works-story-chip-title">{fields.title}</p>
        {preview ? (
          <p className="works-story-chip-preview">{preview}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="works-story-chip-btn"
        disabled={busy}
        onClick={() => void viewStory()}
      >
        <Icon name="chevron-left" size={12} />
        <span>{busy ? "Opening…" : "View this story"}</span>
      </button>
    </div>
  );
}

function resolveStory(
  snap: Awaited<ReturnType<typeof hydrateWorks>>,
  title: string,
  chatStoryId?: string,
) {
  const linked = chatStoryId ? findStory(snap, chatStoryId) : undefined;
  if (linked?.title === title) return linked;
  return findStoryByTitle(snap, title);
}
