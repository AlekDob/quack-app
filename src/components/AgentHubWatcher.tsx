// Headless singleton (mounted once at app root) that derives the live
// status of EVERY open AI chat across ALL workspaces and writes it to
// agentStatusStore — the data the cross-project Agent Hub renders. It is
// the single producer of that state, on purpose: the chats' AIChatPanels
// aren't all mounted (mount-asymmetry gotcha), so a panel-based publisher
// could never cover background chats. Instead this watches app-wide
// signals that don't need a mounted panel:
//   - the backend's active-session list (poll) → "working" / "ready"
//   - the global claude:permission-request event → "needs-input"
//
// Notifications fire here too, on the working→ready and →needs-input edges.

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { claudeCode } from "../ipc";
import { activeAiChatId, useStore, type AIChatDescriptor } from "../store";
import type { WorkspaceMeta } from "../ipc";
import { loadSessions } from "../chatHistory";
import {
  clearAgentStatus,
  getAgentStatus,
  getAllAgentStatus,
  isSeen,
  markSeen,
  publishAgentStatus,
} from "../agentStatusStore";
import { notifyAgentEvent } from "../notifications";
import { emitDockSummary } from "../dockSummary";

const POLL_MS = 1500;
// A real permission prompt waits on the user; an auto-allowed tool (Read,
// always-allow rule, AskUserQuestion redirect) resolves within ms. Hold
// "needs-input" back this long so auto-allowed tools never flash it.
const PERM_GRACE_MS = 600;
// Safety valve: a permission that's been "waiting" this long while the
// process keeps running is almost certainly resolved (we missed the
// settle event) — let the poll move it back to working.
const NEEDS_INPUT_TTL = 90_000;

interface PermissionRequest {
  request_id: string;
  tool_name: string;
  cwd?: string | null;
  session_id?: string | null;
}

interface PendingEntry {
  chatId: string;
  wsId: string;
  kind: "permission" | "question";
  timer?: number;
}

// Trailing-slash-insensitive directory compare.
function sameDir(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[/\\]+$/, "");
  return norm(a) === norm(b);
}

/** Map a permission event (cwd + Claude session id) to a chat. Prefers a
 *  claudeSessionId match within the matching workspace; falls back to that
 *  workspace's active/most-recent chat. */
function resolveChat(
  cwd: string | null | undefined,
  sessionId: string | null | undefined,
): { wsId: string; chatId: string } | null {
  const loaded = useStore.getState().loaded;
  const wsMatch = Object.entries(loaded).find(
    ([, w]) => cwd && sameDir(w.meta.root, cwd),
  );
  if (sessionId && wsMatch) {
    const [wsId, w] = wsMatch;
    const cs = loadSessions(wsId).find((s) => s.claudeSessionId === sessionId);
    const desc = cs
      ? Object.values(w.aiChats).find((d) => d.sessionId === cs.id)
      : undefined;
    if (desc) return { wsId, chatId: desc.id };
  }
  if (wsMatch) {
    const [wsId, w] = wsMatch;
    const active = activeAiChatId(w);
    if (active && w.aiChats[active]) return { wsId, chatId: active };
    const recent = Object.values(w.aiChats).sort(
      (a, b) => b.createdAt - a.createdAt,
    )[0];
    if (recent) return { wsId, chatId: recent.id };
  }
  return null;
}

function chatFocusedNow(chatId: string): boolean {
  if (!document.hasFocus()) return false;
  const { loaded, activeId } = useStore.getState();
  const ws = activeId ? loaded[activeId] : null;
  return !!ws && activeAiChatId(ws) === chatId;
}

