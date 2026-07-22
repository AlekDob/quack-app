import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { matchExclusion } from "../aiPrivacy";
import { publishAskInput } from "../askQuestionStore";
import { getPermModeFor } from "../permModeStore";
import { error as toastError } from "../notify";
import { getJson as lsGetJson, setJson as lsSetJson } from "../localStore";
import { Icon } from "./Icon";
import { MarkdownPreview } from "./MarkdownPreview";
import {
  clearPlanBuyIn,
  publishPlanBuyIn,
  setPlanBuyInDecide,
} from "../planBuyInStore";

/**
 * Per-user always-allow rules persisted in localStorage. Three kinds:
 *   - Bare tool name (e.g. "Read") — auto-allow ANY call to that tool.
 *     Bash is intentionally excluded from this path; see NEVER_BLANKET_ALLOW.
 *   - "Bash:<prefix>" — auto-allow Bash calls whose command's first
 *     whitespace-delimited token equals <prefix>. Lets the user say
 *     "I always want grep / npm / git diff to run without asking" while
 *     keeping `rm -rf` etc. behind the card.
 *   - "Ext:<.ext>:<tool>" — auto-allow file-touching tools (Edit, Write,
 *     Read, MultiEdit, NotebookEdit) when the target file's extension
 *     matches. Per-tool so "always allow .ts edits" doesn't accidentally
 *     also allow .ts writes. Stored lowercased, leading dot.
 *
 * Format: a JSON array of strings. Schema-loose for forward compat.
 */
const ALLOW_ALWAYS_KEY = "lcp.claudeCode.alwaysAllow";

/** Tools whose primary input is a file path. Used for the per-extension
 *  always-allow tier — irrelevant for tools like Bash or WebFetch. */
const PATH_TOOLS = new Set([
  "Edit",
  "MultiEdit",
  "Write",
  "Read",
  "NotebookEdit",
  "NotebookRead",
  "Grep",
  "Glob",
]);

/** Read-only tools that are in the hook matcher ONLY so the privacy
 *  gate can see them. They auto-allow immediately after that check —
 *  never a permission card — so gating them adds zero friction.
 *  (Limit: the hook sees tool INPUTS, so Grep/Glob are gated on their
 *  `path` argument; a workspace-wide Grep that merely matches lines
 *  inside an excluded file can't be filtered at this layer. Read — the
 *  high-bandwidth leak — is fully covered.) */
const READ_ONLY_HOOK_TOOLS = new Set([
  "Read",
  "Grep",
  "Glob",
  "NotebookRead",
]);

interface ExtRule {
  ext: string; // ".ts" lowercased, leading dot
  tool: string;
}

interface AllowRules {
  /** Tools auto-allowed in full (e.g. "Read", "Edit"). */
  tools: Set<string>;
  /** Bash command-prefix tokens auto-allowed (e.g. "grep", "npm"). */
  bashPrefixes: Set<string>;
  /** Per-tool file-extension allows (e.g. Edit on .ts). */
  exts: ExtRule[];
}

function loadAllow(): AllowRules {
  const out: AllowRules = {
    tools: new Set(),
    bashPrefixes: new Set(),
    exts: [],
  };
  const arr = lsGetJson<unknown[]>(ALLOW_ALWAYS_KEY, [], Array.isArray);
  for (const v of arr) {
    if (typeof v !== "string") continue;
    if (v.startsWith("Bash:")) out.bashPrefixes.add(v.slice(5));
    else if (v.startsWith("Ext:")) {
      const rest = v.slice(4);
      const colon = rest.indexOf(":");
      if (colon < 0) continue;
      const ext = rest.slice(0, colon).toLowerCase();
      const tool = rest.slice(colon + 1);
      if (ext && tool) out.exts.push({ ext, tool });
    } else out.tools.add(v);
  }
  return out;
}

function persistAllow(rules: AllowRules): void {
  const flat = [
    ...rules.tools,
    ...[...rules.bashPrefixes].map((p) => `Bash:${p}`),
    ...rules.exts.map((r) => `Ext:${r.ext}:${r.tool}`),
  ];
  lsSetJson(ALLOW_ALWAYS_KEY, flat);
}

function pathFromInput(input: Record<string, unknown>): string | null {
  const fp = input.file_path;
  if (typeof fp === "string" && fp) return fp;
  const np = input.notebook_path;
  if (typeof np === "string" && np) return np;
  // Grep/Glob scope their search via a plain `path` argument.
  const p = input.path;
  if (typeof p === "string" && p) return p;
  return null;
}

