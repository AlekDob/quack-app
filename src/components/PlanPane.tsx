import { parsePlanKey, planPayload } from "../plan";
import { Icon } from "./Icon";
import { MarkdownPreview } from "./MarkdownPreview";
import { useStore } from "../store";

interface Props {
  tabKey: string;
}

export function PlanPane({ tabKey }: Props) {
  const parsed = parsePlanKey(tabKey);
  const payload = planPayload(tabKey);
  if (!parsed || !payload) {
    return (
      <div className="plan-pane plan-pane-error">
        <Icon name="alert-triangle" size={20} />
        <span>Plan is no longer available.</span>
      </div>
    );
  }
  return (
    <div className="plan-pane">
      <div className="plan-pane-head">
        <Icon name="check-square" size={14} />
        <span>Claude's plan</span>
      </div>
      <div className="plan-pane-body">
        <MarkdownPreview content={payload.plan} />
      </div>
    </div>
  );
}

export function openPlanTab(
  wsId: string,
  chatId: string | undefined,
  planId: string,
  plan: string,
): void {
  useStore.getState().openPlan(wsId, chatId, planId, plan);
}
