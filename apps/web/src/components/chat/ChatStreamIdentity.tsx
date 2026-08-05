// FILE: ChatStreamIdentity.tsx
// Purpose: Avatar slot + identity line for whoever owns a transcript turn — a papero
//          in a normal thread, the subagent itself inside a subagent thread.
// Layer: Chat transcript presentation
// Exports: RoundAvatarImage, ChatStreamAvatarSlot, ChatStreamMetaRow
// Why: One place for the stream identity so the assistant row, the live Thinking row
//      and both thread kinds look identical.

import type { ModelSelection } from "@synara/contracts";
import { useState } from "react";

import { useContainerSize } from "~/lib/pdf/useContainerSize";
import { resolveThreadModelSummary } from "~/lib/threadModelSummary";
import { cn } from "~/lib/utils";
import { CHAT_STREAM_AVATAR_VISIBLE_CLASS_NAME } from "./chatLeftGutter";

/** Below this turn height the avatar stays put instead of sticking. */
const STICKY_MIN_TURN_HEIGHT_PX = 240;

export function RoundAvatarImage({
  src,
  className,
  enlargeOnHover = false,
}: {
  readonly src: string;
  readonly className?: string | undefined;
  /** Stream-chat peek: modest scale-up on hover without shifting layout. */
  readonly enlargeOnHover?: boolean;
}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={cn(
        "size-3.5 rounded-full object-cover",
        enlargeOnHover &&
          // Keep the peek modest (1.25×) and ease it — a large scale + hard z jump
          // reads as choppy and gets clipped by the transcript's overflow-x-hidden.
          "z-10 origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:z-30 hover:scale-125 motion-reduce:transition-none motion-reduce:hover:scale-100",
        className,
      )}
    />
  );
}

/**
 * Fixed left-gutter slot for the agent that owns a transcript turn. Shared by the
 * assistant row and the live Thinking row so both sit in the same column and appear
 * or hide at the same pane width.
 */
export function ChatStreamAvatarSlot({ src }: { readonly src: string }) {
  const [slot, setSlot] = useState<HTMLSpanElement | null>(null);
  const size = useContainerSize(slot);
  // Short turns fit on screen whole: sticking would only slide the avatar a few
  // pixels away from its name for no gain, so keep it pinned to the turn.
  const sticky = (size?.height ?? 0) > STICKY_MIN_TURN_HEIGHT_PX;
  return (
    <span
      ref={setSlot}
      className={cn(
        // Fixed slot so the circle can't be cropped by sibling row paint;
        // visibility follows the shared left-gutter pane width. `self-stretch` gives
        // the sticky child a full-turn track to travel along.
        // pb-7 keeps the sticky travel from running into the turn footer
        // (copy/meta row, always present in layout) — the avatar stops with the
        // last line of the reply instead of drifting into empty space.
        "hidden w-7 shrink-0 self-stretch overflow-visible pb-7",
        CHAT_STREAM_AVATAR_VISIBLE_CLASS_NAME,
      )}
    >
      {/* Sticks to the top of the transcript viewport while its own turn is on screen,
          then scrolls away with the turn. `top-3` matches the list's py-3 inset. */}
      <span className={cn("mt-0.5 block size-7", sticky && "sticky top-3")}>
        <RoundAvatarImage src={src} enlargeOnHover className="size-7" />
      </span>
    </span>
  );
}

/**
 * Turn identity line next to the stream avatar: agent, then the model and effort the
 * turn actually ran with (stamped on the message, not the live thread selection).
 */
export function ChatStreamMetaRow({
  label,
  modelSelection,
}: {
  readonly label: string;
  readonly modelSelection?: ModelSelection | undefined;
}) {
  const summary = resolveThreadModelSummary(modelSelection);
  const parts = [label, summary?.modelLabel, summary?.statusLabel].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return (
    <div className="flex min-w-0 items-center gap-1.5 pb-0.5 font-system-ui text-[11px] text-muted-foreground/70">
      {parts.map((part, index) => (
        <span key={part} className="flex min-w-0 items-center gap-1.5">
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <span className="truncate">{part}</span>
        </span>
      ))}
    </div>
  );
}
