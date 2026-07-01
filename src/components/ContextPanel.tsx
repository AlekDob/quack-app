// "Context" view of the Usage tab. Shows how much system-prompt weight
// each skill / subagent adds (they're injected on every session) and how
// often each skill was actually invoked across all local transcripts. A
// per-skill visibility toggle writes `skillOverrides` into settings.json:
// "name-only" drops the heavy description while keeping the skill callable,
// "user-invocable-only" hides it from the model entirely (still /-invocable).
// Backed by the Rust `claude_context_assets` / `claude_set_skill_override`.
import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "./Icon";
import { openFileAndReveal } from "../revealInTree";
import { setFrontmatterScalar } from "../frontmatter";

interface ContextAsset {
  name: string;
  description: string;
  source: string; // "user" | "project" | "plugin:<name>"
  kind: string; // "skill" | "agent"
  path: string; // absolute path to SKILL.md / agent .md
  est_tokens: number; // full weight (name + description)
  effective_tokens: number; // what it costs given the current override
  visibility: string; // "on" | "name-only" | "user-invocable-only" | "off"
  togglable: boolean; // user/project skills carry a visibility toggle
  use_count: number;
}

interface ContextReport {
  now_ms: number;
  assets: ContextAsset[];
  total_tokens: number; // sum of effective_tokens
  skill_count: number;
  agent_count: number;
  unused_count: number;
  unused_tokens: number;
}

// Rank unused-first (the optimization lens) or pure weight. Both break
// ties by token weight so the biggest wins float up.
type SortKey = "unused" | "impact";

// Visibility states. User (global) skills go through skillOverrides in
// settings.json and support the full set (incl. "name-only", which only
// exists there). Project skills write their frontmatter — the versioned,
// per-Anthropic-docs source of truth — which only knows on/hidden (no
// "name-only" concept). We skip bare "off" (a known listing bug).
const VIS_USER: { value: string; label: string }[] = [
  { value: "on", label: "On" },
  { value: "name-only", label: "Name only" },
  { value: "user-invocable-only", label: "Hidden" },
];
const VIS_PROJECT: { value: string; label: string }[] = [
  { value: "on", label: "On" },
  { value: "user-invocable-only", label: "Hidden" },
];

function fmtTok(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}

function sourceLabel(src: string): string {
  if (src === "user") return "global";
  if (src === "project") return "project";
  return src.replace("plugin:", "plug:");
}

