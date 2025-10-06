import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Store } from "@tauri-apps/plugin-store";

import TerminalSidebar from "./components/TerminalSidebar";
import TerminalView from "./components/TerminalView";
import FileExplorer from "./components/FileExplorer";
import NewTerminalModal from "./components/NewTerminalModal";
import FilePreviewDrawer from "./components/FilePreviewDrawer";
import GitPanel from "./components/GitPanel";
import ToolBar from "./components/ToolBar";
import ProcessesDrawer from "./components/ProcessesDrawer";
import SavedCommandsDrawer from "./components/SavedCommandsDrawer";
import SavedCommandModal from "./components/SavedCommandModal";
import PreviewDrawer from "./components/PreviewDrawer";
import AISettingsPanel from "./components/AISettingsPanel";
import type { DiffInfo } from "./components/CodeEditor";
import { parseDiff } from "./lib/diffParser";

import type {
  DirectoryEntry,
  DirectoryListing,
  GitCommitEntry,
  GitStatusEntry,
  GitStatusSummary,
  TerminalExitEvent,
  TerminalInfo,
  SavedCommand,
  ProcessInfo,
} from "./types";

interface TerminalMetadata {
  label: string;
  color: string;
  cwd: string;
}

import "./App.css";

const splashImage = new URL("../images/quackapp.jpeg", import.meta.url).href;

const COLORS = [
  "#f28c52",
  "#ffb26f",
  "#ffd166",
  "#f77aa6",
  "#4dd4b3",
  "#8fa6ff",
  "#f2a57b",
];

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = new RegExp("\\x1B\\[[0-9;?]*[ -/]*[@-~]", "g");
// eslint-disable-next-line no-control-regex
const OSC_REGEX = new RegExp("\\x1B\\][^\\x07]*\\x07", "g");
const PROMPT_REGEX = /(?:[$#%>|❯])\s*$/;

const normalizeKey = (value: string): string => value.trim().toLowerCase();
const slugify = (value: string): string =>
  normalizeKey(value).replace(/[^a-z0-9]+/g, "-");

const stripAnsi = (text: string): string =>
  text.replace(OSC_REGEX, "").replace(ANSI_REGEX, "");

const chunkContainsPrompt = (text: string): boolean => {
  const sanitized = stripAnsi(text).replace(/\r/g, "\n");
  const lines = sanitized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) {
    return false;
  }
  return PROMPT_REGEX.test(lines[lines.length - 1]);
};

const STORAGE_KEY = "terminals";

const saveTerminalsToStorage = async (terminals: TerminalInfo[]) => {
  try {
    const store = await Store.load("quack-terminals.json");
    const metadata: TerminalMetadata[] = terminals.map((t) => ({
      label: t.label,
      color: t.color,
      cwd: t.cwd,
    }));
    await store.set(STORAGE_KEY, metadata);
    await store.save();
  } catch (error) {
    console.warn("Unable to save terminals", error);
  }
};

const loadTerminalsFromStorage = async (): Promise<TerminalMetadata[]> => {
  try {
    const store = await Store.load("quack-terminals.json");
    const stored = await store.get<TerminalMetadata[]>(STORAGE_KEY);
    return stored ?? [];
  } catch (error) {
    console.warn("Unable to load saved terminals", error);
    return [];
  }
};

const playQuackSound = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "square";
    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(250, now + 0.25);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.5);
    oscillator.onended = () => {
      const close = (ctx as AudioContext & { close?: () => Promise<void> })
        .close;
      if (typeof close === "function") {
        try {
          const result = close.call(ctx);
          const promiseLike = result as Promise<void>;
          if (promiseLike && typeof promiseLike.then === "function") {
            promiseLike.catch(() => undefined);
          }
        } catch {
          // ignore close errors
        }
      }
    };
  } catch (error) {
    console.warn("Unable to play notification sound", error);
  }
};

