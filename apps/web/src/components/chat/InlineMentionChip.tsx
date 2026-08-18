// FILE: InlineMentionChip.tsx
// Purpose: Shared inline file/folder/plugin mention chip (icon + label) used by
//          the timeline user-message echo, the assistant markdown view, and
//          openable file links, so a referenced path reads identically to a
//          composer mention. Supports a static (span) and an interactive
//          (anchor) variant so the same UI can stay clickable. File-like chips
//          without an explicit handler become openable automatically when a
//          surface provides a workspace file opener (right-dock file pane).
// Layer: UI shared component
// Exports: InlineMentionChip

import { type MouseEvent, type ReactNode } from "react";
import type { ProviderMentionReference } from "@synara/contracts";
import { identifierFromLinearMentionPath } from "@synara/shared/linearMentions";
import { basenameOfPath, pathLooksLikeKnownFile } from "~/file-icons";
import {
  findLinearProviderMentionReferenceForToken,
  resolveMentionChipKind,
} from "~/lib/composerMentions";
import { showFileReferenceContextMenu } from "~/lib/fileReferenceContextMenu";
import { resolveLinearIssueUrl } from "~/lib/linearIssueUrls";
import { openWorkspaceFileReference, useWorkspaceFileOpener } from "~/lib/workspaceFileOpener";
import { readNativeApi } from "~/nativeApi";
import {
  COMPOSER_INLINE_MENTION_CHIP_CLASS_NAME,
  COMPOSER_INLINE_MENTION_CHIP_INTERACTIVE_CLASS_NAME,
} from "../composerInlineChip";
import { InlineChipContent } from "../InlineChip";
import { MentionChipIcon, type MentionChipKind } from "./MentionChipIcon";

interface InlineMentionChipProps {
  path: string;
  theme: "light" | "dark";
  kind?: MentionChipKind;
  mentionReferences?: ReadonlyArray<ProviderMentionReference>;
  /** Defaults to the path basename (composer-style label). */
  label?: ReactNode;
  /** When set, the chip renders as an openable anchor instead of a static span. */
  href?: string;
  onActivate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Warm-up hook fired on hover/focus so activating the chip feels instant. */
  onHoverPrefetch?: (() => void) | undefined;
}

function isFilePathChip(kind: MentionChipKind): boolean {
  return kind === "path";
}

export function InlineMentionChip(props: InlineMentionChipProps) {
  const opener = useWorkspaceFileOpener();
  const resolvedKind = resolveMentionChipKind(props.path, {
    ...(props.kind ? { kind: props.kind } : {}),
    ...(props.mentionReferences ? { mentionReferences: props.mentionReferences } : {}),
  });
  const linearMention = findLinearProviderMentionReferenceForToken(
    props.path,
    props.mentionReferences,
  );
  const linearIdentifier =
    identifierFromLinearMentionPath(props.path) ??
    (linearMention ? identifierFromLinearMentionPath(linearMention.path) : null);
  const linearHref =
    props.href ?? (linearIdentifier ? resolveLinearIssueUrl(linearIdentifier) : undefined);
  const label =
    props.label ??
    (resolvedKind === "linear"
      ? (linearMention?.name ?? linearIdentifier ?? props.path)
      : resolvedKind === "thread"
        ? props.path
        : basenameOfPath(props.path));
  const showFileContextMenu = isFilePathChip(resolvedKind);
  const handleFileContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!showFileContextMenu || !readNativeApi()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void showFileReferenceContextMenu({
      path: props.path,
      position: { x: event.clientX, y: event.clientY },
      workspaceRoot: opener?.workspaceRoot,
      onReferenceInChat: opener?.onReferenceInChat,
    });
  };
  const inner = (
    <InlineChipContent
      icon={
        <MentionChipIcon
          path={props.path}
          theme={props.theme}
          {...(props.kind ? { kind: props.kind } : {})}
          {...(props.mentionReferences ? { mentionReferences: props.mentionReferences } : {})}
        />
      }
      label={label}
    />
  );

  // A plain file chip (no explicit href/handler) still opens in the in-app
  // viewer when the hosting surface provides one, so every file reference in
  // the chat stays clickable. Plugin chips and non-file paths stay static.
  const contextOpenable =
    props.href === undefined &&
    props.onActivate === undefined &&
    opener !== null &&
    (props.kind === undefined || props.kind === "path") &&
    resolvedKind !== "linear" &&
    pathLooksLikeKnownFile(props.path);

  if (props.href !== undefined || props.onActivate || contextOpenable || linearHref !== undefined) {
    const href = props.href ?? linearHref ?? (contextOpenable ? props.path : undefined);
    const handleActivate =
      props.onActivate ??
      (contextOpenable
        ? (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            event.stopPropagation();
            openWorkspaceFileReference(opener, props.path);
          }
        : undefined);
    const handleHoverPrefetch =
      props.onHoverPrefetch ??
      (contextOpenable && opener?.prefetchFile
        ? () => opener.prefetchFile?.(props.path)
        : undefined);
    return (
      <a
        className={COMPOSER_INLINE_MENTION_CHIP_INTERACTIVE_CLASS_NAME}
        title={props.path}
        {...(href !== undefined ? { href } : {})}
        {...(linearHref !== undefined && props.href === undefined && props.onActivate === undefined
          ? { target: "_blank", rel: "noreferrer" }
          : {})}
        {...(handleActivate ? { onClick: handleActivate } : {})}
        {...(handleHoverPrefetch
          ? { onPointerEnter: handleHoverPrefetch, onFocus: handleHoverPrefetch }
          : {})}
        {...(showFileContextMenu ? { onContextMenu: handleFileContextMenu } : {})}
      >
        {inner}
      </a>
    );
  }

  return (
    <span
      className={COMPOSER_INLINE_MENTION_CHIP_CLASS_NAME}
      title={props.path}
      {...(showFileContextMenu ? { onContextMenu: handleFileContextMenu } : {})}
    >
      {inner}
    </span>
  );
}
