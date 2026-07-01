import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useModalFocus } from "../useModalFocus";
import { Icon } from "./Icon";
import {
  CATEGORY_LABELS,
  MODEL_CATALOG,
  type CatalogModel,
} from "../modelCatalog";
import type { ProviderId, ProviderModel } from "../providers";

interface Props {
  open: boolean;
  /** Set of installed Ollama model tags (e.g. "qwen2.5-coder:7b"). */
  installedNames: Set<string>;
  /** Cloud-provider models discovered via listAllModels. */
  cloudModels: ProviderModel[];
  /** Whether each provider has its API key configured (or CLI present). */
  hasKey: Record<ProviderId, boolean>;
  selectedQualified: string;
  pullProgressByName: Record<string, string>;
  onClose: () => void;
  /** Toggle which models appear in the quick picker popover. */
  onManageVisibility?: () => void;
  onSelect: (qualifiedModelId: string) => void;
  onPull: (name: string) => void;
  onConfigureKey: () => void;
  /** Spawn an Ollama-style install terminal for Claude Code. */
  onInstallClaudeCode: () => void;
  /** Open Cursor CLI install docs. */
  onInstallCursorCli?: () => void;
}

type ProviderFilter = "all" | ProviderId;

const PROVIDER_TABS: { id: ProviderFilter; label: string }[] = [
  { id: "all", label: "All providers" },
  { id: "ollama", label: "Ollama (local)" },
  { id: "claude-code", label: "Claude Code (CLI)" },
  { id: "cursor-cli", label: "Cursor CLI" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
];

const CATEGORIES: CatalogModel["category"][] = [
  "coding",
  "reasoning",
  "general",
  "small",
];

export function ModelBrowser({
  open,
  installedNames,
  cloudModels,
  hasKey,
  selectedQualified,
  pullProgressByName,
  onClose,
  onManageVisibility,
  onSelect,
  onPull,
  onConfigureKey,
  onInstallClaudeCode,
  onInstallCursorCli,
}: Props) {
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [activeCat, setActiveCat] = useState<CatalogModel["category"] | "all">(
    "all",
  );
  const modalRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(modalRef, open);

  // Esc closes the modal — the close button's tooltip already promised
  // "Close (Esc)" but the keydown handler was missing, so users hitting
  // Esc to dismiss had to mouse to the × instead. Standard modal UX.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredOllama = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODEL_CATALOG.filter((m) => {
      if (activeCat !== "all" && m.category !== activeCat) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    });
  }, [query, activeCat]);

  const filteredCloud = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cloudModels.filter((m) => {
      if (!q) return true;
      return (
        m.modelId.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q)
      );
    });
  }, [query, cloudModels]);

  if (!open) return null;

  const showOllama =
    providerFilter === "all" || providerFilter === "ollama";
  const showClaudeCode =
    providerFilter === "all" || providerFilter === "claude-code";
  const showCursorCli =
    providerFilter === "all" || providerFilter === "cursor-cli";
  const showOpenai =
    providerFilter === "all" || providerFilter === "openai";
  const showAnthropic =
    providerFilter === "all" || providerFilter === "anthropic";

  return createPortal(
    <div className="settings-backdrop" onMouseDown={onClose}>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="model-browser liquid-glass"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-browser-title"
      >
        <div className="model-browser-head">
          <span className="model-browser-title" id="model-browser-title">
            Choose a model
          </span>
          <div className="model-browser-head-actions">
            {onManageVisibility && (
              <button
                type="button"
                className="model-browser-configure"
                onClick={onManageVisibility}
                title="Choose which models appear in the quick picker"
              >
                Visibility
              </button>
            )}
            <button
              className="settings-close"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close model browser"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        <div className="model-browser-toolbar">
          <input
            className="model-browser-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or description…"
            autoFocus
          />
          <div className="settings-segmented">
            {PROVIDER_TABS.map((t) => (
              <button
                key={t.id}
                className={`segmented-btn ${providerFilter === t.id ? "active" : ""}`}
                onClick={() => setProviderFilter(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {(providerFilter === "all" || providerFilter === "ollama") && (
            <div className="settings-segmented">
              <button
                className={`segmented-btn ${activeCat === "all" ? "active" : ""}`}
                onClick={() => setActiveCat("all")}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={`segmented-btn ${activeCat === c ? "active" : ""}`}
                  onClick={() => setActiveCat(c)}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="model-browser-list">
          {showOllama && (
            <Section
              title="Ollama (local)"
              subtitle="Runs on your machine — free, private, requires disk + RAM."
            >
              {filteredOllama.length === 0 ? (
                <div className="model-browser-empty">
                  No Ollama models match.
                </div>
              ) : (
                filteredOllama.map((m) => (
                  <OllamaCard
                    key={m.name}
                    model={m}
                    installed={installedNames.has(m.name)}
                    selected={selectedQualified === `ollama:${m.name}`}
                    progress={pullProgressByName[m.name] ?? null}
                    onUse={() => {
                      onSelect(`ollama:${m.name}`);
                      onClose();
                    }}
                    onPull={() => onPull(m.name)}
                  />
                ))
              )}
            </Section>
          )}

          {showClaudeCode && (
            <Section
              title="Claude Code (local CLI)"
              subtitle={
                hasKey["claude-code"]
                  ? "claude CLI detected ✓ — uses your existing Claude Code login (Pro/Max subscription or API key)."
                  : "Install Anthropic's Claude Code CLI and run `claude /login`. Then refresh."
              }
              right={
                !hasKey["claude-code"] && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      className="model-browser-configure"
                      onClick={onInstallClaudeCode}
                      title="Run `npm install -g @anthropic-ai/claude-code` in a terminal"
                    >
                      Install via npm
                    </button>
                    <button
                      className="model-browser-configure"
                      style={{ background: "var(--bg-alt)", color: "var(--fg)" }}
                      onClick={() =>
                        void openUrl(
                          "https://docs.claude.com/en/docs/claude-code/quickstart",
                        )
                      }
                      title="Open install docs in browser"
                    >
                      Docs
                    </button>
                  </div>
                )
              }
            >
              {!hasKey["claude-code"] ? (
                <div className="model-browser-empty">
                  Install Claude Code, log in with{" "}
                  <code>claude /login</code>, then refresh this panel.
                </div>
              ) : filteredCloud.filter((m) => m.providerId === "claude-code")
                  .length === 0 ? (
                <div className="model-browser-empty">No models match.</div>
              ) : (
                filteredCloud
                  .filter((m) => m.providerId === "claude-code")
                  .map((m) => (
                    <CloudCard
                      key={m.modelId}
                      model={m}
                      selected={
                        selectedQualified === `claude-code:${m.modelId}`
                      }
                      onUse={() => {
                        onSelect(`claude-code:${m.modelId}`);
                        onClose();
                      }}
                    />
                  ))
              )}
            </Section>
          )}

          {showCursorCli && (
            <Section
              title="Cursor CLI (local)"
              subtitle={
                hasKey["cursor-cli"]
                  ? "cursor-agent detected ✓ — uses your Cursor subscription login."
                  : "Install cursor-agent and run `cursor-agent login`. Then refresh."
              }
              right={
                !hasKey["cursor-cli"] && (
                  <button
                    className="model-browser-configure"
                    style={{ background: "var(--bg-alt)", color: "var(--fg)" }}
                    onClick={() =>
                      onInstallCursorCli
                        ? onInstallCursorCli()
                        : void openUrl("https://cursor.com/docs/cli/overview")
                    }
                    title="Open Cursor CLI install docs"
                  >
                    Docs
                  </button>
                )
              }
            >
              {!hasKey["cursor-cli"] ? (
                <div className="model-browser-empty">
                  Install cursor-agent, log in with{" "}
                  <code>cursor-agent login</code>, then refresh this panel.
                </div>
              ) : filteredCloud.filter((m) => m.providerId === "cursor-cli")
                  .length === 0 ? (
                <div className="model-browser-empty">No models match.</div>
              ) : (
                filteredCloud
                  .filter((m) => m.providerId === "cursor-cli")
                  .map((m) => (
                    <CloudCard
                      key={m.modelId}
                      model={m}
                      selected={
                        selectedQualified === `cursor-cli:${m.modelId}`
                      }
                      onUse={() => {
                        onSelect(`cursor-cli:${m.modelId}`);
                        onClose();
                      }}
                    />
                  ))
              )}
            </Section>
          )}

          {showOpenai && (
            <Section
              title="OpenAI"
              subtitle={
                hasKey.openai
                  ? "API key configured ✓"
                  : "Needs an API key — paste it in Settings → AI Providers."
              }
              right={
                !hasKey.openai && (
                  <button
                    className="model-browser-configure"
                    onClick={onConfigureKey}
                  >
                    Configure key
                  </button>
                )
              }
            >
              {!hasKey.openai ? (
                <div className="model-browser-empty">
                  Add an OpenAI API key to enable these models.
                </div>
              ) : filteredCloud.filter((m) => m.providerId === "openai").length === 0 ? (
                <div className="model-browser-empty">
                  No OpenAI models match.
                </div>
              ) : (
                filteredCloud
                  .filter((m) => m.providerId === "openai")
                  .map((m) => (
                    <CloudCard
                      key={m.modelId}
                      model={m}
                      selected={selectedQualified === `openai:${m.modelId}`}
                      onUse={() => {
                        onSelect(`openai:${m.modelId}`);
                        onClose();
                      }}
                    />
                  ))
              )}
            </Section>
          )}

          {showAnthropic && (
            <Section
              title="Anthropic"
              subtitle={
                hasKey.anthropic
                  ? "API key configured ✓"
                  : "Needs an API key — paste it in Settings → AI Providers."
              }
              right={
                !hasKey.anthropic && (
                  <button
                    className="model-browser-configure"
                    onClick={onConfigureKey}
                  >
                    Configure key
                  </button>
                )
              }
            >
              {!hasKey.anthropic ? (
                <div className="model-browser-empty">
                  Add an Anthropic API key to enable these models.
                </div>
              ) : filteredCloud.filter((m) => m.providerId === "anthropic").length === 0 ? (
                <div className="model-browser-empty">
                  No Anthropic models match.
                </div>
              ) : (
                filteredCloud
                  .filter((m) => m.providerId === "anthropic")
                  .map((m) => (
                    <CloudCard
                      key={m.modelId}
                      model={m}
                      selected={selectedQualified === `anthropic:${m.modelId}`}
                      onUse={() => {
                        onSelect(`anthropic:${m.modelId}`);
                        onClose();
                      }}
                    />
                  ))
              )}
            </Section>
          )}
        </div>

        <div className="model-browser-foot">
          <span>
            Tip: cloud models follow tool-calling protocols best. Ollama is
            free and private but smaller models can be unreliable.
          </span>
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="model-browser-section">
      <div className="model-browser-section-head">
        <div>
          <div className="model-browser-section-title">{title}</div>
          <div className="model-browser-section-sub">{subtitle}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function OllamaCard({
  model,
  installed,
  selected,
  progress,
  onUse,
  onPull,
}: {
  model: CatalogModel;
  installed: boolean;
  selected: boolean;
  progress: string | null;
  onUse: () => void;
  onPull: () => void;
}) {
  const isPulling = progress !== null;
  return (
    <div className={`model-card ${selected ? "selected" : ""}`}>
      <div className="model-card-left">
        <div className="model-card-name">
          <code>{model.name}</code>
          {model.recommended && (
            <span className="model-card-tag tag-rec">★ recommended</span>
          )}
          {model.toolCalls && (
            <span className="model-card-tag tag-tools">tools</span>
          )}
          {installed && (
            <span className="model-card-tag tag-installed">
              <Icon name="check" size={10} /> installed
            </span>
          )}
          {selected && <span className="model-card-tag tag-selected">in use</span>}
        </div>
        <div className="model-card-desc">{model.description}</div>
        <div className="model-card-meta">
          ~{model.sizeGb} GB on disk
          {model.needsRamGb ? ` · ~${model.needsRamGb} GB RAM` : ""}
        </div>
        {isPulling && progress && (
          <div className="model-card-progress">{progress}</div>
        )}
      </div>
      <div className="model-card-actions">
        {installed ? (
          <button
            className={`primary ${selected ? "secondary" : ""}`}
            onClick={onUse}
            disabled={selected}
          >
            {selected ? "In use" : "Use"}
          </button>
        ) : (
          <button className="primary" onClick={onPull} disabled={isPulling}>
            {isPulling ? "Pulling…" : "↓ Install"}
          </button>
        )}
      </div>
    </div>
  );
}

function CloudCard({
  model,
  selected,
  onUse,
}: {
  model: ProviderModel;
  selected: boolean;
  onUse: () => void;
}) {
  const ctxLabel = model.contextWindow
    ? `~${Math.round(model.contextWindow / 1000)}k token context`
    : "";
  const billingLabel =
    model.providerId === "claude-code"
      ? "uses your `claude /login` session (Max / Pro / API key / Bedrock / Vertex)"
      : model.providerId === "cursor-cli"
        ? "uses your Cursor subscription (`cursor-agent login`)"
        : "billed via your API key";
  return (
    <div className={`model-card ${selected ? "selected" : ""}`}>
      <div className="model-card-left">
        <div className="model-card-name">
          <code>{model.modelId}</code>
          {model.supportsTools && (
            <span className="model-card-tag tag-tools">tools</span>
          )}
          {selected && <span className="model-card-tag tag-selected">in use</span>}
        </div>
        <div className="model-card-desc">{model.displayName}</div>
        {(ctxLabel || billingLabel) && (
          <div className="model-card-meta">
            {ctxLabel}
            {ctxLabel && billingLabel ? " · " : ""}
            {billingLabel}
          </div>
        )}
      </div>
      <div className="model-card-actions">
        <button
          className={`primary ${selected ? "secondary" : ""}`}
          onClick={onUse}
          disabled={selected}
        >
          {selected ? "In use" : "Use"}
        </button>
      </div>
    </div>
  );
}
