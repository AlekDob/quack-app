import { Icon } from "./Icon";

type Props = {
  onNewWork: () => void;
  onNewStory: () => void;
  onOpenBoard: () => void;
  onPlanFeature?: () => void;
  onHotfix?: () => void;
};

export function ComposerWorkQuickActions({
  onNewWork,
  onNewStory,
  onOpenBoard,
  onPlanFeature,
  onHotfix,
}: Props) {
  return (
    <div className="ai-composer-work-quick">
      <button type="button" className="menu-item" onClick={onNewWork}>
        <span className="menu-item-label">
          <Icon name="plus" size={11} />
          New work item
        </span>
      </button>
      <button type="button" className="menu-item" onClick={onNewStory}>
        <span className="menu-item-label">
          <Icon name="plus" size={11} />
          New story
        </span>
      </button>
      {onPlanFeature ? (
        <button type="button" className="menu-item" onClick={onPlanFeature}>
          Plan a feature
        </button>
      ) : null}
      {onHotfix ? (
        <button type="button" className="menu-item" onClick={onHotfix}>
          Hotfix
        </button>
      ) : null}
      <button type="button" className="menu-item" onClick={onOpenBoard}>
        <span className="menu-item-label">
          <Icon name="columns-2" size={11} />
          Open Works board
        </span>
      </button>
    </div>
  );
}