function extFromPath(path: string): string | null {
  const norm = path.replace(/\\/g, "/");
  const base = norm.slice(norm.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null; // no ext or trailing dot
  return base.slice(dot).toLowerCase();
}

/** File-writing tools auto-allowed in the "acceptEdits" (Auto-edit) mode.
 *  Read/Grep/Glob are NOT here — they auto-allow as read-only regardless. */
const WRITE_TOOLS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

/** Jack can delegate exploration (Task/subagent, todos) while still in CC
 *  plan mode — only ExitPlanMode + file writes should card. */
const PLAN_EXPLORE_TOOLS = new Set([
  "Task",
  "Agent",
  "TaskCreate",
  "TaskUpdate",
  "TaskList",
  "TodoWrite",
]);

/** Read/search tools Jack and explore subagents use while planning. */
const PLAN_READ_TOOLS = new Set([
  "ToolSearch",
  "WebSearch",
  "WebFetch",
]);

/** git subcommands that are read-only even with arguments. `branch`, `tag`,
 *  `config`, `remote` are excluded — they all have mutating forms. */
const GIT_RO_SUBCMDS = new Set([
  "status", "log", "diff", "show", "blame", "ls-files", "rev-parse",
  "describe",
]);

/** Mutating / risky Bash — never auto-allow, even in Plan explore.
 *  `exec`/`eval` are checked as command heads below — `\bexec\b` would
 *  false-positive on `find … -exec` (common Plan explore pattern). */
const PLAN_DANGEROUS_BASH_RE =
  /\b(rm|rmdir|mv|cp|chmod|chown|mkdir|touch|truncate|tee|sudo|kill|pkill)\b|\bsed\s+-i\b|\b(npm|pnpm|yarn)\s+(install|add|remove|publish)\b|\bpip\s+install\b|\bgit\s+(add|commit|push|merge|checkout|reset|revert|stash|clean)\b/;

/** Shell builtins that rewrite the process — only when they are the command. */
const PLAN_DANGEROUS_HEADS = new Set(["eval", "exec"]);

function stripStderrRedirects(part: string): string {
  return part.replace(/\s*2>\s*(&\d+|\/dev\/null|\S+)/g, "");
}

function hasStdoutRedirect(part: string): boolean {
  const bare = stripStderrRedirects(part);
  return /(^|[^\d])>{1,2}/.test(bare);
}

function skipEnvAssigns(segment: string): string {
  let s = segment.trim();
  const envRe = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=/;
  while (envRe.test(s)) {
    s = s
      .replace(/^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)\s*/, "")
      .trim();
  }
  return s;
}

function bashHead(part: string): string {
  const rest = skipEnvAssigns(part);
  if (!rest) return "";
  return rest.split(/\s+/)[0] ?? "";
}

