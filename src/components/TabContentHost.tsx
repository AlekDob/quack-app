import { createPortal } from "react-dom";
import { EditorPane } from "./EditorPane";
import { MediaPreviewPane } from "./MediaPreviewPane";
import { SessionTranscriptPane } from "./SessionTranscriptPane";
import { SubagentTranscriptView } from "./SubagentTranscriptView";
import { ComposeReviewPane } from "./ComposeReviewPane";
import { HtmlPreviewPane } from "./HtmlPreviewPane";
import { PlanPane } from "./PlanPane";
import { WhiteboardPane } from "./WhiteboardPane";
import { WorksPane } from "./works/WorksPane";
import { UsagePanel } from "./UsagePanel";
import { BrainPanel } from "./BrainPanel";
import { QuackStorePanel } from "./QuackStorePanel";
import { AIChatPanel } from "./AIChatPanel";
import { ChatSwitchVeil } from "./ChatSwitchVeil";
import { mediaKindOf } from "../mediaPreview";
import { parseKey, type WorkspaceData } from "../store";
import { useChatSwitching } from "../useChatSwitching";
import { useCallback, useEffect, useState } from "react";
import { endChatSwitch } from "../chatSwitch";

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
    if (!showHeavy || !editorsReady) return null;
    const path = parsed.path;
    const media = mediaKindOf(path);
    if (media === "session-transcript") {
      return createPortal(
        <SessionTranscriptPane tabKey={tabKey} />,
        container,
        tabKey,
      );
    }
    if (media !== null || ws.files[path]) {
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
    return null;
  }

  if (parsed.kind === "ai") {
    return (
      <DrawerAIChatHost
        wsId={wsId}
        root={ws.meta.root}
        chatId={parsed.id}
        container={container}
        visible={visible}
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
}: {
  wsId: string;
  root: string;
  chatId: string;
  container: HTMLElement;
  visible: boolean;
}) {
  const switching = useChatSwitching();
  const [mounted, setMounted] = useState(visible);
  const onHydrated = useCallback(() => endChatSwitch(), []);
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);
  if (!mounted) return null;
  const showVeil = switching && visible;
  return createPortal(
    <div
      className={`ai-tab-host${visible ? " is-visible" : ""}${showVeil ? " is-switching" : ""}`}
    >
      <AIChatPanel
        wsId={wsId}
        root={root}
        aiChatId={chatId}
        chatVisible={visible}
        onHydrated={onHydrated}
      />
      {showVeil && <ChatSwitchVeil />}
    </div>,
    container,
  );
}