export function AgentHubWatcher() {
  useEffect(() => {
    let stopped = false;
    const pending = new Map<string, PendingEntry>();

    const showNeedsInput = (e: PendingEntry, wsName: string, title: string) => {
      publishAgentStatus(e.chatId, {
        chatId: e.chatId,
        wsId: e.wsId,
        derived: "needs-input",
        needsInputKind: e.kind,
        lastTransitionAt: Date.now(),
      });
      if (!chatFocusedNow(e.chatId)) {
        void notifyAgentEvent({
          chatId: e.chatId,
          kind: "needs-input",
          needsInputKind: e.kind,
          wsName,
          chatTitle: title,
          isFocusedHere: false,
        });
      }
      emitDockSummary();
    };

    const reconcile = (
      chat: AIChatDescriptor,
      meta: WorkspaceMeta,
      active: Set<string>,
      focusedChatId: string | null,
    ) => {
      const prev = getAgentStatus(chat.id);
      const now = Date.now();
      if (active.has(chat.sessionId)) {
        const waiting =
          prev?.derived === "needs-input" &&
          !isSeen(chat.id) &&
          now - prev.lastTransitionAt < NEEDS_INPUT_TTL;
        if (waiting) return;
        if (prev?.derived !== "working") {
          publishAgentStatus(chat.id, {
            chatId: chat.id,
            wsId: meta.id,
            derived: "working",
            lastTransitionAt: now,
          });
        }
        return;
      }
      if (prev?.derived === "working") {
        // Always publish ready (including the focused chat). Clearing to
        // null made the hub depend on a separate recompute path and felt
        // like status only updated after switching away.
        publishAgentStatus(chat.id, {
          chatId: chat.id,
          wsId: meta.id,
          derived: "ready",
          lastTransitionAt: now,
        });
        if (focusedChatId !== chat.id) {
          void notifyAgentEvent({
            chatId: chat.id,
            kind: "ready",
            wsName: meta.name,
            chatTitle: chat.title,
            isFocusedHere: false,
          });
        }
      }
    };

    const recompute = async () => {
      let active: Set<string>;
      try {
        active = new Set(await claudeCode.activeSessions());
      } catch {
        return; // backend not ready / non-Tauri — try again next tick
      }
      if (stopped) return;
      const { loaded, activeId } = useStore.getState();
      const focusedChatId =
        document.hasFocus() && activeId
          ? activeAiChatId(loaded[activeId])
          : null;
      if (focusedChatId) markSeen(focusedChatId);

      const liveIds = new Set<string>();
      for (const ws of Object.values(loaded)) {
        for (const chat of Object.values(ws.aiChats)) {
          liveIds.add(chat.id);
          reconcile(chat, ws.meta, active, focusedChatId);
        }
      }
      for (const id of [...getAllAgentStatus().keys()]) {
        if (!liveIds.has(id)) clearAgentStatus(id);
      }
      emitDockSummary(); // keep the floating Dock + app-icon badge in sync
    };

    const onRequest = (req: PermissionRequest) => {
      const resolved = resolveChat(req.cwd, req.session_id);
      if (!resolved) return;
      const { chatId, wsId } = resolved;
      const ws = useStore.getState().loaded[wsId];
      const title = ws?.aiChats[chatId]?.title ?? "Chat";
      const wsName = ws?.meta.name ?? "Workspace";
      // Questions go through the SAME grace timer as permissions: an
      // AskUserQuestion under -p can't render headless, so the overlay
      // auto-redirects it (deny "ask in plain text") within ms. Firing
      // needs-input immediately flashed a purple dot + quack for that
      // redirect even though nothing was ever pending. The grace lets the
      // settle land first, so only a question still open past PERM_GRACE_MS
      // surfaces attention.
      const kind: "permission" | "question" = req.tool_name === "AskUserQuestion"
        ? "question"
        : "permission";
      const entry: PendingEntry = { chatId, wsId, kind };
      entry.timer = window.setTimeout(
        () => showNeedsInput(entry, wsName, title),
        PERM_GRACE_MS,
      );
      pending.set(req.request_id, entry);
    };

    const onSettled = (requestId: string) => {
      const entry = pending.get(requestId);
      if (!entry) return;
      pending.delete(requestId);
      // Cancel the grace timer for both kinds: if the request settled
      // before PERM_GRACE_MS (e.g. the AskUserQuestion redirect), it never
      // flashes needs-input at all.
      if (entry.timer) window.clearTimeout(entry.timer);
      if (entry.kind === "question") return; // once shown, clears on focus, not settle
      if (getAgentStatus(entry.chatId)?.derived === "needs-input") {
        publishAgentStatus(entry.chatId, null); // poll re-derives working/idle
      }
      emitDockSummary();
    };

    const interval = window.setInterval(() => void recompute(), POLL_MS);
    void recompute();
    const offReq = listen<PermissionRequest>("claude:permission-request", (e) =>
      onRequest(e.payload),
    );
    const offResolved = listen<string>("claude:permission-resolved", (e) =>
      onSettled(e.payload),
    );
    const offCancelled = listen<string>("claude:permission-cancelled", (e) =>
      onSettled(e.payload),
    );

    return () => {
      stopped = true;
      window.clearInterval(interval);
      for (const e of pending.values())
        if (e.timer) window.clearTimeout(e.timer);
      void offReq.then((f) => f());
      void offResolved.then((f) => f());
      void offCancelled.then((f) => f());
    };
  }, []);

  return null;
}
