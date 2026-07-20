import { parsePlanKey, planPayload } from "../plan";
import { Icon } from "./Icon";
import { MarkdownPreview } from "./MarkdownPreview";
import { useStore } from "../store";
import { getAgentMode } from "../agentMode";
import { focusAgentPlan } from "../agentContextNav";
import { onNativePlanReady } from "../quackPlanHarness";

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

/** Full-read plan body for Agent Mode context column. */
export function AgentPlanPane({ plan }: { plan: string }) {
  return (
    <div className="plan-pane">
      <div className="plan-pane-head">
        <Icon name="check-square" size={14} />
        <span>Claude's plan</span>
      </div>
      <div className="plan-pane-body">
        <MarkdownPreview content={plan} />
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

/**
 * Route a ready plan to the right surface: Agent Mode → context Plan tab;
 * IDE → FeatureDocDrawer (linked feature) or ephemeral `plan:` split.
 */
export function presentPlanReady(
  wsId: string,
  chatId: string | undefined,
  root: string,
  planId: string,
  plan: string,
): void {
  const desc = chatId
    ? useStore.getState().loaded[wsId]?.aiChats[chatId]
    : undefined;
  if (getAgentMode()) {
    if (desc?.featureId && chatId) {
      void onNativePlanReady(wsId, chatId, root, desc.storyId ?? "", plan);
    }
    focusAgentPlan(wsId);
    return;
  }
  if (desc?.featureId && chatId) {
    void onNativePlanReady(wsId, chatId, root, desc.storyId ?? "", plan);
    return;
  }
  openPlanTab(wsId, chatId, planId, plan);
}
