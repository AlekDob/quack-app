import { Icon } from "./Icon";
import type { EditorMdView } from "../editorMdView";

interface Props {
  isMarkdown: boolean;
  mdView: EditorMdView;
  onMdViewChange: (view: EditorMdView) => void;
  hasGitChanges: boolean;
  showDiff: boolean;
  onToggleDiff: () => void;
  diffSideBySide: boolean;
  onDiffSideBySideChange: (sideBySide: boolean) => void;
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  saveDisabled?: boolean;
}

function MdViewBtn({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: "edit" | "columns-2" | "eye";
}) {
  return (
    <button
      type="button"
      className={`editor-tab-seg ${active ? "active" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon name={icon} size={13} />
    </button>
  );
}

export function EditorTabToolbar({
  isMarkdown,
  mdView,
  onMdViewChange,
  hasGitChanges,
  showDiff,
  onToggleDiff,
  diffSideBySide,
  onDiffSideBySideChange,
  dirty,
  saving = false,
  onSave,
  saveDisabled = false,
}: Props) {
  return (
    <header className="editor-tab-toolbar" aria-label="Editor tools">
      <div className="editor-tab-toolbar-spacer" />
      {hasGitChanges && (
        <button
          type="button"
          className={`editor-tab-changes ${showDiff ? "active" : ""}`}
          onClick={onToggleDiff}
          title="Changes"
          aria-pressed={showDiff}
        >
          <Icon name="git-compare" size={13} />
          <span>Changes</span>
        </button>
      )}
      {showDiff ? (
        <div
          className="editor-tab-segmented"
          role="group"
          aria-label="Diff layout"
        >
          <button
            type="button"
            className={`editor-tab-seg labeled ${!diffSideBySide ? "active" : ""}`}
            onClick={() => onDiffSideBySideChange(false)}
            aria-pressed={!diffSideBySide}
          >
            Inline
          </button>
          <button
            type="button"
            className={`editor-tab-seg labeled ${diffSideBySide ? "active" : ""}`}
            onClick={() => onDiffSideBySideChange(true)}
            aria-pressed={diffSideBySide}
          >
            Split
          </button>
        </div>
      ) : (
        isMarkdown && (
          <div
            className="editor-tab-segmented"
            role="group"
            aria-label="Markdown view"
          >
            <MdViewBtn
              active={mdView === "edit"}
              label="Edit"
              icon="edit"
              onClick={() => onMdViewChange("edit")}
            />
            <MdViewBtn
              active={mdView === "split"}
              label="Split"
              icon="columns-2"
              onClick={() => onMdViewChange("split")}
            />
            <MdViewBtn
              active={mdView === "preview"}
              label="Preview"
              icon="eye"
              onClick={() => onMdViewChange("preview")}
            />
          </div>
        )
      )}
      <button
        type="button"
        className="editor-tab-save"
        onClick={onSave}
        disabled={saveDisabled || !dirty || saving}
        title={dirty ? "Save" : "No changes to save"}
      >
        <Icon name="save" size={13} />
        <span>{saving ? "Saving…" : "Save"}</span>
      </button>
    </header>
  );
}
