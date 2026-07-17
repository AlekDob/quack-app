import { useState } from "react";
import { confirm } from "../../dialog";
import { errMsg, error as toastError, info as toastInfo, success as toastSuccess } from "../../notify";
import { countDuplicateStories } from "../../works";
import { mergeDuplicateStories } from "../../worksCache";
import type { WorksSnapshot } from "../../works";
import { Icon } from "../Icon";

type Props = {
  root: string;
  snap: WorksSnapshot | null;
};

export function WorksMergeDupesButton({ root, snap }: Props) {
  const [busy, setBusy] = useState(false);
  const dupes = snap ? countDuplicateStories(snap.stories) : 0;
  if (!snap || dupes === 0) return null;

  const runMerge = async () => {
    const ok = await confirm(
      `Merge ${dupes} duplicate ${dupes === 1 ? "story" : "stories"}? Keeps the best-linked row per S-NNN and repoints child work items.`,
      { title: "Merge duplicate stories", okLabel: "Merge" },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { merged, reparented } = await mergeDuplicateStories(root);
      if (merged === 0) {
        toastInfo("No duplicate stories found");
        return;
      }
      const extra =
        reparented > 0
          ? ` · ${reparented} work item${reparented === 1 ? "" : "s"} reparented`
          : "";
      toastSuccess(`Merged ${merged} duplicate ${merged === 1 ? "story" : "stories"}${extra}`);
    } catch (e) {
      toastError(`Couldn't merge stories: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="works-plane-btn works-merge-dupes-btn"
      title={`Merge ${dupes} duplicate ${dupes === 1 ? "story" : "stories"}`}
      disabled={busy}
      onClick={() => void runMerge()}
    >
      <Icon name="git-compare" size={12} />
      {busy ? "Merging…" : `Merge ${dupes} dupes`}
    </button>
  );
}
