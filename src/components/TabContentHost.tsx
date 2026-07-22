import { createPortal } from "react-dom";
import { EditorPane } from "./lazyHeavy";
import { MediaPreviewPane } from "./MediaPreviewPane";
import { SessionTranscriptPane } from "./SessionTranscriptPane";
import { SubagentTranscriptView } from "./SubagentTranscriptView";
import { ComposeReviewPane } from "./ComposeReviewPane";
import { HtmlPreviewPane } from "./HtmlPreviewPane";
import { PlanPane } from "./PlanPane";
import { StoryPlanPane } from "./StoryPlanPane";
import { WhiteboardPane } from "./WhiteboardPane";
import { WorksPane } from "./works/WorksPane";
import { UsagePanel } from "./UsagePanel";
import { BrainPanel } from "./BrainPanel";
import { QuackStorePanel } from "./QuackStorePanel";
import { AIChatPanel } from "./AIChatPanel";
import { mediaKindOf } from "../mediaPreview";
import { isMarkdownPath } from "../editorMdView";
import { parseKey, type WorkspaceData } from "../store";
import { useChatSwitching } from "../useChatSwitching";
import { useCallback, useEffect, useState } from "react";
import { endChatSwitch } from "../chatSwitch";
import {
  shouldKeepChatHostMounted,
  useChatHostLiveStatus,
} from "../chatHostMount";
import { dropCachedSessionBody } from "../chatStoreCache";

interface Props {
  wsId: string;
  ws: WorkspaceData;
  tabKey: string;
  container: HTMLElement | null;
  visible: boolean;
  showHeavy: boolean;
  editorsReady: boolean;
}

/** Portal one editor tab's content into an arbitrary host (pane or drawer). */
export function TabContentHost({
  wsId,
  ws,
  tabKey,
  container,
  visible,
  showHeavy,
  editorsReady,
}: Props) {
  if (!container || !visible) return null;
  const parsed = parseKey(tabKey);
  if (!parsed) return null;

  if (parsed.kind === "file") {
    if (!showHeavy) return null;
    const path = parsed.path;
    const media = mediaKindOf(path);
    if (media === "session-transcript") {
      return createPortal(
        <SessionTranscriptPane tabKey={tabKey} />,
        container,
        tabKey,
      );
    }
    const canRender = media !== null || ws.files[path];
    if (!canRender) return null;
    // Drawer hosts may mount before `editorsReady`; markdown preview and
    // media panes do not need Monaco. Defer only the Monaco editor path.
    const needsMonaco = !media && !editorsReady;
    if (needsMonaco && !isMarkdownPath(path)) return null;
    return createPortal(
      media ? (
        <MediaPreviewPane wsId={wsId} path={path} kind={media} />
      ) : (
        <EditorPane wsId={wsId} path={path} />
      ),
      container,
      tabKey,
    );
  }

  if (parsed.kind === "ai") {
    const chat = ws.aiChats[parsed.id];
    return (
      <DrawerAIChatHost
        wsId={wsId}
        root={ws.meta.root}
        chatId={parsed.id}
        container={container}
        visible={visible}
        doneAt={chat?.doneAt}
        archivedAt={chat?.archivedAt}
      />
    );
  }

  if (!showHeavy) return null;

  if (parsed.kind === "subagent") {
    return (
      <SubagentTranscriptView
        root={ws.meta.root}
        sessionId={parsed.sessionId}
        toolUseId={parsed.toolUseId}
        agentType={parsed.agentType}
        container={container}
        visible={visible}
      />
    );
  }
  if (parsed.kind === "composeReview") {
    return createPortal(
      <ComposeReviewPane wsId={wsId} tabKey={tabKey} visible={visible} />,
      container,
      tabKey,
    );
  }
  if (parsed.kind === "htmlPreview") {
    return createPortal(<HtmlPreviewPane tabKey={tabKey} />, container, tabKey);
  }
  if (parsed.kind === "plan") {
    return createPortal(<PlanPane tabKey={tabKey} />, container, tabKey);
  }
  if (parsed.kind === "storyPlan") {
    return createPortal(<StoryPlanPane tabKey={tabKey} />, container, tabKey);
  }
  if (parsed.kind === "whiteboard") {
    return (
      <WhiteboardPane
        wsId={wsId}
        root={ws.meta.root}
        container={container}
        visible={visible}
      />
    );
  }
  if (parsed.kind === "works") {
    return (
      <WorksPane
        wsId={wsId}
        root={ws.meta.root}
        container={container}
        visible={visible}
      />
    );
  }
  if (parsed.kind === "session") {
    return createPortal(
      <SessionTranscriptPane tabKey={tabKey} />,
      container,
      tabKey,
    );
  }
  if (parsed.kind === "usage") {
    return createPortal(
      <UsagePanel wsId={wsId} root={ws.meta.root} />,
      container,
      tabKey,
    );
  }
  if (parsed.kind === "brain") {
    return createPortal(
      <BrainPanel wsId={wsId} root={ws.meta.root} />,
      container,
      tabKey,
    );
  }
  if (parsed.kind === "store") {
    return createPortal(
      <QuackStorePanel wsId={wsId} root={ws.meta.root} />,
      container,
      tabKey,
    );
  }
  return null;
}

function DrawerAIChatHost({
  wsId,
  root,
  chatId,
  container,
  visible,
  doneAt,
  archivedAt,
}: {
  wsId: string;
  root: string;
  chatId: string;
  container: HTMLElement;
  visible: boolean;
  doneAt?: number;
  archivedAt?: number;
}) {
  const switching = useChatSwitching();
  const liveStatus = useChatHostLiveStatus(chatId);
  const keepWarm = shouldKeepChatHostMounted({
    visible,
    doneAt,
    archivedAt,
    liveStatus,
    tabOpen: true,
  });
  const [mounted, setMounted] = useState(visible || keepWarm);
  const onHydrated = useCallback(
    () => endChatSwitch(`DrawerAIChatHost:${chatId}`, chatId),
    [chatId],
  );
  useEffect(() => {
    if (visible || keepWarm) {
      setMounted(true);
      return;
    }
    setMounted(false);
  }, [visible, keepWarm]);
  useEffect(() => {
    if (mounted || keepWarm) return;
    dropCachedSessionBody(wsId, chatId);
  }, [mounted, keepWarm, wsId, chatId]);
  if (!mounted) return null;
  const showSurface = visible;
  const showVeil = switching && visible;
  return createPortal(
    <div
      className={`ai-tab-host${showSurface ? " is-visible" : ""}${showVeil ? " is-switching" : ""}`}
    >
      <AIChatPanel
        wsId={wsId}
        root={root}
        aiChatId={chatId}
        chatVisible={visible}
        onHydrated={onHydrated}
      />
    </div>,
    container,
  );
}
