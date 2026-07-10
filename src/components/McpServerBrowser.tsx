import { useEffect, useRef, useState } from "react";
import { claudeMcp, type McpServer } from "../ipc";
import { useStore } from "../store";
import { error as toastError, errMsg, success as toastSuccess } from "../notify";
import { confirm as dialogConfirm, prompt as dialogPrompt } from "../dialog";
import { Icon } from "./Icon";

/**
 * Curated catalog of well-known MCP servers worth one-click installing.
 * Each entry is the canonical command/args pair; we add to either user
 * (~/.claude.json) or project (.mcp.json) scope based on user choice.
 *
 * Source: https://github.com/modelcontextprotocol/servers and the
 * widely-used 3rd-party servers.
 */
interface McpPlaceholder {
  /** Literal token in args / env that the user-supplied value replaces. */
  token: string;
  /** Human-readable prompt label, e.g. "Directory path". */
  label: string;
  /** Optional default to pre-fill the input with. */
  default?: string;
  /** Optional one-line validator: returns null if OK, error string if bad. */
  validate?: (v: string) => string | null;
}

interface McpCatalogEntry {
  name: string;
  /** One-emoji icon shown on the card. Keeps it visual without needing
   *  per-server SVGs. */
  icon: string;
  description: string;
  command: string;
  args: string[];
  /** Optional env vars baked into the install. Same placeholder substitution. */
  env?: Record<string, string>;
  /**
   * Required user inputs. Each placeholder's `token` (e.g. "<path>")
   * gets replaced in args and env values with the user's input. We
   * prompt for these BEFORE the install, so we never write a broken
   * config full of literal placeholder strings to the user's
   * ~/.claude.json (which is what the v0.2.0 install path did).
   */
  placeholders?: McpPlaceholder[];
  /** Optional one-line note about post-install setup (env vars, etc.) */
  postInstallNote?: string;
  /** Where the official docs live. */
  docsUrl?: string;
}

const isAbsPath = (v: string): string | null => {
  // Accept both POSIX (/foo/bar) and Windows (C:\foo) absolute paths.
  if (/^([a-zA-Z]:[\\/]|\/)/.test(v.trim())) return null;
  return "Use an absolute path (e.g. C:\\Users\\you\\code or /home/you/code)";
};

