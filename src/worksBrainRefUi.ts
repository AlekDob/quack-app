import type { IconName } from "./components/Icon";
import type { BrainRef, BrainRefRole } from "./worksBrainRefs";

export type BrainRefVisualKind = "module" | "story" | "doc";

export function brainRefVisualKind(ref: BrainRef): BrainRefVisualKind {
  if (ref.role === "story") return "story";
  if (ref.role === "primary") return "module";
  return "doc";
}

export function brainRefIcon(ref: BrainRef, fileIcon: IconName): IconName {
  const kind = brainRefVisualKind(ref);
  if (kind === "module") return "columns-2";
  if (kind === "story") return "users";
  return fileIcon;
}

export function brainRefGroupLabel(role: BrainRefRole): string {
  if (role === "primary") return "Module";
  if (role === "story") return "Story";
  if (role === "related") return "Related";
  return "Added";
}

export function brainRefSourceHint(ref: BrainRef): string {
  if (ref.role === "primary") return "From work module";
  if (ref.role === "related") return "From module related:";
  if (ref.role === "story") return "Story file";
  return "Added by you";
}
