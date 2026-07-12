import { useState, type CSSProperties } from "react";
import type { WorkComment } from "../../works";
import { Icon } from "../Icon";

function formatRelativeMs(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function avatarClass(source?: WorkComment["source"]): string {
  if (source === "agent") return "work-comment-avatar work-comment-avatar--agent";
  if (source === "sync") return "work-comment-avatar work-comment-avatar--sync";
  return "work-comment-avatar";
}

type Props = {
  comments: WorkComment[];
  draft: string;
  onDraft: (v: string) => void;
  onPost: () => void;
  posting?: boolean;
};

export function WorkComments({
  comments,
  draft,
  onDraft,
  onPost,
  posting,
}: Props) {
  const [tab, setTab] = useState<"all" | "comments">("all");
  const shown =
    tab === "comments"
      ? comments.filter((c) => c.source !== "sync")
      : comments;

  const canPost = draft.trim().length > 0 && !posting;

  return (
    <section className="work-comments">
      <div className="work-comments-tabs">
        <button
          type="button"
          className={`work-comments-tab${tab === "all" ? " active" : ""}`}
          onClick={() => setTab("all")}
        >
          Activity
          {comments.length > 0 && (
            <span className="work-comments-tab-count">{comments.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`work-comments-tab${tab === "comments" ? " active" : ""}`}
          onClick={() => setTab("comments")}
        >
          Comments
        </button>
      </div>

      <div className="work-comments-feed">
        {shown.length === 0 && (
          <p className="work-comments-empty">No activity yet — start the thread.</p>
        )}
        {shown.map((c, i) => (
          <article
            key={c.id}
            className={`work-comment-card${
              c.source === "agent" ? " work-comment-card--agent" : ""
            }`}
            style={{ "--i": i } as CSSProperties}
          >
            <div className={avatarClass(c.source)} aria-hidden>
              {initials(c.author)}
            </div>
            <div className="work-comment-body">
              <header className="work-comment-head">
                <span className="work-comment-author">{c.author}</span>
                {c.source === "agent" && (
                  <span className="work-comment-badge">Agent</span>
                )}
                <time
                  className="work-comment-time"
                  dateTime={new Date(c.createdAt).toISOString()}
                >
                  {formatRelativeMs(c.createdAt)}
                </time>
              </header>
              <p className="work-comment-text">{c.body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="work-comments-composer">
        <div className="work-comment-avatar" aria-hidden>
          {initials("You")}
        </div>
        <div className="work-comments-composer-main">
          <textarea
            className="work-comments-composer-input"
            placeholder="Leave a comment…"
            value={draft}
            rows={1}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canPost) {
                e.preventDefault();
                onPost();
              }
            }}
          />
          <div className="work-comments-composer-actions">
            <span className="work-comments-composer-hint">⌘↵ to send</span>
            <button
              type="button"
              className="work-comments-send"
              disabled={!canPost}
              onClick={onPost}
              aria-label="Post comment"
            >
              <Icon name="send" size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
