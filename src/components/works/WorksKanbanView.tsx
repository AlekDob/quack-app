import type { DragEvent } from "react";
import type { WorkItem, WorkStatus } from "../../works";
import { priorityDotClass, statusLabel } from "../../works";

const COLS: WorkStatus[] = ["backlog", "todo", "in_progress", "done"];

type Props = {
  items: WorkItem[];
  onOpen: (id: string) => void;
  onDropStatus: (id: string, status: WorkStatus) => void;
  onItemContextMenu: (id: string, e: React.MouseEvent) => void;
};

export function WorksKanbanView({
  items,
  onOpen,
  onDropStatus,
  onItemContextMenu,
}: Props) {
  return (
    <div className="works-kanban">
      {COLS.map((col) => (
        <KanbanColumn
          key={col}
          status={col}
          items={items.filter((w) => w.status === col)}
          onOpen={onOpen}
          onDropStatus={onDropStatus}
          onItemContextMenu={onItemContextMenu}
        />
      ))}
    </div>
  );
}

function KanbanColumn({
  status,
  items,
  onOpen,
  onDropStatus,
  onItemContextMenu,
}: {
  status: WorkStatus;
  items: WorkItem[];
  onOpen: (id: string) => void;
  onDropStatus: (id: string, status: WorkStatus) => void;
  onItemContextMenu: (id: string, e: React.MouseEvent) => void;
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
  return (
    <div
      className="works-kanban-col"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="works-kanban-col-head">{statusLabel(status)}</div>
      {items.map((w) => (
        <button
          key={w.id}
          type="button"
          className="works-kanban-card"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/work-id", w.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => onOpen(w.id)}
          onContextMenu={(e) => onItemContextMenu(w.id, e)}
        >
          <span className={`works-priority-dot ${priorityDotClass(w.priority)}`} />
          <span className="works-list-id">{w.shortId}</span>
          <span className="works-kanban-card-title">{w.title}</span>
        </button>
      ))}
    </div>
  );
}
