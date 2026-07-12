import type { WorkBlock } from "../../works";
import { WorkBlockEditor } from "./WorkBlockEditor";

type Props = {
  blocks: WorkBlock[];
  onChange: (blocks: WorkBlock[]) => void;
};

/** Notion-style inline block editor for work descriptions. */
export function WorkItemEditor({ blocks, onChange }: Props) {
  return <WorkBlockEditor blocks={blocks} onChange={onChange} />;
}
