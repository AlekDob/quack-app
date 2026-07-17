// Quiet “Worked for 1m 42s” header at the top of a finished assistant turn.

import { formatWorkedDuration } from "../formatWorkedDuration";
import { Icon } from "./Icon";

type Props = {
  durationMs: number;
};

export function TurnWorkedHeader({ durationMs }: Props) {
  if (!(durationMs > 0)) return null;
  return (
    <div className="ai-worked-header">
      <span className="ai-worked-header-label">
        Worked for {formatWorkedDuration(durationMs)}
      </span>
      <Icon name="chevron-down" size={10} className="ai-worked-header-caret" />
    </div>
  );
}
