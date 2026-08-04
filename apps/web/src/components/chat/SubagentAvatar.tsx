// FILE: SubagentAvatar.tsx
// Purpose: Duck avatar for a subagent row, keyed on the subagent's stable name so
// the same subagent always shows the same duck (mirrors PaperoAvatar).
// Layer: Chat presentation
// Exports: SubagentAvatar

import { duckAvatarFor } from "~/lib/duckAvatars";
import { cn } from "~/lib/utils";

export function SubagentAvatar({
  seed,
  className,
}: {
  // Most stable identity available on the surface (nickname > role > description).
  readonly seed: string;
  readonly className?: string;
}) {
  return (
    <img
      src={duckAvatarFor(seed)}
      alt=""
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 rounded-full object-cover", className)}
    />
  );
}
