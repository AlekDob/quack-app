// "Presets" group in the organigramma — agents users can configure and
// create (Milo/Nora/Vera/Lia + custom ones), each with a proper name, a role
// subtitle, and an avatar. NOT the delegable subagents below: a preset
// shapes the CURRENT session (model/effort/instructions), it never opens an
// isolated context or gets spawned as a Task. See src/presets/ for the
// domain model. Jack's root card (WhiteboardOrganigramma.tsx) reuses
// PresetNode too — he's edited through the exact same drawer.
import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { success as toastSuccess, error as toastError, errMsg } from "../notify";
import { AvatarPicker } from "./AvatarPicker";
import { setPresetOverrides, uploadPresetAvatar, type PresetDefinition } from "../presets";

interface Props {
  root: string;
  presets: PresetDefinition[]; // built-in + custom, merged
  onEdit: (preset: PresetDefinition) => void;
  onCreate: () => void;
  onMutated: () => void;
}

export function WhiteboardPresetGroup({ root, presets, onEdit, onCreate, onMutated }: Props) {
  return (
    <div className="whiteboard-org-group">
      <div className="whiteboard-org-group-title">
        Presets
        <span className="whiteboard-preset-hint">
          shape the current session — not subagents
        </span>
      </div>
      <div className="whiteboard-org-group-agents">
        {presets.map((p) => (
          <PresetNode key={p.id} root={root} preset={p} onEdit={() => onEdit(p)} onMutated={onMutated} />
        ))}
        <button
          type="button"
          className="whiteboard-org-agent whiteboard-preset-new"
          onClick={onCreate}
        >
          <Icon name="plus" size={14} />
          <span>New agent</span>
        </button>
      </div>
    </div>
  );
}

export function PresetNode({
  root,
  preset,
  onEdit,
  onMutated,
}: {
  root: string;
  preset: PresetDefinition;
  onEdit: () => void;
  onMutated: () => void;
}) {
  // Both built-in and custom presets are editable now — built-ins just
  // persist to the override store (settings.ts) instead of a .md file,
  // since they have no backing file (path is null/absent for them).
  const isCustom = preset.source === "custom";
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  const applyAvatar = async (avatar: string) => {
    setPickingAvatar(false);
    try {
      if (isCustom && preset.path) {
        const { setFrontmatterScalar } = await import("../frontmatter");
        await setFrontmatterScalar(preset.path, "avatar", avatar);
      } else {
        setPresetOverrides(preset.id, { avatar });
      }
      toastSuccess(`Updated ${preset.label}'s avatar`);
      onMutated();
    } catch (e) {
      toastError(`Couldn't set avatar: ${errMsg(e)}`);
    }
  };

  return (
    <div
      className="whiteboard-org-agent whiteboard-preset-node"
      onClick={onEdit}
      role="button"
      tabIndex={0}
      title={`${preset.purpose} — click to edit`}
    >
      <div className="whiteboard-org-agent-head">
        <button
          ref={avatarBtnRef}
          type="button"
          className="whiteboard-preset-avatar-btn"
          onClick={(e) => {
            e.stopPropagation();
            setPickingAvatar(true);
          }}
          title="Click to change avatar"
        >
          <img
            className="whiteboard-org-agent-avatar whiteboard-preset-avatar"
            src={preset.avatar}
            alt=""
            aria-hidden="true"
          />
        </button>
        <div className="whiteboard-org-agent-meta">
          <div className="whiteboard-org-agent-name">{preset.label}</div>
          <div className="whiteboard-preset-role">{preset.role}</div>
        </div>
      </div>
      <div className="whiteboard-preset-chips">
        <span className="whiteboard-preset-chip">{preset.defaults.modelTier}</span>
        <span className="whiteboard-preset-chip">{preset.defaults.effort}</span>
        {!isCustom && <span className="whiteboard-preset-chip">built-in</span>}
      </div>
      {pickingAvatar && (
        <AvatarPicker
          anchorRef={avatarBtnRef}
          onPick={(a) => void applyAvatar(a)}
          onUpload={(path) => uploadPresetAvatar(root, preset.id, path)}
          onClose={() => setPickingAvatar(false)}
        />
      )}
    </div>
  );
}