function isPlanExploreBashPart(part: string): boolean {
  const p = stripStderrRedirects(part.trim());
  if (!p) return true;
  if (hasStdoutRedirect(p) || /\$\(|`/.test(p)) return false;
  if (PLAN_DANGEROUS_BASH_RE.test(p)) return false;
  const head = bashHead(p);
  if (!head) return true;
  if (PLAN_DANGEROUS_HEADS.has(head)) return false;
  if (head === "git") return GIT_RO_SUBCMDS.has(p.split(/\s+/)[1] ?? "");
  return true;
}

function planExplorePipe(link: string): boolean {
  const pipes = link.split(/\|/).map((s) => s.trim()).filter(Boolean);
  return pipes.length > 0 && pipes.every(isPlanExploreBashPart);
}

function planExploreChain(seg: string): boolean {
  const chains = seg.split(/&&/).map((s) => s.trim()).filter(Boolean);
  return chains.length > 0 && chains.every(planExplorePipe);
}

/** Plan-mode explore Bash — pipes, env assigns, stderr redirect; block writes.
 *  Split on `;`/`&` only when not escaped (`find … -exec … \;`). */
function isPlanExploreBash(input: Record<string, unknown>): boolean {
  const cmd = typeof input.command === "string" ? input.command : "";
  if (!cmd.trim()) return false;
  const flat = cmd.replace(/\n+/g, ";").trim();
  const segments = flat
    .split(/(?<!\\)[;&]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.length > 0 && segments.every(planExploreChain);
}

/** CC's own scratch plan file (~/.claude/plans/*.md) is not a project edit —
 *  it's the CLI's internal plan-mode bookkeeping, so writes to it auto-allow
 *  even though WRITE_TOOLS otherwise card in Plan mode. */
function isPlanFileWrite(req: PermissionRequest): boolean {
  if (!WRITE_TOOLS.has(req.tool_name)) return false;
  const p = pathFromInput(req.tool_input);
  if (!p) return false;
  return /(^|[\\/])\.claude[\\/]plans[\\/]/.test(p.replace(/\\/g, "/"));
}

/** Sidechain (Task subagent) explore — auto in Plan unless it's a write. */
function isPlanSidechainExplore(req: PermissionRequest): boolean {
  if (!req.parent_tool_use_id) return false;
  if (isPlanFileWrite(req)) return true;
  if (WRITE_TOOLS.has(req.tool_name) || req.tool_name === "ExitPlanMode") {
    return false;
  }
  if (req.tool_name === "Bash") return isPlanExploreBash(req.tool_input);
  return true;
}

function planModeAutoAllow(
  req: PermissionRequest,
  sessionExplore: boolean,
): boolean {
  if (isPlanFileWrite(req)) return true;
  if (sessionExplore) {
    if (req.tool_name === "ExitPlanMode") return false;
    if (WRITE_TOOLS.has(req.tool_name)) return false;
    if (req.tool_name === "Bash") return isPlanExploreBash(req.tool_input);
    return true;
  }
  if (isPlanSidechainExplore(req)) return true;
  if (PLAN_EXPLORE_TOOLS.has(req.tool_name)) return true;
  if (PLAN_READ_TOOLS.has(req.tool_name)) return true;
  return req.tool_name === "Bash" && isPlanExploreBash(req.tool_input);
}

/**
 * Auto-allow driven by the chat's Claude Code permission mode (the composer
 * mode menu / `/mode`). Runs AFTER the privacy gate and read-only allow so
 * those safety checks always win. Mode is resolved per-request via the
 * session-id/cwd bridge in permModeStore.
 *   - "auto"        → allow everything (Bash included). The user opted into
 *                     "stop asking"; privacy exclusions + AskUserQuestion
 *                     redirect still apply (handled before this).
 *   - "acceptEdits" → allow file-edit tools only; Bash & the rest still card.
 *   - "plan"        → allow read-only Bash + Task/subagent delegation
 *                     (Read/Grep/Glob already auto-allow upstream). The CLI
 *                     blocks edits in plan mode; ExitPlanMode still cards.
 *   - anything else → no mode-based allow (Ask shows the card).
 * ("bypassPermissions" is handled earlier in the listener — it allows before
 *  the privacy gate — so it never reaches here.)
 */
function modeAutoAllow(
  req: PermissionRequest,
  planSessionExplore: boolean,
  mode: string,
): boolean {
  if (mode === "auto") return true;
  if (mode === "acceptEdits") return WRITE_TOOLS.has(req.tool_name);
  if (mode === "plan") return planModeAutoAllow(req, planSessionExplore);
  return false;
}

/** Composer mode for THIS panel — authoritative over permModeStore lookups
 *  that can miss when subagent cwd/session diverges from the chat root. */
function panelPermMode(
  ownerPermMode: string | null | undefined,
  req: PermissionRequest,
): string {
  if (ownerPermMode !== undefined) return ownerPermMode ?? "default";
  return getPermModeFor(req);
}

/** Tools we refuse to add as bare-name always-allow even if user clicks.
 *  ExitPlanMode is a per-plan approval — blanket-allowing it would defeat
 *  the whole point of the confirmation. */
const NEVER_BLANKET_ALLOW = new Set(["Bash", "ExitPlanMode"]);

/** First whitespace-delimited token of a Bash command. */
function bashFirstToken(cmd: string): string {
  return cmd.trim().split(/\s+/, 1)[0] ?? "";
}

/** Shell metacharacters that can chain a second command behind an
 *  allowed prefix: `git status; rm -rf ~`, `git status && curl …`,
 *  pipes, backticks, $() substitution, newlines. Commands containing
 *  any of these never auto-allow — the permission card is shown so the
 *  user sees the full compound command. */
const BASH_CHAIN_RE = /[;&|`\n<>]|\$\(/;

interface PermissionRequest {
  request_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  cwd?: string | null;
  session_id?: string | null;
  parent_tool_use_id?: string | null;
}

/** Normalize a path for owner-matching: forward slashes, no trailing
 *  separator, lowercased (macOS/Windows are case-insensitive; a stray
 *  case difference must not misroute a card). */
function normRoot(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/**
 * Route guard: does this permission request belong to the AIChatPanel
 * that mounts THIS overlay? The permission server is app-wide (one port,
 * one global `claude:permission-request` event), so every panel's listener
 * sees every request. Filter on workspace cwd first, then Claude session id
 * so two chats in the SAME workspace don't all surface the same card.
 */
function isForThisPanel(
  req: PermissionRequest,
  ownerRoot: string,
  ownerSessionId: string | undefined,
  ownerStreaming: boolean,
): boolean {
  if (req.cwd && ownerRoot) {
    if (normRoot(req.cwd) !== normRoot(ownerRoot)) return false;
  } else if (req.cwd || ownerRoot) {
    if (!req.session_id || !ownerSessionId) return false;
  }

  if (req.session_id) {
    if (ownerSessionId) return req.session_id === ownerSessionId;
    return ownerStreaming;
  }

  if (req.cwd && ownerRoot) return normRoot(req.cwd) === normRoot(ownerRoot);
  return false;
}

/**
 * Decide whether an incoming request should auto-resolve to allow.
 * Pure function — easy to test, no React state involvement.
 */
function shouldAutoAllow(req: PermissionRequest, rules: AllowRules): boolean {
  if (rules.tools.has(req.tool_name) && !NEVER_BLANKET_ALLOW.has(req.tool_name)) {
    return true;
  }
  if (req.tool_name === "Bash") {
    const cmd =
      typeof req.tool_input.command === "string"
        ? req.tool_input.command
        : "";
    const first = bashFirstToken(cmd);
    if (
      first &&
      rules.bashPrefixes.has(first) &&
      !BASH_CHAIN_RE.test(cmd)
    ) {
      return true;
    }
  }
  if (PATH_TOOLS.has(req.tool_name)) {
    const p = pathFromInput(req.tool_input);
    const ext = p ? extFromPath(p) : null;
    if (ext && rules.exts.some((r) => r.ext === ext && r.tool === req.tool_name)) {
      return true;
    }
  }
  return false;
}

/**
 * Floating modal that surfaces Claude Code's PreToolUse permission
 * requests. Two-tier always-allow:
 *   - Tool-name (Read/Edit/Write/etc.) → auto-allow on next request
 *   - Bash command prefix (grep, npm, git, …) → auto-allow that prefix
 *
 * Plus a "this session" tier that lives in memory only and resets on
 * app restart — for "I'm doing focused work, stop interrupting me"
 * without committing to a forever-allow.
 */
export function ClaudePermissionOverlay({
  ownerRoot,
  ownerSessionId,
  ownerStreaming,
  ownerPermMode,
  onAllowAll,
  onPlanReady,
  onPlanBuild: _onPlanBuild,
}: {
  /** Workspace cwd this overlay's panel drives — used to route cards. */
  ownerRoot: string;
  /** CC session id of this panel, once it has streamed back (tiebreaker). */
  ownerSessionId?: string;
  /** True while this panel has an in-flight turn (pre-init session routing). */
  ownerStreaming: boolean;
  /** Composer permission mode for this chat — wins over permModeStore lookups
   *  when subagent cwd/session diverges from the panel root. */
  ownerPermMode?: string | null;
  /** Flip this chat to "stop asking" (Auto mode). Wired by AIChatPanel to
   *  setCcPermMode("auto") so the composer chip + persistence stay in sync. */
  onAllowAll?: () => void;
  /** Fired once per ExitPlanMode request, as soon as its plan text lands —
   *  opens the plan in a side-by-side tab (Cursor-style) while the card
   *  is still pending approval. */
  onPlanReady?: (requestId: string, plan: string) => void;
  /** Kept for API compat — Build is handled by PlanBuyInCard in the stream. */
  onPlanBuild?: (requestId: string, plan: string) => void | Promise<void>;
}) {
  const [queue, setQueue] = useState<PermissionRequest[]>([]);

  // Owner identity mirrored to a ref: the listener is registered once and
  // lives forever, so it must read fresh values (claudeSessionId streams in
  // after mount) without re-subscribing.
  const ownerRef = useRef({
    root: ownerRoot,
    sessionId: ownerSessionId,
    streaming: ownerStreaming,
    permMode: ownerPermMode,
  });
  useEffect(() => {
    ownerRef.current = {
      root: ownerRoot,
      sessionId: ownerSessionId,
      streaming: ownerStreaming,
      permMode: ownerPermMode,
    };
  }, [ownerRoot, ownerSessionId, ownerStreaming, ownerPermMode]);

  // Drop stale cards when the user switches chat or the CC session id lands.
  useEffect(() => {
    setQueue((q) =>
      q.filter((r) =>
        isForThisPanel(r, ownerRoot, ownerSessionId, ownerStreaming),
      ),
    );
  }, [ownerRoot, ownerSessionId, ownerStreaming]);

  // Persisted always-allow. Mirrored to a ref so the listener (which
  // is registered once and lives forever) can read fresh state without
  // closure-staleness.
  const [allow, setAllow] = useState<AllowRules>(() => loadAllow());
  const allowRef = useRef(allow);
  useEffect(() => {
    allowRef.current = allow;
  }, [allow]);

  // Session-only allow — in-memory, resets on app reload. Same shape
  // as persisted rules so the auto-resolve check is uniform.
  const sessionAllowRef = useRef<AllowRules>({
    tools: new Set(),
    bashPrefixes: new Set(),
    exts: [],
  });
  // Plan mode: user clicked "Allow exploration" — stop carding reads and
  // subagent tools for this run but keep the composer on Plan (not Auto).
  const planSessionExploreRef = useRef(false);

  useEffect(() => {
    planSessionExploreRef.current = false;
  }, [ownerRoot, ownerSessionId]);

  useEffect(() => {
    const decide = async (
      requestId: string,
      decision: "allow" | "deny",
    ) => {
      try {
        await invoke("claude_perm_decide", { requestId, decision });
      } catch (e) {
        console.warn("plan buy-in decide failed", e);
      }
      setQueue((q) => q.filter((r) => r.request_id !== requestId));
      clearPlanBuyIn({ requestId });
    };
    setPlanBuyInDecide(
      { sessionId: ownerSessionId, cwd: ownerRoot },
      decide,
    );
    return () =>
      setPlanBuyInDecide({ sessionId: ownerSessionId, cwd: ownerRoot }, null);
  }, [ownerSessionId, ownerRoot]);

  useEffect(() => {
    let offReq: (() => void) | undefined;
    let offCancel: (() => void) | undefined;

    void listen<PermissionRequest>("claude:permission-request", (e) => {
      const req = e.payload;
      // ROUTE GUARD — the permission server is app-wide, so this event fires
      // for EVERY running Claude Code session (including background agents in
      // other workspaces). Only handle requests that belong to this panel;
      // another workspace's overlay owns the rest. Without this, a stopped
      // chat surfaces cards from an unrelated project ("permessi dal nulla").
      const owner = ownerRef.current;
      if (
        !isForThisPanel(req, owner.root, owner.sessionId, owner.streaming)
      ) {
        return;
      }
      // AskUserQuestion can't work headless — the CLI's question UI
      // doesn't exist under -p, so the call dies opaquely and the user
      // never sees the question. Deny with a reason that redirects the
      // model to ask in plain text; the question then arrives as a
      // normal assistant message the user can answer in the input.
      if (req.tool_name === "AskUserQuestion") {
        if (req.session_id && req.tool_input) {
          publishAskInput(req.session_id, req.tool_input);
        }
        void invoke("claude_perm_decide", {
          requestId: req.request_id,
          decision: "deny",
          reason:
            "Quack is rendering your AskUserQuestion options as clickable buttons above the composer. Do NOT repeat the question or paste option lists in prose — the user cannot answer that way. Say one short line that you're waiting for their pick, then END YOUR TURN.",
        }).catch((err) => console.warn("ask-redirect failed", err));
        return;
      }
      // BYPASS — the user opted into "skip ALL checks". Allow immediately,
      // even before the privacy gate (that's the documented difference from
      // Auto, which keeps the privacy guard). Enforced here, not by the CLI:
      // --dangerously-skip-permissions does NOT disable PreToolUse hooks, so
      // the hook still fires and only the overlay can honor the intent. Read
      // live from permModeStore, so flipping to Bypass mid-run takes effect
      // on the very next tool call. AskUserQuestion is handled above — it
      // can't work headless regardless of mode.
      const mode = panelPermMode(owner.permMode, req);
      if (mode === "bypassPermissions") {
        void invoke("claude_perm_decide", {
          requestId: req.request_id,
          decision: "allow",
        }).catch((err) => console.warn("bypass-allow failed", err));
        return;
      }
      // PRIVACY GATE — comes BEFORE always-allow rules. If the
      // requested path matches a privacy exclusion glob, deny
      // immediately and never surface the card. The agent gets a
      // denial that names the matched pattern so it can route around
      // (e.g. ask the user instead of trying again with the same path).
      if (PATH_TOOLS.has(req.tool_name)) {
        const p = pathFromInput(req.tool_input);
        const matched = p ? matchExclusion(p) : null;
        if (matched) {
          toastError(
            `AI privacy: blocked ${req.tool_name} on ${p?.split(/[\\/]/).pop()} (matches "${matched}")`,
          );
          void invoke("claude_perm_decide", {
            requestId: req.request_id,
            decision: "deny",
          }).catch((err) => console.warn("privacy-deny failed", err));
          return;
        }
      }
      // Read-only tools passed the privacy gate above — allow without
      // a card. They're only in the hook matcher so the gate can see
      // model-initiated reads.
      if (READ_ONLY_HOOK_TOOLS.has(req.tool_name)) {
        void invoke("claude_perm_decide", {
          requestId: req.request_id,
          decision: "allow",
        }).catch((err) => console.warn("read-allow failed", err));
        return;
      }
      // Permission-mode auto-allow (Auto / Auto-edit). Comes after the
      // privacy + read-only gates so those always win, before the saved
      // always-allow rules since the mode is the broader intent.
      // Plan mode = explore bypass by default (reads, pipes, subagents).
      const planExplore = mode === "plan" || planSessionExploreRef.current;
      if (modeAutoAllow(req, planExplore, mode)) {
        void invoke("claude_perm_decide", {
          requestId: req.request_id,
          decision: "allow",
        }).catch((err) => console.warn("mode-allow failed", err));
        return;
      }
      // In Plan mode, persisted always-allow rules must NOT fire: a saved
      // "always allow Edit on .ts" would otherwise let an edit through (the
      // hook's allow overrides the CLI's plan-mode block), defeating the
      // whole point of planning. Read-only allows already happened above; a
      // writing tool here just cards.
      if (mode === "plan") {
        setQueue((q) => [...q, req]);
        return;
      }
      // Check both the persisted rules AND the in-memory session rules.
      // Read latest via refs so we never miss a recent click.
      if (
        shouldAutoAllow(req, allowRef.current) ||
        shouldAutoAllow(req, sessionAllowRef.current)
      ) {
        void invoke("claude_perm_decide", {
          requestId: req.request_id,
          decision: "allow",
        }).catch((err) => console.warn("auto-allow failed", err));
        return;
      }
      setQueue((q) => [...q, req]);
    }).then((u) => {
      offReq = u;
    });

    void listen<string>("claude:permission-cancelled", (e) => {
      const requestId = e.payload;
      setQueue((q) => q.filter((r) => r.request_id !== requestId));
      clearPlanBuyIn({ requestId });
    }).then((u) => {
      offCancel = u;
    });

    return () => {
      offReq?.();
      offCancel?.();
    };
  }, []);

  // NOTE: every hook must live ABOVE the early return below — this
  // component renders null whenever the queue is empty, and a hook
  // after that return crashes React ("rendered more hooks than during
  // the previous render") the instant the FIRST permission card
  // arrives.
  // ExitPlanMode stays in the queue (hook pending) but is owned by the
  // in-stream PlanBuyInCard — never block other cards behind it.
  const planReq =
    queue.find((r) => r.tool_name === "ExitPlanMode") ?? null;
  const req: PermissionRequest | null =
    queue.find((r) => r.tool_name !== "ExitPlanMode") ?? null;

  // Open the plan preview + in-stream buy-in as soon as ExitPlanMode lands.
  const lastPlanRequestId = useRef<string | null>(null);
  useEffect(() => {
    if (!planReq) return;
    if (lastPlanRequestId.current === planReq.request_id) return;
    const plan =
      typeof planReq.tool_input.plan === "string" ? planReq.tool_input.plan : "";
    if (!plan) return;
    lastPlanRequestId.current = planReq.request_id;
    publishPlanBuyIn({
      requestId: planReq.request_id,
      plan,
      sessionId: planReq.session_id ?? ownerSessionId ?? null,
      cwd: planReq.cwd ?? ownerRoot,
    });
    onPlanReady?.(planReq.request_id, plan);
  }, [planReq, onPlanReady, ownerSessionId, ownerRoot]);

  const respond = async (decision: "allow" | "deny") => {
    if (!req) return;
    try {
      await invoke("claude_perm_decide", {
        requestId: req.request_id,
        decision,
      });
    } catch (e) {
      console.warn("claude_perm_decide failed", e);
    }
    setQueue((q) => q.filter((r) => r.request_id !== req.request_id));
  };

  // Keyboard shortcuts on the active (non-plan) request.
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isTyping =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (isTyping) return;
      if (e.key === "Escape") {
        e.preventDefault();
        void respond("deny");
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void respond("allow");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.request_id]);

  if (!req) return null;
  // ExitPlanMode UI moved to PlanBuyInCard — never render plan card here.
  const isPlan = false;
  const buildPlan = async () => {};
  const inPlanMode = panelPermMode(ownerPermMode, req) === "plan";
  const isBash = req.tool_name === "Bash";
  const bashCmd =
    isBash && typeof req.tool_input.command === "string"
      ? req.tool_input.command
      : "";
  const bashPrefix = isBash ? bashFirstToken(bashCmd) : "";
  const canBlanketAllow = !NEVER_BLANKET_ALLOW.has(req.tool_name);
  // File-extension always-allow only makes sense for tools whose primary
  // input is a file path (Edit/Write/Read/MultiEdit/NotebookEdit).
  const fileExt = PATH_TOOLS.has(req.tool_name)
    ? (() => {
        const p = pathFromInput(req.tool_input);
        return p ? extFromPath(p) : null;
      })()
    : null;

  const allowAlwaysTool = async () => {
    const next: AllowRules = {
      tools: new Set(allow.tools).add(req.tool_name),
      bashPrefixes: new Set(allow.bashPrefixes),
      exts: [...allow.exts],
    };
    setAllow(next);
    persistAllow(next);
    await respond("allow");
  };

  const allowAlwaysBashPrefix = async () => {
    const next: AllowRules = {
      tools: new Set(allow.tools),
      bashPrefixes: new Set(allow.bashPrefixes).add(bashPrefix),
      exts: [...allow.exts],
    };
    setAllow(next);
    persistAllow(next);
    await respond("allow");
  };

  const allowAlwaysExt = async () => {
    if (!fileExt) return;
    const exists = allow.exts.some(
      (r) => r.ext === fileExt && r.tool === req.tool_name,
    );
    const next: AllowRules = {
      tools: new Set(allow.tools),
      bashPrefixes: new Set(allow.bashPrefixes),
      exts: exists ? [...allow.exts] : [...allow.exts, { ext: fileExt, tool: req.tool_name }],
    };
    setAllow(next);
    persistAllow(next);
    await respond("allow");
  };

  // "Allow all — stop asking": flip THIS chat into Auto mode (via the
  // AIChatPanel callback, so the composer mode chip + localStorage stay in
  // sync) and resolve everything already queued. In Plan mode we instead
  // set planSessionExploreRef so reads/subagents stop carding but the
  // composer stays on Plan and ExitPlanMode still cards.
  const allowAll = async () => {
    const mode = req ? panelPermMode(ownerPermMode, req) : "default";
    if (mode === "plan") {
      planSessionExploreRef.current = true;
    } else {
      onAllowAll?.();
    }
    const pending = queue;
    setQueue([]);
    await Promise.all(
      pending.map((r) =>
        invoke("claude_perm_decide", {
          requestId: r.request_id,
          decision: "allow",
        }).catch((e) => console.warn("allow-all failed", e)),
      ),
    );
  };

  // "Allow this session" — in-memory only, resets on app reload. For
  // Bash we widen to the prefix; for path-tools we widen to the exact
  // extension; for everything else we widen to the tool name. Same UX
  // promise: stop asking until the app restarts.
  const allowThisSession = async () => {
    if (isBash && bashPrefix) {
      sessionAllowRef.current.bashPrefixes.add(bashPrefix);
    } else if (fileExt) {
      sessionAllowRef.current.exts.push({ ext: fileExt, tool: req.tool_name });
    } else {
      sessionAllowRef.current.tools.add(req.tool_name);
    }
    await respond("allow");
  };

  // Renders INLINE inside the chat panel (above the input) instead of as
  // a full-window modal overlay. The user repeatedly asked for this:
  // a centered modal blocks the conversation context, makes you lose
  // your scroll position, and feels like the AI is interrupting *you*
  // rather than asking *for permission*. Inline keeps the agent's
  // last text message + the request side by side so you can see what
  // led to the ask. Mounted by AIChatPanel; App.tsx no longer renders it.
  return (
    <div className="cc-perm-inline">
      <div className={`cc-perm-card ${isPlan ? "cc-perm-plan-card" : ""}`}>
        <PermissionCardBody req={req} />
        <div className="cc-perm-actions">
          {/* Left cluster — quiet, granular "remember this" scopes. */}
          {!isPlan &&
            ((isBash && bashPrefix) || fileExt || canBlanketAllow) && (
              <div className="cc-perm-more">
                {isBash && bashPrefix && (
                  <button
                    className="cc-perm-btn cc-perm-btn-sm"
                    onClick={() => void allowAlwaysBashPrefix()}
                    title={`Always allow Bash commands starting with "${bashPrefix}". Persisted across restarts. Manage in Settings.`}
                  >
                    <Icon name="check-circle" size={12} />
                    <span>
                      Always <code className="cc-perm-prefix">{bashPrefix}</code>
                    </span>
                  </button>
                )}
                {fileExt && (
                  <button
                    className="cc-perm-btn cc-perm-btn-sm"
                    onClick={() => void allowAlwaysExt()}
                    title={`Always allow ${req.tool_name} on ${fileExt} files. Persisted. Manage in Settings.`}
                  >
                    <Icon name="check-circle" size={12} />
                    <span>
                      Always {req.tool_name} on{" "}
                      <code className="cc-perm-prefix">{fileExt}</code>
                    </span>
                  </button>
                )}
                {canBlanketAllow && (
                  <button
                    className="cc-perm-btn cc-perm-btn-sm"
                    onClick={() => void allowAlwaysTool()}
                    title={`Always allow every ${req.tool_name} call. Persisted. Manage in Settings.`}
                  >
                    <Icon name="check-circle" size={12} />
                    <span>Always {req.tool_name}</span>
                  </button>
                )}
                <button
                  className="cc-perm-btn cc-perm-btn-sm"
                  onClick={() => void allowThisSession()}
                  title={
                    isBash && bashPrefix
                      ? `Auto-allow any "${bashPrefix} ..." for the rest of this Quack session (resets on restart).`
                      : `Auto-allow ${req.tool_name} for the rest of this Quack session (resets on restart).`
                  }
                >
                  <Icon name="check" size={12} />
                  <span>This session</span>
                </button>
              </div>
            )}
          {/* Right cluster — the decision. Allow all is the emphasized action. */}
          <div className="cc-perm-decide">
            <button
              className="cc-perm-btn cc-perm-deny"
              onClick={() => void respond("deny")}
              title={
                isPlan
                  ? "Keep discussing with Jack — refine the plan before building."
                  : "Block this tool call. The agent treats it as a failure and may try a different approach."
              }
            >
              <Icon name="x" size={12} />
              <span>{isPlan ? "Keep discussing" : "Deny"}</span>
            </button>
            {isPlan ? (
              <button
                className="cc-perm-btn cc-perm-allow-all"
                onClick={() => void buildPlan()}
                title="Approve the plan, spawn a work item, and hand off to Milo (Builder) in Agent mode."
              >
                <Icon name="zap" size={12} />
                <span>Build</span>
              </button>
            ) : (
              <button
                className="cc-perm-btn cc-perm-allow"
                onClick={() => void respond("allow")}
                title="Run this single call. You'll be prompted again next time."
              >
                <Icon name="check" size={12} />
                <span>Allow once</span>
              </button>
            )}
            {!isPlan && (
              <button
                className="cc-perm-btn cc-perm-allow-all"
                onClick={() => void allowAll()}
                title={
                  inPlanMode
                    ? "Allow reads and subagent exploration for this run — stay in Plan mode. File edits and ExitPlanMode still ask."
                    : "Switch this chat to Auto — allow every tool for the rest of the run without asking. Change it anytime from the composer mode menu."
                }
              >
                <Icon name="zap" size={12} />
                <span>{inPlanMode ? "Allow exploration" : "Allow all"}</span>
              </button>
            )}
          </div>
        </div>
        <div className="cc-perm-shortcut-hint">
          <kbd>Enter</kbd> {isPlan ? "Build" : "Allow once"} ·{" "}
          <kbd>Esc</kbd> {isPlan ? "Keep discussing" : "Deny"}
          {!isPlan && (
            <span className="cc-perm-hint-all">
              {" · "}
              {inPlanMode
                ? "Allow exploration stops prompts but keeps Plan"
                : "Allow all stops the prompts"}
            </span>
          )}
          {queue.length > 1 && (
            <span className="cc-perm-queue-inline">
              {" · "}+{queue.length - 1} more pending
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** `mcp__pinky__brain_search` → `pinky → brain_search` for card titles. */
function mcpToolLabel(tool: string): string | null {
  const m = /^mcp__([^_]+)__(.+)$/.exec(tool);
  return m ? `${m[1]} → ${m[2]}` : null;
}

function PermissionCardBody({ req }: { req: PermissionRequest }) {
  const { tool_name: tool, tool_input: input, cwd } = req;
  const wsName = cwd ? cwd.replace(/[\\/]+$/, "").split(/[\\/]/).pop() : null;
  const isPlan = tool === "ExitPlanMode";
  const mcpLabel = mcpToolLabel(tool);

  return (
    <>
      <div className="cc-perm-head">
        <span className="cc-perm-icon">
          <Icon name={isPlan ? "check-square" : "lock"} size={14} />
        </span>
        <span className="cc-perm-title">
          {isPlan ? (
            <>Plan ready — build with Milo or keep discussing with Jack</>
          ) : (
            <>
              Claude Code wants to use <code>{mcpLabel ?? tool}</code>
            </>
          )}
        </span>
        {wsName && <span className="cc-perm-ws">in {wsName}</span>}
      </div>
      <div className="cc-perm-body">
        <PermissionInputRenderer tool={tool} input={input} />
      </div>
    </>
  );
}

function PermissionInputRenderer({
  tool,
  input,
}: {
  tool: string;
  input: Record<string, unknown>;
}) {
  if (tool === "Bash") {
    const cmd =
      typeof input.command === "string" ? input.command : JSON.stringify(input);
    const desc = typeof input.description === "string" ? input.description : "";
    return (
      <>
        {desc && <div className="cc-perm-desc">{desc}</div>}
        <pre className="cc-perm-cmd">{cmd}</pre>
        <div className="cc-perm-hint">
          This shell command will run in your workspace cwd. Read it
          carefully — the agent matches glob patterns loosely; "git diff *"
          can include "git diff-index".
        </div>
      </>
    );
  }
  if (tool === "Edit" || tool === "MultiEdit") {
    const path =
      typeof input.file_path === "string" ? input.file_path : "(unknown)";
    const edits = tool === "MultiEdit"
      ? Array.isArray(input.edits)
        ? (input.edits as Array<Record<string, unknown>>)
        : []
      : [
          {
            old_string: input.old_string,
            new_string: input.new_string,
          } as Record<string, unknown>,
        ];
    return (
      <>
        <div className="cc-perm-row">
          <span className="cc-perm-label">File</span>
          <code className="cc-perm-path">{path}</code>
        </div>
        <div className="cc-perm-edits">
          {edits.map((e, i) => (
            <DiffPreview
              key={i}
              oldText={typeof e.old_string === "string" ? e.old_string : ""}
              newText={typeof e.new_string === "string" ? e.new_string : ""}
            />
          ))}
        </div>
      </>
    );
  }
  if (tool === "Write") {
    const path =
      typeof input.file_path === "string" ? input.file_path : "(unknown)";
    const content = typeof input.content === "string" ? input.content : "";
    const truncated = content.length > 4000;
    return (
      <>
        <div className="cc-perm-row">
          <span className="cc-perm-label">Write</span>
          <code className="cc-perm-path">{path}</code>
        </div>
        <pre className="cc-perm-content">
          {truncated ? content.slice(0, 4000) + "\n…[truncated]" : content}
        </pre>
      </>
    );
  }
  if (tool === "NotebookEdit") {
    const path =
      typeof input.notebook_path === "string"
        ? input.notebook_path
        : "(unknown)";
    return (
      <div className="cc-perm-row">
        <span className="cc-perm-label">Notebook</span>
        <code className="cc-perm-path">{path}</code>
      </div>
    );
  }
  if (tool === "ExitPlanMode") {
    const plan = typeof input.plan === "string" ? input.plan : "";
    return plan ? (
      <div className="cc-perm-plan">
        <MarkdownPreview content={plan} />
      </div>
    ) : (
      <div className="cc-perm-hint">(No plan text provided.)</div>
    );
  }
  if (tool.startsWith("mcp__")) {
    return (
      <>
        <pre className="cc-perm-content">{JSON.stringify(input, null, 2)}</pre>
        <div className="cc-perm-hint">
          MCP tool — Allow once for this call, or Always / This session so
          Claude Code can use it under headless <code>-p</code> without a TTY
          prompt.
        </div>
      </>
    );
  }
  return (
    <pre className="cc-perm-content">{JSON.stringify(input, null, 2)}</pre>
  );
}

function DiffPreview({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  const oldLines = oldText ? oldText.split("\n") : [];
  const newLines = newText ? newText.split("\n") : [];
  return (
    <div className="cc-perm-diff">
      {oldLines.map((line, i) => (
        <div key={`o-${i}`} className="cc-perm-diff-line cc-perm-diff-rm">
          <span className="cc-perm-diff-mark">−</span>
          <span className="cc-perm-diff-text">{line || " "}</span>
        </div>
      ))}
      {newLines.map((line, i) => (
        <div key={`n-${i}`} className="cc-perm-diff-line cc-perm-diff-add">
          <span className="cc-perm-diff-mark">+</span>
          <span className="cc-perm-diff-text">{line || " "}</span>
        </div>
      ))}
    </div>
  );
}
