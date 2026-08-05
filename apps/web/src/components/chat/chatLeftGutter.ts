// FILE: chatLeftGutter.ts
// Purpose: Shared threshold for left-gutter chat chrome (message trail ticks +
//          stream-chat papero avatars). Both hide when the transcript pane is too
//          narrow to leave a clear margin beside the centered max-w column.
// Layer: Chat transcript presentation constants

/** Pane must be at least this wide before left-gutter chrome shows. */
export const CHAT_LEFT_GUTTER_MIN_PANE_WIDTH_PX = 864;

/**
 * Named container for the transcript pane. Pair with
 * `CHAT_STREAM_AVATAR_VISIBLE_CLASS_NAME` so avatars appear only when the pane
 * clears `CHAT_LEFT_GUTTER_MIN_PANE_WIDTH_PX` (same bar as MessageTrail).
 */
export const CHAT_PANE_CONTAINER_CLASS_NAME = "@container/chat-pane";

/**
 * Tailwind visibility for stream-chat avatars sitting beside the turn.
 * Keep the `864px` literal in sync with `CHAT_LEFT_GUTTER_MIN_PANE_WIDTH_PX`.
 */
export const CHAT_STREAM_AVATAR_VISIBLE_CLASS_NAME = "@[864px]/chat-pane:block";

/** Gap between the in-flow stream avatar and the turn body when the gutter is open. */
export const CHAT_STREAM_AVATAR_GAP_CLASS_NAME = "@[864px]/chat-pane:gap-3";