const CURATED: McpCatalogEntry[] = [
  {
    name: "pinky",
    icon: "PB",
    description:
      "Pinky Brain — hybrid local knowledge search (BM25 + vector) over documentation/",
    command: "pinky-mcp",
    args: [],
    env: {
      PINKY_DB: "brain.db",
      PINKY_SAVE_DIR: "documentation",
    },
    postInstallNote:
      "Requires pinky CLI (pinkybrain.dev). Use the Brain tab → Enable Pinky Brain for full setup.",
    docsUrl: "https://pinkybrain.dev",
  },
  {
    name: "filesystem",
    icon: "📁",
    description: "Read / list files in a sandboxed directory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "<path>"],
    placeholders: [
      {
        token: "<path>",
        label: "Directory the agent can access (absolute path)",
        validate: isAbsPath,
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
  },
  {
    name: "git",
    icon: "⎇",
    description: "Git operations (log, diff, branch, blame, …)",
    command: "uvx",
    args: ["mcp-server-git", "--repository", "<repo-path>"],
    placeholders: [
      {
        token: "<repo-path>",
        label: "Path to the git repo (absolute)",
        validate: isAbsPath,
      },
    ],
    postInstallNote: "Requires `uv` installed (pip install uv).",
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
  },
  {
    name: "fetch",
    icon: "🌐",
    description: "HTTP requests (GET / POST a URL, return JSON or text)",
    command: "uvx",
    args: ["mcp-server-fetch"],
    postInstallNote: "Requires `uv` installed (pip install uv).",
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
  },
  {
    name: "github",
    icon: "🐙",
    description: "GitHub API — read/write issues, PRs, repos",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "<token>" },
    placeholders: [
      {
        token: "<token>",
        label: "GitHub personal access token (https://github.com/settings/tokens)",
        validate: (v) =>
          v.startsWith("ghp_") || v.startsWith("github_pat_")
            ? null
            : "Token should start with 'ghp_' or 'github_pat_'",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
  },
  {
    name: "puppeteer",
    icon: "🎭",
    description: "Browser automation — navigate, screenshot, scrape",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
  },
  {
    name: "sqlite",
    icon: "🗄",
    description: "Run SQL against a local SQLite database",
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path", "<path>"],
    placeholders: [
      {
        token: "<path>",
        label: "Path to the .db file (absolute)",
        validate: isAbsPath,
      },
    ],
    postInstallNote: "Requires `uv` installed (pip install uv).",
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
  },
  {
    name: "postgres",
    icon: "🐘",
    description: "Read-only PostgreSQL queries",
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-postgres",
      "<connection-url>",
    ],
    placeholders: [
      {
        token: "<connection-url>",
        label: "Postgres connection URL (postgres://user:pass@host:port/db)",
        validate: (v) =>
          /^postgres(?:ql)?:\/\//.test(v.trim())
            ? null
            : "Must start with postgres:// or postgresql://",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
  },
];

/**
 * Walk an args list (and optional env map) replacing every placeholder
 * token with the user-supplied value. Pure function — easy to test.
 */
function substitute(
  args: string[],
  env: Record<string, string> | undefined,
  values: Record<string, string>,
): { args: string[]; env: Record<string, string> } {
  const replaceAll = (s: string): string => {
    let out = s;
    for (const [token, value] of Object.entries(values)) {
      out = out.split(token).join(value);
    }
    return out;
  };
  return {
    args: args.map(replaceAll),
    env: Object.fromEntries(
      Object.entries(env ?? {}).map(([k, v]) => [k, replaceAll(v)]),
    ),
  };
}

export function McpServerBrowser() {
  const activeId = useStore((s) => s.activeId);
  const cwd = useStore((s) =>
    s.activeId ? s.loaded[s.activeId]?.meta.root : null,
  );
  const [installed, setInstalled] = useState<McpServer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the add-type menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const refresh = async () => {
    if (!cwd) return;
    try {
      const list = await claudeMcp.list(cwd);
      setInstalled(list);
    } catch (e) {
      toastError(`Failed to load MCP servers: ${errMsg(e)}`);
      setInstalled([]);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  if (!activeId || !cwd) {
    return (
      <div className="settings-row settings-row-note">
        Open a workspace to manage MCP servers (project-scoped configs
        live in <code>.mcp.json</code> at the workspace root).
      </div>
    );
  }

  // Map name -> set of scopes it's installed in. Lets the catalog
  // badge say "user", "project", or "both" instead of an opaque
  // "installed".
  const scopesByName = new Map<string, Set<"user" | "project">>();
  for (const s of installed ?? []) {
    if (s.scope !== "user" && s.scope !== "project") continue;
    if (!scopesByName.has(s.name)) scopesByName.set(s.name, new Set());
    scopesByName.get(s.name)!.add(s.scope);
  }

  const install = async (entry: McpCatalogEntry, scope: "user" | "project") => {
    if (busy) return;

    // Prompt for any placeholder values BEFORE writing anything to
    // disk, so we never persist a config full of literal "<path>" /
    // "<token>" strings (the v0.2.0 install path's bug — Claude Code
    // would then spawn the literal string as an argument).
    const values: Record<string, string> = {};
    for (const ph of entry.placeholders ?? []) {
      const v = await dialogPrompt(
        `${ph.label}\n\n(Installing ${entry.name} → ${scope} scope)`,
        ph.default ?? "",
        {
          title: `${entry.name}: configure`,
          okLabel: "Next",
          cancelLabel: "Cancel install",
        },
      );
      if (v === null) return; // user cancelled — don't half-install
      const trimmed = v.trim();
      if (!trimmed) {
        toastError(`${ph.label} can't be empty.`);
        return;
      }
      const err = ph.validate ? ph.validate(trimmed) : null;
      if (err) {
        toastError(`${entry.name}: ${err}`);
        return;
      }
      values[ph.token] = trimmed;
    }

    const { args, env } = substitute(entry.args, entry.env, values);

    setBusy(true);
    try {
      const target = await claudeMcp.add(
        cwd,
        entry.name,
        scope,
        entry.command,
        args,
        env,
      );
      toastSuccess(
        `Added ${entry.name} (${scope}) → ${target}` +
          (entry.postInstallNote ? ` · ${entry.postInstallNote}` : ""),
      );
      await refresh();
    } catch (e) {
      toastError(`Install failed: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: McpServer) => {
    const ok = await dialogConfirm(
      `Remove MCP server "${s.name}" from ${s.scope} scope? Claude Code will lose access to its tools on the next session.`,
      {
        title: `Remove ${s.name}?`,
        okLabel: "Remove",
        cancelLabel: "Cancel",
        danger: true,
      },
    );
    if (!ok) return;
    try {
      await claudeMcp.remove(cwd, s.name, s.scope as "user" | "project");
      toastSuccess(`Removed ${s.name} (${s.scope})`);
      await refresh();
    } catch (e) {
      toastError(`Remove failed: ${errMsg(e)}`);
    }
  };

  const q = query.trim().toLowerCase();
  const filteredInstalled = (installed ?? []).filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.command.toLowerCase().includes(q) ||
      (s.url ?? "").toLowerCase().includes(q),
  );
  const filteredCatalog = CURATED.filter(
    (e) =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q),
  );

  return (
    <>
      {/* Toolbar: search + "Add server" type menu. */}
      <div className="mcp-toolbar">
        <div className="mcp-search">
          <Icon name="search" size={13} />
          <input
            type="text"
            placeholder="Search installed & catalog…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="mcp-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
        <div className="mcp-add-wrap" ref={menuRef}>
          <button
            className="mcp-add-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Icon name="plus" size={12} /> Add server
            <Icon name="chevron-down" size={11} />
          </button>
          {menuOpen && (
            <div className="mcp-add-menu" role="menu">
              {ADD_TYPES.map((t) => (
                <button
                  key={t.kind}
                  className="mcp-add-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setAddKind(t.kind);
                    setMenuOpen(false);
                  }}
                >
                  <span className="mcp-add-menu-label">{t.label}</span>
                  <span className="mcp-add-menu-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {addKind && (
        <AddServerForm
          kind={addKind}
          cwd={cwd}
          onCancel={() => setAddKind(null)}
          onDone={async () => {
            setAddKind(null);
            await refresh();
          }}
        />
      )}

      <div className="mcp-section-head">Installed</div>
      {installed && filteredInstalled.length === 0 && (
        <div className="settings-row settings-row-note">
          {installed.length === 0
            ? "No MCP servers configured. Add one above, or one-click install from the catalog below."
            : "No installed servers match your search."}
        </div>
      )}
      {filteredInstalled.length > 0 && (
        <div className="mcp-list">
          {filteredInstalled.map((s) => (
            <div key={`${s.scope}:${s.name}`} className="mcp-row">
              <div className="mcp-row-main">
                <span className="mcp-name">{s.name}</span>
                <span className={`mcp-scope-badge mcp-scope-${s.scope}`}>
                  {s.scope}
                </span>
                {s.transport && s.transport !== "stdio" && (
                  <span className="mcp-transport-badge">
                    {s.transport.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="mcp-row-cmd">
                <code>
                  {s.transport === "http" || s.transport === "sse"
                    ? s.url
                    : `${s.command} ${(s.args ?? []).join(" ")}`}
                </code>
              </div>
              <button
                className="mcp-remove-btn"
                onClick={() => void remove(s)}
                title={`Remove from ${s.scope} scope`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {installed &&
        hasShadowing(installed) && (
          <div className="settings-row settings-row-note mcp-warning">
            <Icon name="alert-triangle" size={12} /> A project-scope server is shadowing a user-scope one of
            the same name. Per{" "}
            <a
              href="https://github.com/anthropics/claude-code/issues/16728"
              target="_blank"
              rel="noopener noreferrer"
            >
              anthropics/claude-code#16728
            </a>
            , project entries silently override user entries — Claude
            Code will only run the project version.
          </div>
        )}

      <div className="mcp-section-head">Catalog</div>
      <div className="settings-row settings-row-note">
        One-click installs for popular MCP servers. <strong>User</strong>{" "}
        scope = available in every workspace; <strong>project</strong> scope
        = checked into <code>.mcp.json</code> for this workspace only
        (good for sharing with your team).
      </div>
      {filteredCatalog.length === 0 && (
        <div className="settings-row settings-row-note">
          No catalog servers match your search. Use <strong>Add server</strong>{" "}
          above to add a custom one.
        </div>
      )}
      <div className="mcp-catalog">
        {filteredCatalog.map((entry) => {
          const scopes = scopesByName.get(entry.name);
          const inUser = !!scopes?.has("user");
          const inProject = !!scopes?.has("project");
          const inBoth = inUser && inProject;
          const needsConfig = (entry.placeholders?.length ?? 0) > 0;
          const status = inBoth
            ? { cls: "both", label: "both scopes", title: "Installed in both user and project. Project config silently overrides user (anthropics/claude-code#16728)." }
            : inUser
              ? { cls: "user", label: "user", title: "Installed in your user config (~/.claude.json) — available in every workspace." }
              : inProject
                ? { cls: "project", label: "project", title: "Installed in this workspace's .mcp.json — applies only here." }
                : null;
          return (
            <div
              key={entry.name}
              className={`mcp-card ${status ? "mcp-card-installed" : ""}`}
            >
              <div className="mcp-card-head">
                <span className="mcp-card-icon" aria-hidden>
                  {entry.icon}
                </span>
                <div className="mcp-card-title-wrap">
                  <span className="mcp-card-name">{entry.name}</span>
                  {entry.docsUrl && (
                    <a
                      href={entry.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mcp-card-docs"
                      title="Open official docs"
                    >
                      docs ↗
                    </a>
                  )}
                </div>
                {status && (
                  <span
                    className={`mcp-card-status mcp-card-status-${status.cls}`}
                    title={status.title}
                  >
                    <Icon name="check" size={11} /> {status.label}
                  </span>
                )}
              </div>

              <div className="mcp-card-desc">{entry.description}</div>

              {(needsConfig || entry.postInstallNote) && (
                <div className="mcp-card-meta">
                  {needsConfig && (
                    <span className="mcp-card-meta-chip">
                      <Icon name="settings" size={10} /> asks for{" "}
                      {(entry.placeholders ?? [])
                        .map((p) => p.label.split(/[\s(,]/)[0].toLowerCase())
                        .join(" + ")}
                    </span>
                  )}
                  {entry.postInstallNote && (
                    <span className="mcp-card-meta-chip mcp-card-meta-warn">
                      <Icon name="alert-triangle" size={10} /> {entry.postInstallNote}
                    </span>
                  )}
                </div>
              )}

              <div className="mcp-card-actions">
                <button
                  className={`mcp-card-btn ${inUser ? "mcp-card-btn-reinstall" : "mcp-card-btn-install"}`}
                  disabled={busy}
                  onClick={() => void install(entry, "user")}
                  title={
                    inUser
                      ? "Reinstall in user scope — overwrites the existing config (you'll be re-prompted for any required values)."
                      : "Install for every workspace (~/.claude.json)"
                  }
                >
                  <span className="mcp-card-btn-icon">
                    <Icon name={inUser ? "rotate-ccw" : "plus"} size={11} />
                  </span>
                  User
                </button>
                <button
                  className={`mcp-card-btn ${inProject ? "mcp-card-btn-reinstall" : "mcp-card-btn-install"}`}
                  disabled={busy}
                  onClick={() => void install(entry, "project")}
                  title={
                    inProject
                      ? "Reinstall in project scope — overwrites .mcp.json (you'll be re-prompted for any required values)."
                      : "Install for this workspace only (.mcp.json — checked into git)"
                  }
                >
                  <span className="mcp-card-btn-icon">
                    <Icon name={inProject ? "rotate-ccw" : "plus"} size={11} />
                  </span>
                  Project
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function hasShadowing(list: McpServer[]): boolean {
  const seen = new Set<string>();
  for (const s of list) {
    if (s.scope === "user") seen.add(s.name);
  }
  return list.some((s) => s.scope === "project" && seen.has(s.name));
}

// ── Manual add ──────────────────────────────────────────────────────
type AddKind = "stdio" | "remote" | "npm" | "pip" | "docker";

const ADD_TYPES: { kind: AddKind; label: string; desc: string }[] = [
  { kind: "stdio", label: "Command (stdio)", desc: "Run a local command that speaks MCP" },
  { kind: "remote", label: "Remote (HTTP / SSE)", desc: "Connect to a remote MCP URL" },
  { kind: "npm", label: "NPM package", desc: "Run an npm package via npx" },
  { kind: "pip", label: "Pip package", desc: "Run a Python package via uvx" },
  { kind: "docker", label: "Docker image", desc: "Run an MCP server in a container" },
];

/** Split a space-separated argument string. Naive but predictable —
 *  users wanting literal spaces in one arg can use the stdio form's
 *  command field plus the raw config files. */
function splitArgs(s: string): string[] {
  const t = s.trim();
  return t ? t.split(/\s+/) : [];
}

/** Parse KEY=VALUE lines (env / headers) into a record. Blank lines and
 *  lines without "=" are skipped. */
function parseKv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of s.split("\n")) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function AddServerForm({
  kind,
  cwd,
  onCancel,
  onDone,
}: {
  kind: AddKind;
  cwd: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"user" | "project">("project");
  const [command, setCommand] = useState("");
  const [argsStr, setArgsStr] = useState("");
  const [pkg, setPkg] = useState("");
  const [image, setImage] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"http" | "sse">("http");
  const [envStr, setEnvStr] = useState("");
  const [headersStr, setHeadersStr] = useState("");
  const [busy, setBusy] = useState(false);

  const title = ADD_TYPES.find((t) => t.kind === kind)?.label ?? "Add server";

  const submit = async () => {
    const nm = name.trim();
    if (!nm) {
      toastError("Name is required.");
      return;
    }
    setBusy(true);
    try {
      if (kind === "remote") {
        if (!url.trim()) {
          toastError("URL is required.");
          setBusy(false);
          return;
        }
        await claudeMcp.addRemote(
          cwd,
          nm,
          scope,
          transport,
          url.trim(),
          parseKv(headersStr),
        );
      } else {
        let cmd = command.trim();
        const extra = splitArgs(argsStr);
        let args: string[] = extra;
        if (kind === "npm") {
          if (!pkg.trim()) {
            toastError("Package name is required.");
            setBusy(false);
            return;
          }
          cmd = "npx";
          args = ["-y", pkg.trim(), ...extra];
        } else if (kind === "pip") {
          if (!pkg.trim()) {
            toastError("Package name is required.");
            setBusy(false);
            return;
          }
          cmd = "uvx";
          args = [pkg.trim(), ...extra];
        } else if (kind === "docker") {
          if (!image.trim()) {
            toastError("Image is required.");
            setBusy(false);
            return;
          }
          cmd = "docker";
          args = ["run", "-i", "--rm", ...extra, image.trim()];
        }
        if (!cmd) {
          toastError("Command is required.");
          setBusy(false);
          return;
        }
        await claudeMcp.add(cwd, nm, scope, cmd, args, parseKv(envStr));
      }
      toastSuccess(`Added ${nm} (${scope})`);
      onDone();
    } catch (e) {
      toastError(`Add failed: ${errMsg(e)}`);
      setBusy(false);
    }
  };

  return (
    <div className="mcp-addform">
      <div className="mcp-addform-head">
        <span className="mcp-addform-title">{title}</span>
        <button className="mcp-addform-x" onClick={onCancel} aria-label="Cancel">
          <Icon name="x" size={12} />
        </button>
      </div>

      <label className="mcp-field">
        <span className="mcp-field-label">Name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-server"
        />
      </label>

      {kind === "stdio" && (
        <>
          <label className="mcp-field">
            <span className="mcp-field-label">Command</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="node / python / npx / …"
            />
          </label>
          <label className="mcp-field">
            <span className="mcp-field-label">Arguments</span>
            <input
              value={argsStr}
              onChange={(e) => setArgsStr(e.target.value)}
              placeholder="server.js --port 3000"
            />
          </label>
        </>
      )}

      {kind === "npm" && (
        <>
          <label className="mcp-field">
            <span className="mcp-field-label">NPM package</span>
            <input
              value={pkg}
              onChange={(e) => setPkg(e.target.value)}
              placeholder="@scope/server-name"
            />
          </label>
          <label className="mcp-field">
            <span className="mcp-field-label">Extra args</span>
            <input
              value={argsStr}
              onChange={(e) => setArgsStr(e.target.value)}
              placeholder="(optional)"
            />
          </label>
          <div className="mcp-field-hint">Runs: npx -y {pkg || "<package>"} {argsStr}</div>
        </>
      )}

      {kind === "pip" && (
        <>
          <label className="mcp-field">
            <span className="mcp-field-label">Pip package</span>
            <input
              value={pkg}
              onChange={(e) => setPkg(e.target.value)}
              placeholder="mcp-server-name"
            />
          </label>
          <label className="mcp-field">
            <span className="mcp-field-label">Extra args</span>
            <input
              value={argsStr}
              onChange={(e) => setArgsStr(e.target.value)}
              placeholder="(optional)"
            />
          </label>
          <div className="mcp-field-hint">
            Runs: uvx {pkg || "<package>"} {argsStr} · needs `uv` installed
          </div>
        </>
      )}

      {kind === "docker" && (
        <>
          <label className="mcp-field">
            <span className="mcp-field-label">Docker image</span>
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="org/mcp-image:latest"
            />
          </label>
          <label className="mcp-field">
            <span className="mcp-field-label">Extra args</span>
            <input
              value={argsStr}
              onChange={(e) => setArgsStr(e.target.value)}
              placeholder="(optional, before image)"
            />
          </label>
          <div className="mcp-field-hint">
            Runs: docker run -i --rm {argsStr} {image || "<image>"}
          </div>
        </>
      )}

      {kind === "remote" && (
        <>
          <div className="mcp-field">
            <span className="mcp-field-label">Transport</span>
            <div className="mcp-seg">
              {(["http", "sse"] as const).map((t) => (
                <button
                  key={t}
                  className={`mcp-seg-btn ${transport === t ? "active" : ""}`}
                  onClick={() => setTransport(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <label className="mcp-field">
            <span className="mcp-field-label">URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/mcp"
            />
          </label>
          <label className="mcp-field mcp-field-col">
            <span className="mcp-field-label">Headers (KEY=VALUE per line)</span>
            <textarea
              value={headersStr}
              onChange={(e) => setHeadersStr(e.target.value)}
              placeholder={"Authorization=Bearer …"}
              rows={2}
            />
          </label>
        </>
      )}

      {kind !== "remote" && (
        <label className="mcp-field mcp-field-col">
          <span className="mcp-field-label">Env (KEY=VALUE per line)</span>
          <textarea
            value={envStr}
            onChange={(e) => setEnvStr(e.target.value)}
            placeholder={"API_KEY=…"}
            rows={2}
          />
        </label>
      )}

      <div className="mcp-field">
        <span className="mcp-field-label">Scope</span>
        <div className="mcp-seg">
          {(["project", "user"] as const).map((sc) => (
            <button
              key={sc}
              className={`mcp-seg-btn ${scope === sc ? "active" : ""}`}
              onClick={() => setScope(sc)}
              title={
                sc === "user"
                  ? "~/.claude.json — every workspace"
                  : ".mcp.json — this workspace, checked into git"
              }
            >
              {sc}
            </button>
          ))}
        </div>
      </div>

      <div className="mcp-addform-actions">
        <button className="mcp-card-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="mcp-card-btn mcp-card-btn-install"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Adding…" : "Add server"}
        </button>
      </div>
    </div>
  );
}