function App() {
  const [tauriAvailable] = useState(
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );

  // Check if we're running inside the preview-webview window
  // If so, don't initialize the app to avoid permission errors
  const [isPreviewWebview] = useState(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return false;
    }
    try {
      const current = getCurrentWindow();
      return current.label === "preview-webview";
    } catch {
      return false;
    }
  });

  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [explorerPath, setExplorerPath] = useState("");
  const [explorerTree, setExplorerTree] = useState<
    Record<string, DirectoryEntry[]>
  >({});
  const [explorerRoot, setExplorerRoot] = useState<string | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [creatingTerminal, setCreatingTerminal] = useState(false);
  const [showNewTerminalModal, setShowNewTerminalModal] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState("");
  const [newTerminalPath, setNewTerminalPath] = useState("");
  const [newTerminalColor, setNewTerminalColor] = useState(COLORS[0]);
  const [newTerminalError, setNewTerminalError] = useState<string | null>(null);
  const [selectingDirectory, setSelectingDirectory] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [booting, setBooting] = useState(true);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [formattingPreview, setFormattingPreview] = useState(false);
  const [previewDiffInfo, setPreviewDiffInfo] = useState<DiffInfo | null>(null);
  const [showGitDrawer, setShowGitDrawer] = useState(false);
  const [showProcessesDrawer, setShowProcessesDrawer] = useState(false);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [previewDrawerWidth, setPreviewDrawerWidth] = useState(() => {
    if (typeof window === "undefined") {
      return 960;
    }
    const stored = window.localStorage.getItem("previewDrawer.width");
    const value = stored ? Number.parseInt(stored, 10) : NaN;
    if (Number.isFinite(value)) {
      return Math.min(1200, Math.max(420, value));
    }
    return Math.min(window.innerWidth * 0.7, 960);
  });
  const [gitSummary, setGitSummary] = useState<GitStatusSummary | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [selectedGitPath, setSelectedGitPath] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<"worktree" | "staged">("worktree");
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitHistory, setCommitHistory] = useState<GitCommitEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("sidebar.collapsed.groups");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [editingTerminal, setEditingTerminal] = useState<TerminalInfo | null>(
    null
  );
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const idleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const terminalsRef = useRef<TerminalInfo[]>([]);
  const IDLE_TIMEOUT_MS = 2000;
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [activeProcesses, setActiveProcesses] = useState<ProcessInfo[]>([]);
  const [savedCommandsDrawerOpen, setSavedCommandsDrawerOpen] = useState(false);
  const [savedCommandModalOpen, setSavedCommandModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SavedCommand | null>(
    null
  );

  const activeTerminal = useMemo(
    () => terminals.find((terminal) => terminal.id === activeId) ?? null,
    [activeId, terminals]
  );

  const selectedGitEntry = useMemo(() => {
    if (!gitSummary || !selectedGitPath) {
      return null;
    }
    return (
      gitSummary.entries.find((entry) => entry.path === selectedGitPath) ?? null
    );
  }, [gitSummary, selectedGitPath]);

  const gridTemplateColumns = "340px minmax(0, 1fr) 340px";

  const loadSavedCommands = useCallback(async () => {
    try {
      const commands = await invoke<SavedCommand[]>("load_saved_commands");
      setSavedCommands(commands);
    } catch (error) {
      console.warn("Unable to load saved commands", error);
    }
  }, []);

  const loadActiveProcesses = useCallback(async () => {
    if (!tauriAvailable) {
      return;
    }

    try {
      const processes = await invoke<ProcessInfo[]>('get_active_processes');
      setActiveProcesses(processes);
    } catch (error) {
      console.error('Failed to load active processes:', error);
      setActiveProcesses([]);
    }
  }, [tauriAvailable]);

  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    void loadSavedCommands();
    void loadActiveProcesses();
    const interval = setInterval(() => {
      void loadActiveProcesses();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadActiveProcesses, loadSavedCommands, tauriAvailable]);

  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }

    if (terminals.length > 0) {
      void saveTerminalsToStorage(terminals);
    } else {
      // If no terminals, clean up storage
      void (async () => {
        try {
          const store = await Store.load("quack-terminals.json");
          await store.delete(STORAGE_KEY);
          await store.save();
        } catch {
          // Ignore errors
        }
      })();
    }
  }, [hasBootstrapped, tauriAvailable, terminals]);

  const ensureNotificationPermission =
    useCallback(async (): Promise<boolean> => {
      if (!tauriAvailable) {
        return false;
      }
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === "granted";
        }
        setNotificationGranted(granted);
        return granted;
      } catch (error) {
        console.warn("Unable to verify notification permissions", error);
        setNotificationGranted(false);
        return false;
      }
    }, [tauriAvailable]);

  const notifyTerminalReady = useCallback(
    async (payload: { id: string; label: string }) => {
      playQuackSound();

      if (!tauriAvailable) {
        return;
      }

      let granted = notificationGranted;
      if (!granted) {
        granted = await ensureNotificationPermission();
      }

      if (!granted) {
        return;
      }

      try {
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: "Terminal ready",
          body: `${payload.label} is waiting for input.`,
        });
      } catch (error) {
        console.warn("Unable to show notification", error);
      }
    },
    [ensureNotificationPermission, notificationGranted, tauriAvailable]
  );

  const loadDirectory = useCallback(
    async (path?: string) => {
      setLoadingExplorer(true);
      setExplorerError(null);
      if (!tauriAvailable) {
        setLoadingExplorer(false);
        setExplorerError(
          "Launch the Tauri desktop app to use the file explorer."
        );
        setExplorerTree({});
        setExplorerRoot(null);
        return;
      }
      try {
        const listing = await invoke<DirectoryListing>("list_directory", {
          path: path ?? null,
        });
        setExplorerPath(listing.path);
        setExplorerTree((previous) => ({
          ...previous,
          [listing.path]: listing.entries,
        }));
        setExplorerRoot(listing.path);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setExplorerError(message);
      } finally {
        setLoadingExplorer(false);
      }
    },
    [tauriAvailable]
  );

  const fetchDirectoryChildren = useCallback(
    async (path: string) => {
      if (!tauriAvailable) {
        setExplorerError(
          "Launch the Tauri desktop app to use the file explorer."
        );
        return [];
      }
      try {
        const listing = await invoke<DirectoryListing>("list_directory", {
          path,
        });
        setExplorerTree((previous) => ({
          ...previous,
          [listing.path]: listing.entries,
        }));
        return listing.entries;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setExplorerError(message);
        return [];
      }
    },
    [tauriAvailable]
  );

  const markTerminalBusy = useCallback((id: string) => {
    setTerminals((prev) =>
      prev.map((terminal) =>
        terminal.id === id
          ? { ...terminal, status: "busy", needsAttention: false }
          : terminal
      )
    );
  }, []);

  const markTerminalIdle = useCallback(
    (id: string, options?: { suppressNotification?: boolean }) => {
      const suppressNotification = options?.suppressNotification === true;
      let notifyInfo: { id: string; label: string } | null = null;
      setTerminals((prev) =>
        prev.map((terminal) => {
          if (terminal.id !== id) {
            return terminal;
          }
          const wasBusy = terminal.status === "busy";
          const needsAttention = wasBusy && id !== activeId;
          if (needsAttention) {
            notifyInfo = { id: terminal.id, label: terminal.label };
          }
          return {
            ...terminal,
            status: "idle",
            needsAttention,
          };
        })
      );

      if (notifyInfo && !suppressNotification) {
        void notifyTerminalReady(notifyInfo);
      }
    },
    [activeId, notifyTerminalReady]
  );

  const clearTerminalAttention = useCallback((id: string) => {
    setTerminals((prev) =>
      prev.map((terminal) =>
        terminal.id === id ? { ...terminal, needsAttention: false } : terminal
      )
    );
  }, []);

  const clearIdleTimer = useCallback((id: string) => {
    const timer = idleTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      idleTimersRef.current.delete(id);
    }
  }, []);

  const scheduleIdleTimer = useCallback(
    (id: string) => {
      clearIdleTimer(id);
      const handle = setTimeout(() => {
        markTerminalIdle(id);
        idleTimersRef.current.delete(id);
      }, IDLE_TIMEOUT_MS);
      idleTimersRef.current.set(id, handle);
    },
    [clearIdleTimer, markTerminalIdle]
  );

  const resolveTerminalId = useCallback(
    ({ id, label }: { id?: string | null; label?: string | null }) => {
      const terminalsSnapshot = terminalsRef.current;
      const candidates = [id, label];

      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }
        const trimmed = candidate.trim();
        if (!trimmed) {
          continue;
        }
        const direct = terminalsSnapshot.find(
          (terminal) => terminal.id === trimmed
        );
        if (direct) {
          return direct.id;
        }
      }

      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }
        const trimmed = candidate.trim();
        if (!trimmed) {
          continue;
        }
        const normalizedCandidate = normalizeKey(trimmed);
        const labelMatch = terminalsSnapshot.find(
          (terminal) => normalizeKey(terminal.label) === normalizedCandidate
        );
        if (labelMatch) {
          return labelMatch.id;
        }
      }

      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }
        const trimmed = candidate.trim();
        if (!trimmed) {
          continue;
        }
        const slugCandidate = slugify(trimmed);
        const slugMatch = terminalsSnapshot.find(
          (terminal) => slugify(terminal.label) === slugCandidate
        );
        if (slugMatch) {
          return slugMatch.id;
        }
      }

      return null;
    },
    []
  );

  const handleTerminalInput = useCallback(
    (id: string, data: string) => {
      if (!data) {
        return;
      }
      if (
        data.includes("\r") ||
        data.includes("\n") ||
        data.trim().length > 0
      ) {
        markTerminalBusy(id);
        clearIdleTimer(id);
      }
    },
    [clearIdleTimer, markTerminalBusy]
  );

  const handleTerminalOutput = useCallback(
    (id: string, data: string) => {
      if (!data) {
        return;
      }
      if (chunkContainsPrompt(data)) {
        markTerminalIdle(id);
        clearIdleTimer(id);
      } else {
        markTerminalBusy(id);
        scheduleIdleTimer(id);
      }
    },
    [clearIdleTimer, markTerminalBusy, markTerminalIdle, scheduleIdleTimer]
  );

  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }

    const unlistenPromise = listen<{
      id?: string | null;
      label?: string | null;
      status: string;
      notify?: boolean;
    }>("external-terminal-status", (event) => {
      const payload = event.payload;
      if (!payload) {
        return;
      }

      const resolvedId = resolveTerminalId({
        id: payload.id ?? undefined,
        label: payload.label ?? undefined,
      });
      if (!resolvedId) {
        console.warn(
          "Hook event ignored: no matching terminal for",
          payload
        );
        return;
      }

      const status =
        typeof payload.status === "string" ? payload.status.toLowerCase() : "";
      if (status === "busy") {
        markTerminalBusy(resolvedId);
        clearIdleTimer(resolvedId);
      } else if (status === "idle") {
        clearIdleTimer(resolvedId);
        markTerminalIdle(resolvedId, {
          suppressNotification: payload.notify === false,
        });
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [
    clearIdleTimer,
    markTerminalBusy,
    markTerminalIdle,
    resolveTerminalId,
    tauriAvailable,
  ]);

  useEffect(() => {
    if (!tauriAvailable) {
      setBooting(false);
      setHasBootstrapped(true);
      setExplorerError("Run the app via Tauri to activate terminals.");
      return;
    }

    void ensureNotificationPermission();

    const bootstrap = async () => {
      try {
        // Try to load saved terminals
        const savedMetadata = await loadTerminalsFromStorage();

        if (savedMetadata.length > 0) {
          // Recreate terminals from saved metadata
          const recreated: TerminalInfo[] = [];
          for (const metadata of savedMetadata) {
            try {
              const terminal = await invoke<TerminalInfo>("create_terminal", {
                label: metadata.label,
                color: metadata.color,
                cwd: metadata.cwd,
              });
              recreated.push({
                ...terminal,
                status: "idle" as const,
                needsAttention: false,
              });
            } catch (error) {
              console.warn(
                `Unable to recreate terminal ${metadata.label}`,
                error
              );
            }
          }

          if (recreated.length > 0) {
            setTerminals(recreated);
            setActiveId(recreated[0].id);
            await loadDirectory(recreated[0].cwd);
          } else {
            // Fallback: create a default terminal
            const initial = await invoke<TerminalInfo>("create_terminal", {
              label: "Terminal 1",
              color: COLORS[0],
              cwd: null,
            });
            const initialWithState = {
              ...initial,
              status: "idle" as const,
              needsAttention: false,
            };
            setTerminals([initialWithState]);
            setActiveId(initialWithState.id);
            await loadDirectory(initialWithState.cwd);
          }
        } else {
          // No saved terminals, create a default one
          const initial = await invoke<TerminalInfo>("create_terminal", {
            label: "Terminal 1",
            color: COLORS[0],
            cwd: null,
          });
          const initialWithState = {
            ...initial,
            status: "idle" as const,
            needsAttention: false,
          };
          setTerminals([initialWithState]);
          setActiveId(initialWithState.id);
          await loadDirectory(initialWithState.cwd);
        }
      } catch (error) {
        console.error("Error during initialization", error);
      } finally {
        setBooting(false);
        setHasBootstrapped(true);
      }
    };

    void bootstrap();
  }, [ensureNotificationPermission, loadDirectory, tauriAvailable]);
  useEffect(() => {
    if (!tauriAvailable) {
      setBooting(false);
    }
  }, [tauriAvailable]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const connect = async () => {
      try {
        if (!tauriAvailable) {
          return;
        }
        unlisten = await listen<TerminalExitEvent>("terminal-exit", (event) => {
          setTerminals((prev) =>
            prev.map((terminal) =>
              terminal.id === event.payload.id
                ? { ...terminal, alive: false }
                : terminal
            )
          );
          markTerminalIdle(event.payload.id);
        });
      } catch (error) {
        console.warn("Unable to listen to exit events", error);
      }
    };

    void connect();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [markTerminalIdle, tauriAvailable]);

  const handleToggleGroup = useCallback((cwd: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cwd)) {
        next.delete(cwd);
      } else {
        next.add(cwd);
      }
      localStorage.setItem(
        "sidebar.collapsed.groups",
        JSON.stringify(Array.from(next))
      );
      return next;
    });
  }, []);

  const handleEditTerminal = useCallback((terminal: TerminalInfo) => {
    setEditingTerminal(terminal);
    setNewTerminalName(terminal.label);
    setNewTerminalColor(terminal.color);
    setNewTerminalPath(terminal.cwd);
    setNewTerminalError(null);
    setShowNewTerminalModal(true);
  }, []);

  const handleReorderTerminals = useCallback((reorderedIds: string[]) => {
    setTerminals((prev) => {
      // Crea una mappa per accesso rapido
      const terminalMap = new Map(prev.map((t) => [t.id, t]));
      // Riordina secondo l'array di IDs
      return reorderedIds.map((id) => terminalMap.get(id)).filter(Boolean) as TerminalInfo[];
    });
  }, []);

  const handleOpenNewTerminalModal = useCallback(() => {
    if (!tauriAvailable) {
      setExplorerError("Terminals available only via desktop app.");
      return;
    }
    setEditingTerminal(null);
    setNewTerminalError(null);
    const index = terminals.length;
    const defaultColor = COLORS[index % COLORS.length];
    setNewTerminalName(`Terminal ${index + 1}`);
    setNewTerminalColor(defaultColor);
    const fallbackPath = activeTerminal?.cwd ?? explorerPath ?? "";
    setNewTerminalPath(fallbackPath);
    setShowNewTerminalModal(true);
  }, [activeTerminal, explorerPath, tauriAvailable, terminals.length]);

  const handleCancelNewTerminal = useCallback(() => {
    if (creatingTerminal) {
      return;
    }
    setShowNewTerminalModal(false);
    setNewTerminalError(null);
    setSelectingDirectory(false);
    setEditingTerminal(null);
  }, [creatingTerminal]);

  const handleSelectDirectory = useCallback(async () => {
    if (selectingDirectory || !tauriAvailable) {
      return;
    }

    setNewTerminalError(null);
    setSelectingDirectory(true);
    try {
      const selected = (await openDialog({
        directory: true,
        multiple: false,
        defaultPath: newTerminalPath || explorerPath || undefined,
        title: "Select working directory",
      })) as string | string[] | null;

      if (typeof selected === "string") {
        setNewTerminalPath(selected);
      } else if (
        Array.isArray(selected) &&
        selected.length > 0 &&
        typeof selected[0] === "string"
      ) {
        setNewTerminalPath(selected[0]);
      }
    } catch (error) {
      console.error("Unable to select directory", error);
      setNewTerminalError("Unable to select directory. Please try again.");
    } finally {
      setSelectingDirectory(false);
    }
  }, [explorerPath, newTerminalPath, selectingDirectory, tauriAvailable]);

  const handleConfirmNewTerminal = useCallback(async () => {
    if (!tauriAvailable || creatingTerminal) {
      return;
    }

    const trimmedName = newTerminalName.trim();
    const trimmedPath = newTerminalPath.trim();

    if (!trimmedName) {
      setNewTerminalError("Enter a terminal name.");
      return;
    }

    if (!trimmedPath) {
      setNewTerminalError("Select working directory.");
      return;
    }

    setCreatingTerminal(true);
    setNewTerminalError(null);

    try {
      if (editingTerminal) {
        // Update existing terminal
        await invoke("update_terminal", {
          id: editingTerminal.id,
          label: trimmedName,
          color: newTerminalColor,
          cwd: trimmedPath,
        });

        setTerminals((prev) =>
          prev.map((t) =>
            t.id === editingTerminal.id
              ? {
                  ...t,
                  label: trimmedName,
                  color: newTerminalColor,
                  cwd: trimmedPath,
                }
              : t
          )
        );

        // If cwd changed and this is active terminal, reload directory
        if (
          trimmedPath !== editingTerminal.cwd &&
          editingTerminal.id === activeId
        ) {
          await loadDirectory(trimmedPath);
        }

        setShowNewTerminalModal(false);
        setEditingTerminal(null);
      } else {
        // Create new terminal
        const created = await invoke<TerminalInfo>("create_terminal", {
          label: trimmedName,
          color: newTerminalColor,
          cwd: trimmedPath,
        });
        const createdWithState: TerminalInfo = {
          ...created,
          status: "idle",
          needsAttention: false,
        };
        setTerminals((prev) => [...prev, createdWithState]);
        setActiveId(createdWithState.id);
        clearTerminalAttention(createdWithState.id);
        setShowNewTerminalModal(false);
        await loadDirectory(createdWithState.cwd);
      }
    } catch (error) {
      console.error("Unable to save terminal", error);
      const message = error instanceof Error ? error.message : String(error);
      setNewTerminalError(message);
    } finally {
      setCreatingTerminal(false);
    }
  }, [
    activeId,
    clearTerminalAttention,
    creatingTerminal,
    editingTerminal,
    loadDirectory,
    newTerminalColor,
    newTerminalName,
    newTerminalPath,
    tauriAvailable,
  ]);

  const handleSelectTerminal = useCallback(
    (id: string) => {
      if (!tauriAvailable) {
        return;
      }
      setActiveId(id);
      clearTerminalAttention(id);
      clearIdleTimer(id);
      const terminal = terminals.find((candidate) => candidate.id === id);
      if (terminal) {
        void loadDirectory(terminal.cwd);
      }
    },
    [
      clearIdleTimer,
      clearTerminalAttention,
      loadDirectory,
      tauriAvailable,
      terminals,
    ]
  );

  const handleCloseTerminal = useCallback(
    async (id: string) => {
      if (!tauriAvailable) {
        return;
      }
      clearIdleTimer(id);
      try {
        await invoke("close_terminal", { id });
      } catch (error) {
        console.error("Unable to close terminal", error);
      }

      let nextActive: string | null = activeId;
      let nextPath: string | null = null;

      setTerminals((prev) => {
        const updated = prev.filter((terminal) => terminal.id !== id);
        if (updated.length === prev.length) {
          return prev;
        }

        if (activeId === id) {
          const fallback = updated[updated.length - 1];
          nextActive = fallback ? fallback.id : null;
          nextPath = fallback ? fallback.cwd : null;
        }

        return updated;
      });

      setActiveId(nextActive);
      if (nextActive) {
        clearTerminalAttention(nextActive);
        clearIdleTimer(nextActive);
      }
      if (nextPath) {
        void loadDirectory(nextPath);
      }
    },
    [
      activeId,
      clearIdleTimer,
      clearTerminalAttention,
      loadDirectory,
      tauriAvailable,
    ]
  );


  const handleOpenPreviewDrawer = useCallback(() => {
    setShowPreviewDrawer(true);
  }, []);
  const handleColorChange = useCallback(
    async (id: string, color: string) => {
      if (!tauriAvailable) {
        return;
      }
      try {
        const updated = await invoke<TerminalInfo>("set_terminal_color", {
          id,
          color,
        });
        setTerminals((prev) =>
          prev.map((terminal) =>
            terminal.id === id ? { ...terminal, ...updated } : terminal
          )
        );
      } catch (error) {
        console.error("Unable to update color", error);
      }
    },
    [tauriAvailable]
  );

  const handleOpenFilePreview = useCallback(
    async (entry: DirectoryEntry) => {
      if (!tauriAvailable || entry.is_dir) {
        return;
      }
      setPreviewFile({ name: entry.name, path: entry.path });
      setPreviewContent("");
      setPreviewError(null);
      setPreviewDiffInfo(null);
      setLoadingPreview(true);

      try {
        // Load file content
        const content = await invoke<string>("read_file_content", {
          path: entry.path,
        });
        setPreviewContent(content);

        // If file is modified, also load the diff
        const isModified = gitSummary?.entries?.some((gitEntry) => {
          const fullPath = explorerRoot
            ? `${explorerRoot}/${gitEntry.path}`.replace(/\/+/g, "/")
            : gitEntry.path;
          return fullPath === entry.path;
        });

        if (isModified && gitSummary && explorerRoot) {
          try {
            // Calculate path relative to git root
            let relativePath = entry.path;
            if (entry.path.startsWith(explorerRoot)) {
              relativePath = entry.path.substring(explorerRoot.length);
              if (relativePath.startsWith("/")) {
                relativePath = relativePath.substring(1);
              }
            }

            const diff = await invoke<string>("git_diff", {
              path: relativePath,
              staged: false,
              untracked: false,
              rootPath: explorerRoot,
            });

            const diffInfo = parseDiff(diff);
            setPreviewDiffInfo(diffInfo);
          } catch (diffError) {
            console.warn("Unable to load diff:", diffError);
            // Don't block file opening if diff fails
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setPreviewError(message);
      } finally {
        setLoadingPreview(false);
      }
    },
    [tauriAvailable, gitSummary, explorerRoot]
  );

  const handleRefreshPreview = useCallback(async () => {
    if (!tauriAvailable || !previewFile) {
      return;
    }
    setPreviewError(null);
    setLoadingPreview(true);
    try {
      const content = await invoke<string>("read_file_content", {
        path: previewFile.path,
      });
      setPreviewContent(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewError(message);
    } finally {
      setLoadingPreview(false);
    }
  }, [previewFile, tauriAvailable]);

  const handleFormatPreview = useCallback(async () => {
    if (!tauriAvailable || !previewFile) {
      return;
    }

    const extension = previewFile.name.split(".").pop()?.toLowerCase() ?? "";
    const parser = (() => {
      if (["ts", "tsx"].includes(extension)) {
        return "typescript";
      }
      if (["js", "jsx", "mjs", "cjs"].includes(extension)) {
        return "babel";
      }
      if (extension === "json") {
        return "json";
      }
      if (["css", "scss", "less"].includes(extension)) {
        return "css";
      }
      if (["html", "htm"].includes(extension)) {
        return "html";
      }
      if (["md", "mdx", "markdown"].includes(extension)) {
        return "markdown";
      }
      return null;
    })();

    if (!parser) {
      setPreviewError("Formatting not available for this file type.");
      return;
    }

    setFormattingPreview(true);
    setPreviewError(null);
    try {
      const prettier = await import("prettier/standalone");
      const [babel, typescript, html, postcss, markdown] = await Promise.all([
        import("prettier/plugins/babel"),
        import("prettier/plugins/typescript"),
        import("prettier/plugins/html"),
        import("prettier/plugins/postcss"),
        import("prettier/plugins/markdown"),
      ]);

      const plugins = [
        babel.default,
        typescript.default,
        html.default,
        postcss.default,
        markdown.default,
      ].filter(Boolean);

      const formatted = await prettier.format(previewContent, {
        parser,
        plugins,
      });

      setPreviewContent(formatted);
      await invoke("write_file_content", {
        path: previewFile.path,
        content: formatted,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewError(message);
    } finally {
      setFormattingPreview(false);
    }
  }, [previewContent, previewFile, tauriAvailable]);

  const handleSaveFile = useCallback(
    async (content: string) => {
      if (!tauriAvailable || !previewFile) {
        return;
      }
      setPreviewError(null);
      try {
        await invoke("write_file_content", { path: previewFile.path, content });
        setPreviewContent(content);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setPreviewError(message);
      }
    },
    [previewFile, tauriAvailable]
  );

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewContent("");
    setPreviewError(null);
    setPreviewDiffInfo(null);
    setLoadingPreview(false);
    setFormattingPreview(false);
  }, []);

  const handleExecuteAICommand = useCallback(
    async (command: string, label: string) => {
      if (!tauriAvailable || !activeId) {
        return;
      }
      try {
        await invoke("write_to_terminal", {
          id: activeId,
          data: command + "\n",
        });
        console.log(`AI command executed: ${label} -> ${command}`);
      } catch (error) {
        console.error("Error executing AI command", error);
      }
    },
    [activeId, tauriAvailable]
  );

  const handleLaunchSavedCommand = useCallback(
    async (
      command: SavedCommand,
      options?: { launchImmediately?: boolean }
    ) => {
      if (!tauriAvailable) {
        return;
      }

      try {
        let targetTerminalId = activeId;
        if (!targetTerminalId || options?.launchImmediately) {
          const result = await invoke<TerminalInfo>("create_terminal", {
            label: command.name,
            color: command.color,
            cwd: command.cwd ?? null,
            commandOrigin: command.command,
          });
          const terminalWithState: TerminalInfo = {
            ...result,
            status: "busy",
            needsAttention: false,
          };
          setTerminals((prev) => [...prev, terminalWithState]);
          targetTerminalId = terminalWithState.id;
          setActiveId(targetTerminalId);
        }

        if (targetTerminalId) {
          await invoke("write_to_terminal", {
            id: targetTerminalId,
            data: `${command.command}\n`,
          });
          markTerminalBusy(targetTerminalId);
        }
      } catch (error) {
        console.error("Unable to launch saved command", error);
      }
    },
    [activeId, markTerminalBusy, tauriAvailable]
  );

  const refreshGitSummary = useCallback(async () => {
    if (!tauriAvailable) {
      return;
    }
    setLoadingGit(true);
    setGitError(null);
    setHistoryError(null);
    try {
      const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
      const [statusResult, historyResult] = await Promise.allSettled([
        invoke<GitStatusSummary>("git_status_summary", { rootPath }),
        invoke<GitCommitEntry[]>("git_commit_history", { limit: 50, rootPath }),
      ]);

      if (statusResult.status === "fulfilled") {
        const result = statusResult.value;
        setGitSummary(result);
        setGitError(null);
        setSelectedGitPath((previous) => {
          if (result.entries.length === 0) {
            return null;
          }
          if (
            previous &&
            result.entries.some((entry) => entry.path === previous)
          ) {
            return previous;
          }
          return result.entries[0].path;
        });
      } else {
        const reason = statusResult.reason;
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setGitError(message);
        setGitSummary(null);
        setSelectedGitPath(null);
      }

      if (historyResult.status === "fulfilled") {
        setCommitHistory(historyResult.value);
        setHistoryError(null);
      } else {
        const reason = historyResult.reason;
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setCommitHistory([]);
        setHistoryError(message);
      }
    } finally {
      setLoadingGit(false);
    }
  }, [activeTerminal, explorerPath, tauriAvailable]);

  useEffect(() => {
    if (showGitDrawer) {
      void refreshGitSummary();
    }
  }, [refreshGitSummary, showGitDrawer]);

  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    void refreshGitSummary();
  }, [refreshGitSummary, tauriAvailable]);

  const handleSelectGitEntry = useCallback((entry: GitStatusEntry) => {
    setSelectedGitPath(entry.path);
    if (entry.unstaged_status || entry.is_untracked) {
      setDiffView("worktree");
    } else if (entry.staged_status) {
      setDiffView("staged");
    }
  }, []);

  const handleOpenFileFromGit = useCallback(
    (relativePath: string) => {
      if (!explorerRoot) {
        return;
      }

      // Convert relative path to absolute path
      const fullPath = `${explorerRoot}/${relativePath}`.replace(/\/+/g, "/");

      // Extract file name
      const fileName = relativePath.split("/").pop() || relativePath;

      // Create a fake DirectoryEntry to open the file
      const fakeEntry: DirectoryEntry = {
        name: fileName,
        path: fullPath,
        is_dir: false,
        is_symlink: false,
      };

      // Use the same logic as handleOpenFilePreview
      void handleOpenFilePreview(fakeEntry);
    },
    [explorerRoot, handleOpenFilePreview]
  );

  const handleStageEntry = useCallback(
    async (entry: GitStatusEntry) => {
      if (!tauriAvailable) {
        return;
      }
      setGitError(null);
      try {
        const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
        await invoke("git_stage", { path: entry.path, rootPath });
        await refreshGitSummary();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setGitError(message);
      }
    },
    [activeTerminal, explorerPath, refreshGitSummary, tauriAvailable]
  );

  const handleUnstageEntry = useCallback(
    async (entry: GitStatusEntry) => {
      if (!tauriAvailable) {
        return;
      }
      setGitError(null);
      try {
        const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
        await invoke("git_unstage", { path: entry.path, rootPath });
        await refreshGitSummary();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setGitError(message);
      }
    },
    [activeTerminal, explorerPath, refreshGitSummary, tauriAvailable]
  );

  const handleStageAll = useCallback(async () => {
    if (!tauriAvailable || !gitSummary) {
      return;
    }
    setGitError(null);
    try {
      const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;

      // Stage all unstaged files
      const unstagedFiles = gitSummary.entries.filter(
        (entry) => entry.unstaged_status || entry.is_untracked
      );

      for (const entry of unstagedFiles) {
        await invoke("git_stage", { path: entry.path, rootPath });
      }

      await refreshGitSummary();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitError(message);
    }
  }, [
    activeTerminal,
    explorerPath,
    gitSummary,
    refreshGitSummary,
    tauriAvailable,
  ]);

  const handleCommit = useCallback(async () => {
    if (!tauriAvailable || commitMessage.trim().length === 0) {
      return;
    }
    setCommitting(true);
    setGitError(null);
    try {
      const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
      await invoke("git_commit", { message: commitMessage, rootPath });
      setCommitMessage("");
      await refreshGitSummary();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitError(message);
    } finally {
      setCommitting(false);
    }
  }, [
    activeTerminal,
    commitMessage,
    explorerPath,
    refreshGitSummary,
    tauriAvailable,
  ]);

  const handleDiffViewChange = useCallback((view: "worktree" | "staged") => {
    setDiffView(view);
  }, []);

  useEffect(() => {
    const timers = idleTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!selectedGitEntry) {
      setDiffContent("");
      setDiffError(null);
      return;
    }
    if (diffView === "staged" && !selectedGitEntry.staged_status) {
      if (selectedGitEntry.unstaged_status || selectedGitEntry.is_untracked) {
        setDiffView("worktree");
      }
    } else if (
      diffView === "worktree" &&
      !(selectedGitEntry.unstaged_status || selectedGitEntry.is_untracked)
    ) {
      if (selectedGitEntry.staged_status) {
        setDiffView("staged");
      }
    }
  }, [diffView, selectedGitEntry]);

  useEffect(() => {
    if (!tauriAvailable || !showGitDrawer) {
      return;
    }
    if (!selectedGitEntry) {
      return;
    }
    const showStaged = diffView === "staged";
    if (showStaged && !selectedGitEntry.staged_status) {
      setDiffContent("No differences in staging.");
      setDiffError(null);
      return;
    }
    if (
      !showStaged &&
      !(selectedGitEntry.unstaged_status || selectedGitEntry.is_untracked)
    ) {
      setDiffContent("No differences in working tree.");
      setDiffError(null);
      return;
    }

    let cancelled = false;
    const fetchDiff = async () => {
      setDiffLoading(true);
      setDiffError(null);
      try {
        const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
        const diff = await invoke<string>("git_diff", {
          path: selectedGitEntry.path,
          staged: showStaged,
          untracked: selectedGitEntry.is_untracked,
          rootPath,
        });
        if (!cancelled) {
          setDiffContent(diff);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setDiffError(message);
          setDiffContent("");
        }
      } finally {
        if (!cancelled) {
          setDiffLoading(false);
        }
      }
    };

    void fetchDiff();

    return () => {
      cancelled = true;
    };
  }, [
    activeTerminal,
    diffView,
    explorerPath,
    selectedGitEntry,
    showGitDrawer,
    tauriAvailable,
  ]);

  if (!tauriAvailable) {
    return (
      <div className="app-fallback">
        <div className="fallback-card">
          <h1>Quack</h1>
          <p>
            This interface requires Tauri desktop environment to manage
            terminals and the file explorer.
          </p>
          <p>
            Launch the app with:
            <code>npm run tauri:dev</code>
          </p>
          <p>
            Close the browser tab and use the desktop window launched by the
            command.
          </p>
        </div>
      </div>
    );
  }

  // If we're in the preview-webview, don't render anything
  // The preview window should only show the external URL content
  if (isPreviewWebview) {
    return null;
  }

  if (booting) {
    return (
      <div className="app-loader">
        <div className="app-loader-card">
          <img
            src={splashImage}
            alt="Logo Quack"
            className="app-loader-image"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={appShellRef}
      className="app-shell"
      style={{ gridTemplateColumns }}
    >
        <TerminalSidebar
          terminals={terminals}
          activeId={activeId}
          creating={creatingTerminal}
          collapsedGroups={collapsedGroups}
          onAdd={handleOpenNewTerminalModal}
          onSelect={handleSelectTerminal}
          onClose={handleCloseTerminal}
          onColorChange={handleColorChange}
          onEdit={handleEditTerminal}
          onToggleGroup={handleToggleGroup}
          onReorder={handleReorderTerminals}
          onToggleProcesses={() =>
            setShowProcessesDrawer((value) => !value)
          }
          processesOpen={showProcessesDrawer}
        />

        <section className="terminal-pane">
          <div className="main-toolbar">
            <div className="main-toolbar-top">
              <div className="main-toolbar-title">
                <h1>
                  {activeTerminal?.label ?? "Terminal"}
                  {import.meta.env.DEV && (
                    <span className="dev-badge">DEV</span>
                  )}
                </h1>
              </div>
              <div className="main-toolbar-right">
                <div
                  className="git-branch-indicator"
                  title={
                    gitSummary?.branch
                      ? `Current branch: ${gitSummary.branch}`
                      : "Current branch unavailable"
                  }
                >
                  <span
                    className="git-branch-indicator-dot"
                    aria-hidden="true"
                  />
                  <span className="git-branch-indicator-name">
                    {gitSummary?.branch ?? "—"}
                  </span>
                </div>
                <button
                  type="button"
                  className={`git-tab-button ${showGitDrawer ? "active" : ""}`}
                  onClick={() => setShowGitDrawer(!showGitDrawer)}
                >
                  Git
                </button>
              <button
                type="button"
                className="git-tab-button"
                onClick={handleOpenPreviewDrawer}
              >
                Preview
              </button>
              </div>
            </div>
            <div className="main-toolbar-bottom">
              <span className="terminal-status">
                {activeTerminal ? activeTerminal.cwd : "No active terminal"}
              </span>
            </div>
          </div>
          <div className="terminal-container">
            {activeId ? (
              <TerminalView
                activeId={activeId}
                terminals={terminals}
                onUserInput={handleTerminalInput}
                onOutput={handleTerminalOutput}
              />
            ) : (
              <div className="terminal-surface terminal-placeholder">
                Create a new terminal to start working.
              </div>
            )}
          </div>
          <ToolBar
            onExecuteCommand={handleExecuteAICommand}
            onToggleSavedCommands={() =>
              setSavedCommandsDrawerOpen((value) => !value)
            }
            savedCommandsOpen={savedCommandsDrawerOpen}
            onToggleAISettings={() => setShowAISettings((value) => !value)}
          />
        </section>

        <FileExplorer
          rootPath={(explorerRoot ?? explorerPath) || null}
          tree={explorerTree}
          loading={loadingExplorer}
          error={explorerError}
          activePath={explorerPath}
          activeFilePath={previewFile?.path ?? null}
          onOpenFile={handleOpenFilePreview}
          onLoadChildren={fetchDirectoryChildren}
          modifiedEntries={gitSummary?.entries ?? null}
          gitRootPath={explorerRoot}
        />

        <NewTerminalModal
          open={showNewTerminalModal}
          isEditing={editingTerminal !== null}
          name={newTerminalName}
          path={newTerminalPath}
          color={newTerminalColor}
          availableColors={COLORS}
          selectingDirectory={selectingDirectory}
          creating={creatingTerminal}
          error={newTerminalError}
          onNameChange={setNewTerminalName}
          onColorChange={setNewTerminalColor}
          onBrowse={handleSelectDirectory}
          onCancel={handleCancelNewTerminal}
          onConfirm={handleConfirmNewTerminal}
        />

        <FilePreviewDrawer
          open={previewFile !== null}
          filename={previewFile?.name ?? null}
          path={previewFile?.path ?? null}
          content={previewContent}
          loading={loadingPreview}
          error={previewError}
          formatting={formattingPreview}
          diffInfo={previewDiffInfo}
          onClose={handleClosePreview}
          onRefresh={handleRefreshPreview}
          onFormat={handleFormatPreview}
          onSave={handleSaveFile}
        />

        <SavedCommandsDrawer
          open={savedCommandsDrawerOpen}
          commands={savedCommands}
          onLaunch={(command, immediate) =>
            handleLaunchSavedCommand(
              command,
              immediate ? { launchImmediately: true } : undefined
            )
          }
          onEdit={(command) => {
            setEditingCommand(command);
            setSavedCommandModalOpen(true);
          }}
          onCreate={() => {
            setEditingCommand(null);
            setSavedCommandModalOpen(true);
          }}
          onDelete={async (command) => {
            await invoke("delete_command", { id: command.id });
            setSavedCommands((prev) =>
              prev.filter((item) => item.id !== command.id)
            );
          }}
          onClose={() => setSavedCommandsDrawerOpen(false)}
        />

        <ProcessesDrawer
          open={showProcessesDrawer}
          processes={activeProcesses}
          onClose={() => setShowProcessesDrawer(false)}
          onRefresh={loadActiveProcesses}
          onFocusTerminal={handleSelectTerminal}
        />

      <PreviewDrawer
        open={showPreviewDrawer}
        onClose={() => setShowPreviewDrawer(false)}
        width={previewDrawerWidth}
        minWidth={420}
        maxWidth={1200}
        onResize={(width) => {
          setPreviewDrawerWidth(width);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("previewDrawer.width", String(Math.round(width)));
          }
        }}
        explorerPath={explorerPath}
        processes={activeProcesses}
      />

        <div className={`git-drawer ${showGitDrawer ? "open" : ""}`}>
          <div
            className="git-drawer-backdrop"
            onClick={() => setShowGitDrawer(false)}
          />
          <div className="git-drawer-panel">
            <header className="git-drawer-header">
              <h2>Git</h2>
              <button
                type="button"
                className="git-drawer-close"
                onClick={() => setShowGitDrawer(false)}
              >
                ✕
              </button>
            </header>
            <GitPanel
              summary={gitSummary}
              loading={loadingGit}
              error={gitError}
              history={commitHistory}
              historyLoading={loadingGit}
              historyError={historyError}
              selected={selectedGitEntry}
              diffContent={diffContent}
              diffLoading={diffLoading}
              diffError={diffError}
              diffView={diffView}
              onDiffViewChange={handleDiffViewChange}
              onRefresh={refreshGitSummary}
              onSelect={handleSelectGitEntry}
              onStage={handleStageEntry}
              onUnstage={handleUnstageEntry}
              onStageAll={handleStageAll}
              onOpenFile={handleOpenFileFromGit}
              commitMessage={commitMessage}
              onCommitMessageChange={setCommitMessage}
              onCommit={handleCommit}
              committing={committing}
            />
          </div>
        </div>

        <SavedCommandModal
          open={savedCommandModalOpen}
          command={editingCommand}
          onClose={() => {
            setSavedCommandModalOpen(false);
            setEditingCommand(null);
          }}
          onSaved={(command) => {
            setSavedCommands((prev) => {
              const index = prev.findIndex((c) => c.id === command.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = command;
                return updated;
              }
              return [...prev, command];
            });
            setSavedCommandModalOpen(false);
            setEditingCommand(null);
          }}
        />

        {showAISettings && (
          <AISettingsPanel onClose={() => setShowAISettings(false)} />
        )}
    </div>
  );
}

export default App;