export function ContextPanel({ wsId, root }: { wsId: string; root: string }) {
  const [report, setReport] = useState<ContextReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("unused");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await invoke<ContextReport>("claude_context_assets", { root }));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [root]);

  useEffect(() => {
    void load();
  }, [load]);

  // Route the write by source: project skills → their SKILL.md frontmatter
  // (versioned source of truth); user skills → skillOverrides in settings.
  const setVisibility = async (a: ContextAsset, value: string) => {
    setBusy(a.name);
    try {
      if (a.source === "project") {
        // Frontmatter only knows hidden vs visible; "on" clears the flag.
        const hidden = value === "user-invocable-only" ? true : null;
        await setFrontmatterScalar(a.path, "disable-model-invocation", hidden);
        await invoke("claude_invalidate_context_cache");
      } else {
        await invoke("claude_set_skill_override", { name: a.name, value });
      }
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const { sorted, maxTok } = useMemo(() => sortAssets(report, sortKey), [report, sortKey]);

  if (error) return <div className="usage-error">Failed to load context: {error}</div>;
  if (!report) return <div className="usage-loading">Scanning skills & plugins…</div>;

  return (
    <>
      <ContextSummary report={report} />
      <p className="ctx-note">
        Every skill and agent you've installed is loaded into the context of{" "}
        <strong>every</strong> chat session — taking up space even when you don't use it.
        Here's how much each one weighs (~estimated tokens) and how often you've actually
        used it. Trim the ones you don't need with the menu on the right of each row:
      </p>
      <ul className="ctx-legend">
        <li><strong>On</strong> — loaded normally (name + description).</li>
        <li>
          <strong>Name only</strong> — loads just the name: near-zero weight, but still
          usable (Claude can still find it). <em>Global skills only.</em>
        </li>
        <li>
          <strong>Hidden</strong> — out of context entirely: only you can call it by
          typing <code>/name</code> in the chat.
        </li>
        <li className="ctx-legend-src">
          <strong>Global</strong> skills are written to <code>settings.json</code>;{" "}
          <strong>project</strong> skills to their <code>SKILL.md</code> frontmatter
          (versioned with the repo).
        </li>
      </ul>
      <div className="usage-controls">
        <div className="usage-sort">
          <label>Sort by</label>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="unused">Never used first</option>
            <option value="impact">Heaviest first</option>
          </select>
        </div>
      </div>
      <ul className="ctx-list">
        {sorted.map((a) => (
          <AssetRow
            key={`${a.source}:${a.kind}:${a.name}`}
            a={a}
            maxTok={maxTok}
            busy={busy === a.name}
            onOpen={() => void openFileAndReveal(wsId, a.path)}
            onSetVisibility={(v) => void setVisibility(a, v)}
          />
        ))}
      </ul>
    </>
  );
}

// Sort assets and compute the bar-scaling max in one pass.
function sortAssets(report: ContextReport | null, sortKey: SortKey) {
  if (!report) return { sorted: [] as ContextAsset[], maxTok: 1 };
  const sorted = report.assets.slice();
  const maxTok = Math.max(1, ...sorted.map((a) => a.est_tokens));
  sorted.sort((a, b) => {
    if (sortKey === "unused") {
      const au = a.kind === "skill" && a.use_count === 0 ? 0 : 1;
      const bu = b.kind === "skill" && b.use_count === 0 ? 0 : 1;
      if (au !== bu) return au - bu;
    }
    return b.est_tokens - a.est_tokens;
  });
  return { sorted, maxTok };
}

// Four metric cards — total (effective) context weight is the anchor,
// "never used" is the savings opportunity (highlighted).
function ContextSummary({ report }: { report: ContextReport }) {
  return (
    <div className="usage-summary">
      <Stat label="Context weight">~{fmtTok(report.total_tokens)} tok</Stat>
      <Stat label="Skills">{report.skill_count}</Stat>
      <Stat label="Agents">{report.agent_count}</Stat>
      <Stat label="Never used" highlight>
        {report.unused_count}
        <span className="ctx-stat-sub">~{fmtTok(report.unused_tokens)} tok wasted</span>
      </Stat>
    </div>
  );
}

function Stat(props: { label: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div className={`usage-stat ${props.highlight ? "is-highlight" : ""}`}>
      <span className="usage-stat-label">{props.label}</span>
      <span className="usage-stat-value">{props.children}</span>
    </div>
  );
}

// One asset row: impact bar + kind icon + name + badges + weight. Click
// opens the backing .md (and reveals it in the tree if it's a project
// file). User/project skills get a visibility toggle; never-used skills
// carry a warn trace. When dimmed by an override, the effective weight
// is what's shown.
function AssetRow(props: {
  a: ContextAsset;
  maxTok: number;
  busy: boolean;
  onOpen: () => void;
  onSetVisibility: (value: string) => void;
}) {
  const { a, maxTok, busy, onOpen, onSetVisibility } = props;
  const unused = a.kind === "skill" && a.use_count === 0;
  const muted = a.visibility !== "on";
  const pct = Math.max(3, Math.round((a.est_tokens / maxTok) * 100));
  return (
    <li
      className={`ctx-row ${unused ? "is-unused" : ""} ${muted ? "is-muted" : ""}`}
      title={`${a.description}\n\nClick to open ${a.path}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="ctx-bar" aria-hidden="true">
        <div className="ctx-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <Icon
        name={a.kind === "agent" ? "bot" : "zap"}
        size={13}
        className="ctx-kind-icon"
        title={a.kind}
      />
      <div className="ctx-row-main">
        <span className="ctx-name">{a.name}</span>
        <span className={`ctx-tag src-${a.source.startsWith("plugin") ? "plugin" : a.source}`}>
          {sourceLabel(a.source)}
        </span>
        {a.kind === "skill" && (
          <span className={`ctx-use ${unused ? "is-zero" : ""}`}>
            {unused ? "never used" : `${a.use_count}×`}
          </span>
        )}
      </div>
      <span className="ctx-tok" title={muted ? `Full ~${fmtTok(a.est_tokens)}` : undefined}>
        ~{fmtTok(a.effective_tokens)}
      </span>
      {a.togglable && (
        <select
          className="ctx-vis"
          value={a.visibility === "name-only" && a.source === "project" ? "on" : a.visibility}
          disabled={busy}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            onSetVisibility(e.target.value);
          }}
          title={
            a.source === "project"
              ? "Visibility — writes disable-model-invocation in SKILL.md (versioned)"
              : "Visibility — writes skillOverrides in settings.json"
          }
        >
          {(a.source === "project" ? VIS_PROJECT : VIS_USER).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
