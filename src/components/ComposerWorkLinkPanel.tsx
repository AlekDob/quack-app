import { useMemo, useState } from "react";
import { formatWorkHitTitle } from "../worksUi";
import {
  statusLabel,
  storyLabel,
  type WorkItem,
  type WorkStory,
  type WorksSnapshot,
} from "../works";
import { Icon } from "./Icon";

type Props = {
  snap: WorksSnapshot | null;
  excludeWorkId?: string;
  excludeStoryId?: string;
  worksOnly?: boolean;
  storiesOnly?: boolean;
  onPickWork: (workId: string) => void;
  onPickStory: (storyId: string) => void;
};

function workHaystack(w: WorkItem): string {
  return `${w.shortId} ${w.title}`.toLowerCase();
}

function storyHaystack(s: WorkStory): string {
  return `${s.shortId} ${s.title}`.toLowerCase();
}

function byUpdated<T extends { updatedAt: number }>(a: T, b: T): number {
  return b.updatedAt - a.updatedAt;
}

export function ComposerWorkLinkPanel({
  snap,
  excludeWorkId,
  excludeStoryId,
  worksOnly = false,
  storiesOnly = false,
  onPickWork,
  onPickStory,
}: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const stories = useMemo(() => {
    if (!snap || worksOnly) return [];
    return snap.stories
      .filter((s) => s.id !== excludeStoryId)
      .filter((s) => !q || storyHaystack(s).includes(q))
      .sort(byUpdated)
      .slice(0, 12);
  }, [snap, worksOnly, excludeStoryId, q]);

  const items = useMemo(() => {
    if (!snap || storiesOnly) return [];
    return snap.items
      .filter((w) => w.id !== excludeWorkId)
      .filter((w) => !q || workHaystack(w).includes(q))
      .sort(byUpdated)
      .slice(0, 12);
  }, [snap, storiesOnly, excludeWorkId, q]);

  const empty = stories.length === 0 && items.length === 0;

  return (
    <div className="ai-composer-work-link-panel">
      <div className="ai-composer-work-link-head">
        <Icon name="search" size={13} />
        <input
          className="ai-composer-work-link-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search work or story…"
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      <div className="ai-composer-work-link-list">
        {empty && (
          <p className="ai-composer-work-link-empty">No matches</p>
        )}
        {stories.length > 0 && (
          <div className="ai-composer-work-link-group">
            <div className="ai-composer-work-link-label">Stories</div>
            {stories.map((s) => (
              <button
                key={s.id}
                type="button"
                className="ai-composer-work-link-row ai-composer-work-link-row--story"
                onClick={() => onPickStory(s.id)}
              >
                <span className="ai-composer-work-link-icon">
                  <Icon name="users" size={12} />
                </span>
                <span className="ai-composer-work-link-text">
                  <span className="ai-composer-work-link-title">
                    {s.shortId} · {s.title}
                  </span>
                  <span className="ai-composer-work-link-meta">
                    {storyLabel(s.status)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div className="ai-composer-work-link-group">
            <div className="ai-composer-work-link-label">Work items</div>
            {items.map((w) => (
              <button
                key={w.id}
                type="button"
                className="ai-composer-work-link-row"
                onClick={() => onPickWork(w.id)}
              >
                <span className="ai-composer-work-link-icon">
                  <Icon name="check-square" size={12} />
                </span>
                <span className="ai-composer-work-link-text">
                  <span className="ai-composer-work-link-title">
                    {formatWorkHitTitle(w)}
                  </span>
                  <span className="ai-composer-work-link-meta">
                    {statusLabel(w.status)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
