import type { DragEvent } from "react";
import { buildWorksListGroups } from "../../worksListGroups";
import type { WorkItem, WorkModule, WorkStatus, WorkStory } from "../../works";
import { priorityDotClass, statusLabel, storyLabel } from "../../works";
import { Icon } from "../Icon";
import { worksStoryAccentStyle } from "./worksStoryRowStyle";

const COLS: WorkStatus[] = ["backlog", "todo", "in_progress", "done"];

type Props = {
  items: WorkItem[];
  stories: WorkStory[];
  modules: WorkModule[];
  selectedStoryId: string | null;
  storyAccent?: string | null;
  onOpen: (id: string) => void;
  onOpenStory: (id: string) => void;
  onDropStatus: (id: string, status: WorkStatus) => void;
  onItemContextMenu: (id: string, e: React.MouseEvent) => void;
  onStoryContextMenu: (id: string, e: React.MouseEvent) => void;
};

export function WorksKanbanView({
  items,
  stories,
  modules,
  selectedStoryId,
  storyAccent,
  onOpen,
  onOpenStory,
  onDropStatus,
  onItemContextMenu,
  onStoryContextMenu,
}: Props) {
  const groups = buildWorksListGroups(stories, items, modules, "");

  return (
    <div className="works-kanban">
      {COLS.map((col) => (
        <KanbanColumn
          key={col}
          status={col}
          groups={groups}
          selectedStoryId={selectedStoryId}
          storyAccent={storyAccent}
          onOpen={onOpen}
          onOpenStory={onOpenStory}
          onDropStatus={onDropStatus}
          onItemContextMenu={onItemContextMenu}
          onStoryContextMenu={onStoryContextMenu}
        />
      ))}
    </div>
  );
}

function KanbanColumn({
  status,
  groups,
  selectedStoryId,
  storyAccent,
  onOpen,
  onOpenStory,
  onDropStatus,
  onItemContextMenu,
  onStoryContextMenu,
}: {
  status: WorkStatus;
  groups: ReturnType<typeof buildWorksListGroups>;
  selectedStoryId: string | null;
  storyAccent?: string | null;
  onOpen: (id: string) => void;
  onOpenStory: (id: string) => void;
  onDropStatus: (id: string, status: WorkStatus) => void;
  onItemContextMenu: (id: string, e: React.MouseEvent) => void;
  onStoryContextMenu: (id: string, e: React.MouseEvent) => void;
}) {
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/work-id");
    if (id) onDropStatus(id, status);
  };

  const accentStyle = worksStoryAccentStyle(storyAccent);

  return (
    <div className="works-kanban-col" onDragOver={onDragOver} onDrop={onDrop}>
      <div className="works-kanban-col-head">{statusLabel(status)}</div>
      {groups.map((g) => {
        if (g.kind === "story") {
          const inCol = g.children.filter((w) => w.status === status);
          const showLane =
            inCol.length > 0 ||
            (status === "backlog" && g.children.length === 0);
          if (!showLane) return null;
          return (
            <div
              key={g.story.id}
              className="works-kanban-story-lane"
              style={accentStyle}
            >
              <KanbanStoryHeader
                story={g.story}
                active={selectedStoryId === g.story.id}
                onOpen={() => onOpenStory(g.story.id)}
                onContextMenu={(e) => onStoryContextMenu(g.story.id, e)}
              />
              {inCol.map((w) => (
                <KanbanCard
                  key={w.id}
                  item={w}
                  nested
                  onOpen={() => onOpen(w.id)}
                  onContextMenu={(e) => onItemContextMenu(w.id, e)}
                />
              ))}
            </div>
          );
        }
        if (g.item.status !== status) return null;
        return (
          <KanbanCard
            key={g.item.id}
            item={g.item}
            onOpen={() => onOpen(g.item.id)}
            onContextMenu={(e) => onItemContextMenu(g.item.id, e)}
          />
        );
      })}
    </div>
  );
}

function KanbanStoryHeader({
  story,
  active,
  onOpen,
  onContextMenu,
}: {
  story: WorkStory;
  active: boolean;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className={`works-kanban-story${active ? " active" : ""}`}
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <span className="works-kanban-story-icon" aria-hidden>
        <Icon name="users" size={13} />
      </span>
      <span className="works-kanban-story-body">
        <span className="works-list-id">{story.shortId}</span>
        <span className="works-kanban-card-title">{story.title}</span>
      </span>
      <span className={`works-story-pill works-story-pill--${story.status}`}>
        {storyLabel(story.status)}
      </span>
    </button>
  );
}

function KanbanCard({
  item,
  nested,
  onOpen,
  onContextMenu,
}: {
  item: WorkItem;
  nested?: boolean;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className={`works-kanban-card${nested ? " works-kanban-card--nested" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/work-id", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <span className={`works-priority-dot ${priorityDotClass(item.priority)}`} />
      <span className="works-list-id">{item.shortId}</span>
      <span className="works-kanban-card-title">{item.title}</span>
    </button>
  );
}
