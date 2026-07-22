import { useEffect, useState } from "react";
import { useStore } from "../store";
import { useEditorState, getActiveEditor } from "../editorState";
import { useTheme, type ThemeMode } from "../theme";
import { runCommand } from "../actions";
import { useEditorSettings, zoomIn, zoomOut, zoomReset } from "../editorSettings";
import { basename } from "../pathUtils";
import { Icon, type IconName } from "./Icon";
import { type GitStatus } from "../ipc";
import {
  getGitStatus,
  startGitStatusWatch,
  subscribeGitStatus,
} from "../gitStatusStore";
import { openPalette } from "../paletteBus";
import { invoke } from "@tauri-apps/api/core";
import { openTaskManager } from "../taskManagerBus";
import { toggleAudit } from "../auditWindow";
import { publishProcessStats } from "../perfAuditBus";
import { useAgentMode } from "../agentMode";
import { termIdOfPanel, useAgentContextPanel } from "../agentContextNav";

interface Props {
  onOpenPalette: () => void;
}

const themeNext: Record<ThemeMode, ThemeMode> = {
  dark: "light",
  light: "system",
  system: "dark",
};

const themeIcon: Record<ThemeMode, IconName> = {
  light: "sun",
  dark: "moon",
  system: "monitor",
};

export function StatusBar({ onOpenPalette }: Props) {
  const editorState = useEditorState();
  const [theme, setTheme] = useTheme();
  const settings = useEditorSettings();
  const activeId = useStore((s) => s.activeId);
  const ws = useStore((s) =>
    s.activeId ? s.loaded[s.activeId] : null,
  );
  const dirtyCount = ws
    ? Object.values(ws.files).filter((f) => f.contents !== f.original).length
    : 0;
  // Per-workspace footprint glance: how many file buffers and PTYs the
  // active workspace is holding. Useful for noticing when a session has
  // accumulated more than expected — esp. terminals, which keep PTYs
  // alive in the background. Hidden when both are zero (clean slate).
  const bufCount = ws ? Object.keys(ws.files).length : 0;
  const termCount = ws ? Object.keys(ws.terminals).length : 0;
  const showFootprint = bufCount > 0 || termCount > 0;
  // Editor zoom chip: percent of the hardcoded default font size (13).
  // Hidden at 100% on an empty workspace — only shows when the user has
  // actually zoomed, or when there's a focused file so they can adjust
  // mid-edit. Agent Mode has no IDE editor surface — hide entirely.
  const DEFAULT_FONT_SIZE = 13;
  const zoomPct = Math.round((settings.fontSize / DEFAULT_FONT_SIZE) * 100);

  const sidebarVisible = ws?.layout.sidebarVisible ?? true;
  const bottomVisible = ws?.layout.bottomVisible ?? true;
  const sidebarView = ws?.layout.sidebarView ?? "files";
  const agentMode = useAgentMode();
  const agentPanel = useAgentContextPanel(activeId ?? "");
  const agentTermOpen = agentMode && !!termIdOfPanel(agentPanel);
  // In Agent Mode the bottom panel is gone — highlight when the right
  // column is showing a project terminal instead.
  const panelActive = agentMode ? agentTermOpen : bottomVisible;
  const explorerActive = agentMode
    ? agentPanel === "files"
    : sidebarVisible && sidebarView === "files";
  const gitActive = agentMode
    ? agentPanel === "changes"
    : sidebarVisible && sidebarView === "git";
  const showZoom = !agentMode && (zoomPct !== 100 || !!editorState.filePath);

  // Live resource glance for Quack's own process tree (app + PTY
  // shells + Claude Code subprocesses), polled every 5s. Clicking it
  // opens the Task Manager. CPU is summed per-core percent.
  const [procTotals, setProcTotals] = useState<{
    cpu: number;
    mem: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const stats =
          await invoke<
            Array<{
              pid: number;
              parent: number | null;
              name: string;
              cmd: string;
              cpu: number;
              mem: number;
              depth: number;
              killable: boolean;
              related: boolean;
            }>
          >("process_stats");
        if (!cancelled) {
          publishProcessStats(stats);
          setProcTotals({
            cpu: stats.reduce((a, p) => a + p.cpu, 0),
            mem: stats.reduce((a, p) => a + p.mem, 0),
          });
        }
      } catch {
        /* keep last reading */
      }
    };
    void tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Branch chip from the shared gitStatusStore (same fetch as the tree /
  // composer) — no separate 15s poll that raced FS-driven refreshes.
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const wsRoot = ws?.meta.root;
  useEffect(() => {
    if (!activeId || !wsRoot) {
      setGitStatus(null);
      return;
    }
    const apply = () => setGitStatus(getGitStatus(activeId).status);
    const stop = startGitStatusWatch(activeId, wsRoot);
    const unsub = subscribeGitStatus(activeId, apply);
    apply();
    return () => {
      unsub();
      stop();
    };
  }, [activeId, wsRoot]);

  const cycleTheme = () => setTheme(themeNext[theme]);

  return (
    <div className="statusbar" role="status">
      <div className="sb-section sb-left">
        {procTotals && (
          <button
            type="button"
            className="sb-item sb-proc"
            onClick={openTaskManager}
            title="Quack process tree — CPU (sum of per-core %) · RAM. Click for Task Manager (Ctrl+Alt+U)"
          >
            <Icon name="monitor" size={11} />
            {Math.round(procTotals.cpu)}% ·{" "}
            {procTotals.mem >= 1024 * 1024 * 1024
              ? `${(procTotals.mem / (1024 * 1024 * 1024)).toFixed(1)} GB`
              : `${Math.round(procTotals.mem / (1024 * 1024))} MB`}
          </button>
        )}
        <button
          type="button"
          className="sb-item sb-audit"
          onClick={() => void toggleAudit()}
          title="Perf Audit — processes + switch/hydrate timeline (Ctrl+Alt+P)"
        >
          <Icon name="chart-bar" size={11} />
          Audit
        </button>
        {ws && (
          <span className="sb-item sb-ws" title={ws.meta.root}>
            <span className="sb-icon">⌥</span>
            {ws.meta.name}
          </span>
        )}
        {editorState.filePath && (
          <span
            className="sb-item sb-file"
            title={editorState.filePath}
          >
            {basename(editorState.filePath)}
          </span>
        )}
        {dirtyCount > 0 && (
          <span
            className="sb-item sb-dirty"
            title={`${dirtyCount} unsaved file${dirtyCount > 1 ? "s" : ""}`}
          >
            ● {dirtyCount}
          </span>
        )}
        {gitStatus?.is_repo && gitStatus.branch && (
          <button
            type="button"
            className="sb-item sb-git"
            title={(() => {
              const parts: string[] = [`Branch: ${gitStatus.branch}`];
              if (gitStatus.upstream) {
                parts.push(`tracking ${gitStatus.upstream}`);
              }
              if (gitStatus.ahead || gitStatus.behind) {
                parts.push(
                  `${gitStatus.ahead} ahead, ${gitStatus.behind} behind`,
                );
              }
              if (gitStatus.files.length > 0) {
                parts.push(
                  `${gitStatus.files.length} changed file${
                    gitStatus.files.length > 1 ? "s" : ""
                  }`,
                );
              }
              parts.push("(click for Source Control)");
              return parts.join(" · ");
            })()}
            onClick={() => runCommand("view.source_control")}
          >
            <Icon name="git-branch" size={11} />
            <span>{gitStatus.branch}</span>
            {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
              <span className="sb-git-trail">
                {gitStatus.ahead > 0 && ` ↑${gitStatus.ahead}`}
                {gitStatus.behind > 0 && ` ↓${gitStatus.behind}`}
              </span>
            )}
            {gitStatus.files.length > 0 && (
              <span className="sb-git-trail">·{gitStatus.files.length}</span>
            )}
          </button>
        )}
      </div>

      <div className="sb-section sb-right">
        {editorState.filePath && (
          <>
            {editorState.selectionText.length > 0
              ? (() => {
                  const sel = editorState.selectionText;
                  const chars = sel.length;
                  const trimmed = sel.trim();
                  const words =
                    trimmed.length === 0
                      ? 0
                      : trimmed.split(/\s+/).filter(Boolean).length;
                  const lines = editorState.selectionLines;
                  const bytes = new Blob([sel]).size;
                  return (
                    <button
                      type="button"
                      className="sb-item sb-git sb-pos-btn"
                      title={`Selection: ${lines} line${lines === 1 ? "" : "s"}, ${words} word${words === 1 ? "" : "s"}, ${chars} char${chars === 1 ? "" : "s"}, ${bytes} byte${bytes === 1 ? "" : "s"} (UTF-8) — click to Go to Line (Ctrl+G)`}
                      aria-label="Selection counters; click to go to line"
                      onClick={() => runCommand("edit.goto_line")}
                    >
                      {lines}L · {words}W · {chars}C
                    </button>
                  );
                })()
              : (
                <button
                  type="button"
                  className="sb-item sb-git sb-pos-btn"
                  title="Go to line… (Ctrl+G)"
                  aria-label="Go to line…"
                  onClick={() => runCommand("edit.goto_line")}
                >
                  Ln {editorState.line}, Col {editorState.col}
                </button>
              )}
            {editorState.language && (
              <button
                type="button"
                className="sb-item sb-git"
                title="Change language mode"
                aria-label="Change language mode"
                onClick={() => {
                  const ed = getActiveEditor();
                  ed?.getAction("editor.action.changeLanguage")?.run();
                }}
              >
                {editorState.language}
              </button>
            )}
          </>
        )}

        {showFootprint && (
          <button
            type="button"
            className="sb-item sb-footprint"
            title={`${bufCount} open file buffer${
              bufCount === 1 ? "" : "s"
            }, ${termCount} open terminal${
              termCount === 1 ? "" : "s"
            } — click for footprint details`}
            aria-label={`Workspace footprint: ${bufCount} file buffer${
              bufCount === 1 ? "" : "s"
            }, ${termCount} terminal${termCount === 1 ? "" : "s"}`}
            onClick={() => openPalette("footprint")}
          >
            <Icon name="info" size={11} />
            <span className="sb-footprint-num">buf{bufCount}</span>
            <span className="sb-footprint-sep">·</span>
            <span className="sb-footprint-num">term{termCount}</span>
          </button>
        )}

        {showZoom && (
          <button
            type="button"
            className="sb-item sb-git"
            title={`Editor zoom: ${zoomPct}% — click to zoom in, Shift+click to zoom out, middle-click to reset`}
            aria-label={`Editor zoom: ${zoomPct}%`}
            onClick={(e) => {
              if (e.shiftKey) zoomOut();
              else zoomIn();
            }}
            onAuxClick={(e) => {
              if (e.button === 1) zoomReset();
            }}
          >
            {zoomPct}%
          </button>
        )}

        <button
          className={`sb-btn ${explorerActive ? "active" : ""}`}
          title={
            agentMode
              ? "Toggle Files (Ctrl+B)"
              : "Toggle Explorer (Ctrl+B)"
          }
          aria-label={agentMode ? "Toggle Files" : "Toggle Explorer"}
          aria-pressed={explorerActive}
          disabled={!activeId}
          onClick={() => runCommand("view.toggle_sidebar")}
        >
          <Icon name="folder" />
        </button>
        <button
          className={`sb-btn ${gitActive ? "active" : ""}`}
          title={
            agentMode
              ? "Changes (Ctrl+Shift+G)"
              : "Source Control (Ctrl+Shift+G)"
          }
          aria-label={agentMode ? "Show Changes" : "Source Control"}
          aria-pressed={gitActive}
          disabled={!activeId}
          onClick={() => runCommand("view.source_control")}
        >
          <Icon name="git-branch" />
        </button>
        <button
          className={`sb-btn ${panelActive ? "active" : ""}`}
          title={
            agentMode
              ? "Toggle Terminal (Ctrl+J)"
              : "Toggle Panel (Ctrl+J)"
          }
          aria-label={
            agentMode ? "Toggle Agent Mode terminal" : "Toggle bottom panel"
          }
          aria-pressed={panelActive}
          disabled={!activeId}
          onClick={() => runCommand("view.toggle_panel")}
        >
          <Icon name="panel-bottom" />
        </button>
        <button
          className="sb-btn"
          title="New Terminal"
          aria-label="New terminal"
          disabled={!activeId}
          onClick={() => runCommand("terminal.new_bottom")}
        >
          <Icon name="terminal" />
        </button>
        {!agentMode && (
          <button
            className={`sb-btn ${settings.autoSave ? "active" : ""}`}
            title={
              settings.autoSave
                ? "Auto-save ON (click to disable)"
                : "Auto-save OFF (click to enable)"
            }
            aria-label={
              settings.autoSave ? "Disable auto-save" : "Enable auto-save"
            }
            aria-pressed={settings.autoSave}
            onClick={() => runCommand("edit.toggle_auto_save")}
          >
            <Icon name={settings.autoSave ? "save-auto" : "save"} />
          </button>
        )}
        {!agentMode && (
          <button
            className="sb-btn"
            title="Save (Ctrl+S)"
            aria-label="Save current file"
            disabled={!editorState.filePath}
            onClick={() => runCommand("file.save")}
          >
            <Icon name="save" />
          </button>
        )}
        <button
          className="sb-btn"
          title="Open Folder (Ctrl+O)"
          aria-label="Open folder"
          onClick={() => runCommand("file.open_folder")}
        >
          <Icon name="folder-open" />
        </button>
        <button
          className="sb-btn"
          title="Command Palette (Ctrl+P)"
          aria-label="Command palette"
          onClick={onOpenPalette}
        >
          <Icon name="command" />
        </button>
        <button
          className="sb-btn"
          title="Settings (Ctrl+,)"
          aria-label="Settings"
          onClick={() => runCommand("view.settings")}
        >
          <Icon name="settings" />
        </button>
        <button
          className="sb-btn sb-theme"
          title={`Theme: ${theme} — click to cycle`}
          aria-label={`Theme: ${theme}, click to cycle`}
          onClick={cycleTheme}
        >
          <Icon name={themeIcon[theme]} />
        </button>
      </div>
    </div>
  );
}
