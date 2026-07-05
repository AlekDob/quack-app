import { basename } from "../pathUtils";
import { fileIconName } from "../fileIcons";
import { Icon } from "./Icon";

type Props = { rel: string };

/** Cursor-style mini tree for the @-mention side preview. */
export function MentionPathPreview({ rel }: Props) {
  const segs = rel.split("/").filter(Boolean);
  if (segs.length === 0) return null;

  return (
    <div className="ai-mention-path-preview" aria-hidden="true">
      {segs.map((seg, i) => {
        const isLeaf = i === segs.length - 1;
        return (
          <div
            key={`${i}:${seg}`}
            className="ai-mention-path-row"
            style={{ "--tree-depth": i } as React.CSSProperties}
          >
            <span className="ai-mention-path-icon">
              <Icon
                name={isLeaf ? fileIconName(basename(seg)) : "folder"}
                size={14}
              />
            </span>
            <span className={`ai-mention-path-name${isLeaf ? " leaf" : ""}`}>
              {seg}
            </span>
          </div>
        );
      })}
    </div>
  );
}
