// Session transcript pane — read-only, chunked viewer for a Claude Code
// session. Renders N turns at a time via the Rust
// `claude_session_load_turns` command and lazy-loads the next batch
// when the user scrolls near the bottom. The total transcript can be
// tens of MB; we never load more than `CHUNK_SIZE` turns into memory
// at once, and each turn truncates its own tool input/result preview.
//
// Brain: claude-usage-spike
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { renderMarkdown } from "../markdown";
import { parseKey } from "../store";

interface TurnToolUse {
  id: string;
  name: string;
  input_preview: string;
}
interface TurnToolResult {
  tool_use_id: string;
  content_preview: string;
  is_error: boolean;
}
interface Turn {
  index: number;
  kind: string;
  timestamp: string;
  text: string;
  thinking: string;
  tool_uses: TurnToolUse[];
  tool_results: TurnToolResult[];
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}
interface TurnChunk {
  session_id: string;
  project: string;
  total: number;
  offset: number;
  limit: number;
  turns: Turn[];
  first_ts: string;
  last_ts: string;
  total_cost_usd: number;
  total_turns_approx: number;
}

const INITIAL_SIZE = 15;       // first chunk (cheap)
const PAGE_SIZE = 30;          // subsequent chunks (user-triggered)

interface Props {
  tabKey: string;
}

// Performance budget: keep first paint under ~100ms even on the worst
// 1500-turn Virgilio session. The collapse-on-open pattern means every
// turn renders as one short line (kind · ts · truncated text) until the
// user clicks to expand it — no markdown parsing, no tool cards, no
// token stats, no thinking on initial render.
export function SessionTranscriptPane({ tabKey }: Props) {
  const meta = useMemo(() => parseKey(tabKey), [tabKey]);
  const project = meta?.kind === "session" ? meta.project : "";
  const sessionId = meta?.kind === "session" ? meta.sessionId : "";

  const [chunk, setChunk] = useState<TurnChunk | null>(null);
  const [loaded, setLoaded] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const totalRef = useRef(0);
  const loadingRef = useRef(false);
  const requestedAllRef = useRef(false);
  // Request generation. A reset (path change, or StrictMode's double
  // mount) bumps this; any in-flight fetch that captured an older gen
  // discards its result instead of appending it. Without this, the
  // StrictMode double-invoke fired two initial loads and appended the
  // same turns twice — the "twin turns" bug.
  const genRef = useRef(0);
  const [showAll, setShowAll] = useState(false);

  const fetchChunk = useCallback(
    async (offset: number, limit: number) => {
      if (loadingRef.current) return;
      const myGen = genRef.current;
      loadingRef.current = true;
      setLoading(true);
      try {
        const next = await invoke<TurnChunk>("claude_session_load_turns", {
          project,
          sessionId,
          offset,
          limit,
        });
        if (genRef.current !== myGen) return; // stale — a reset happened
        setChunk(next);
        totalRef.current = next.total;
        offsetRef.current = next.offset + next.turns.length;
        setLoaded((prev) => [...prev, ...next.turns]);
      } catch (e) {
        if (genRef.current === myGen) setError(String(e));
      } finally {
        if (genRef.current === myGen) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [project, sessionId],
  );

  // Reset + load initial chunk on path change. Bumping genRef first
  // invalidates any load still in flight from a previous mount/session.
  useEffect(() => {
    genRef.current += 1;
    setChunk(null);
    setLoaded([]);
    setError(null);
    offsetRef.current = 0;
    totalRef.current = 0;
    loadingRef.current = false;
    requestedAllRef.current = false;
    setShowAll(false);
    if (project && sessionId) {
      void fetchChunk(0, INITIAL_SIZE);
    }
    // Invalidate on unmount too, so a resolving fetch can't write into a
    // torn-down component.
    return () => {
      genRef.current += 1;
    };
  }, [project, sessionId, fetchChunk]);

  if (meta?.kind !== "session") {
    return (
      <div className="session-transcript-pane">
        <div className="session-transcript-error">
          Not a session tab: {tabKey}
        </div>
      </div>
    );
  }

  const remaining = chunk ? Math.max(0, chunk.total - loaded.length) : 0;
  const headerTotal = chunk?.total ?? 0;

  return (
    <div className="session-transcript-pane">
      <div className="session-transcript-header">
        <div className="session-transcript-title">
          Session <code>{sessionId.slice(0, 8)}</code>
        </div>
        {chunk && (
          <div className="session-transcript-meta">
            <span>{headerTotal} turns</span>
            <span>·</span>
            <span>${chunk.total_cost_usd.toFixed(2)}</span>
            <span>·</span>
            <span>
              {loaded.length} loaded · {remaining} remaining
            </span>
          </div>
        )}
      </div>

      {error && <div className="session-transcript-error">{error}</div>}

      {loaded.length === 0 && !loading && !error && (
        <div className="session-transcript-empty">
          No turns in this session.
        </div>
      )}

      {loaded.map((turn, i) => (
        <TurnBlock key={`${turn.index}-${i}`} turn={turn} index={turn.index} />
      ))}

      <div className="session-transcript-footer">
        {loading && (
          <div className="session-transcript-loading">Loading…</div>
        )}
        {!loading && chunk && remaining > 0 && (
          <>
            <button
              className="session-transcript-loadmore"
              onClick={() => {
                const limit = showAll
                  ? chunk.total - loaded.length
                  : PAGE_SIZE;
                void fetchChunk(offsetRef.current, limit);
              }}
            >
              Load {Math.min(PAGE_SIZE, remaining)} more turns
              <span className="session-transcript-loadmore-meta">
                ({remaining} remaining)
              </span>
            </button>
            <button
              className="session-transcript-loadmore session-transcript-loadmore-all"
              onClick={() => {
                setShowAll(true);
                void fetchChunk(
                  offsetRef.current,
                  chunk.total - loaded.length,
                );
              }}
            >
              Load all {remaining} turns
            </button>
          </>
        )}
        {!loading && chunk && remaining === 0 && chunk.total > 0 && (
          <div className="session-transcript-end">
            End of session ({chunk.total} turns).
          </div>
        )}
      </div>
    </div>
  );
}

// One turn = one short collapsed row by default. Clicking expands it
// into the full markdown + tool cards + token stats. This is the
// key performance trick: with 1500 turns × ~5KB each, the initial
// render is ~500KB of plain text (no markdown, no JSX trees, no
// DOM children) which paints in one frame. Expansion is per-row, so
// the cost is amortised across clicks.
function TurnBlock({ turn, index }: { turn: Turn; index: number }) {
  const [open, setOpen] = useState(false);
  const isAssistant = turn.kind === "assistant";

  // Only run the (relatively expensive) markdown renderer when the user
  // has explicitly opened this turn. Below the threshold, plain text is
  // plenty for scanning.
  const html = useMemo(() => {
    if (!open || !turn.text) return "";
    try {
      return renderMarkdown(turn.text);
    } catch {
      return escapeHtml(turn.text);
    }
  }, [open, turn.text]);

  const previewText = useMemo(() => {
    if (turn.text.length <= 240) return turn.text;
    return turn.text.slice(0, 240) + "…";
  }, [turn.text]);

  const tokenSum =
    turn.input_tokens +
    turn.output_tokens +
    turn.cache_read_tokens +
    turn.cache_creation_tokens;

  return (
    <div
      className={`session-turn ${isAssistant ? "is-assistant" : "is-user"} ${open ? "is-open" : ""}`}
      data-turn-index={index}
    >
      <button
        type="button"
        className="session-turn-collapsed"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="session-turn-kind">
          {isAssistant ? "Assistant" : "User"}
        </span>
        <span className="session-turn-idx">#{index + 1}</span>
        <span className="session-turn-preview">{previewText}</span>
        <span className="session-turn-ts">{fmtTs(turn.timestamp)}</span>
        {turn.cost_usd > 0 && (
          <span className="session-turn-cost">+${turn.cost_usd.toFixed(3)}</span>
        )}
      </button>

      {open && (
        <div className="session-turn-expanded">
          {html && (
            <div
              className="session-turn-md"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          {turn.thinking && (
            <details className="session-turn-thinking">
              <summary>Thinking ({turn.thinking.length} chars)</summary>
              <pre>{turn.thinking.slice(0, 4000)}
                {turn.thinking.length > 4000 ? "\n…(truncated)" : ""}</pre>
            </details>
          )}

          {turn.tool_uses.length > 0 && (
            <ul className="session-turn-tools">
              {turn.tool_uses.map((t) => (
                <li key={t.id} className="session-turn-tool-use">
                  <span className="session-turn-tool-name">{t.name}</span>
                  <code className="session-turn-tool-id">{t.id.slice(0, 12)}…</code>
                  <pre>{t.input_preview.slice(0, 400)}
                    {t.input_preview.length > 400 ? "\n…(truncated)" : ""}</pre>
                </li>
              ))}
            </ul>
          )}

          {turn.tool_results.length > 0 && (
            <ul className="session-turn-tool-results">
              {turn.tool_results.map((t, i) => (
                <li
                  key={`${t.tool_use_id}-${i}`}
                  className={`session-turn-tool-result ${t.is_error ? "is-error" : ""}`}
                >
                  <span className="session-turn-tool-id">{t.tool_use_id.slice(0, 12)}…</span>
                  <pre>{t.content_preview.slice(0, 400)}
                    {t.content_preview.length > 400 ? "\n…(truncated)" : ""}</pre>
                </li>
              ))}
            </ul>
          )}

          {tokenSum > 0 && (
            <div className="session-turn-tokens">
              in {fmtNum(turn.input_tokens)} · out {fmtNum(turn.output_tokens)}
              {turn.cache_read_tokens > 0 && (
                <> · cache r {fmtNum(turn.cache_read_tokens)}</>
              )}
              {turn.cache_creation_tokens > 0 && (
                <> · cache w {fmtNum(turn.cache_creation_tokens)}</>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtTs(ts: string): string {
  if (!ts) return "";
  return ts.replace("T", " ").replace(/\.\d+Z?$/, "").replace("Z", "");
}

function fmtNum(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}