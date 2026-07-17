// "New agent" drawer — Cursor-style right slide-over, replacing the old
// inline form. Mirrors SessionUsageDrawer's mount/animation pattern (stay
// mounted through the close transition, double-rAF on open).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "../useModalFocus";
import { Icon } from "./Icon";
import { AvatarPicker } from "./AvatarPicker";
import { duckAvatarFor } from "../subagents";
import {
  clearPresetOverrides,
  createPreset,
  setPresetOverrides,
  updatePreset,
  uploadPresetAvatar,
  type EffortLevel,
  type ModelTier,
  type OutputStyle,
  type PresetDefinition,
} from "../presets";
import { PERM_MODE_OPTIONS } from "../presets/permModes";
import { success as toastSuccess, error as toastError, errMsg } from "../notify";

const MODEL_TIER_OPTIONS: Array<{ value: ModelTier; label: string }> = [
  { value: "reasoning", label: "Reasoning" },
  { value: "balanced", label: "Balanced" },
  { value: "fast", label: "Fast" },
];
const EFFORT_OPTIONS: EffortLevel[] = ["low", "medium", "high", "xhigh", "max"];
const OUTPUT_STYLE_OPTIONS: Array<{ value: OutputStyle; label: string }> = [
  { value: "concise", label: "Concise" },
  { value: "structured", label: "Structured" },
  { value: "terse-review", label: "Terse review" },
];

interface Props {
  open: boolean;
  root: string;
  /** Pass an existing custom preset to edit it in place instead of creating
   *  a new one — same drawer, same fields, writes back to `editing.path`. */
  editing?: PresetDefinition | null;
  onClose: () => void;
  onCreated: () => void;
}

export function AgentCreateDrawer({ open, root, editing, onClose, onCreated }: Props) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const avatarBtnRef = useRef<HTMLButtonElement | null>(null);
  useModalFocus(panelRef, shown);
  // Scratch slug for an uploaded avatar BEFORE the agent has a real slug —
  // unique per drawer session so two drafts never overwrite each other's file.
  const draftIdRef = useRef(`draft-${Math.random().toString(36).slice(2, 10)}`);

  const [label, setLabel] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [modelTier, setModelTier] = useState<ModelTier>("balanced");
  const [effort, setEffort] = useState<EffortLevel>("medium");
  const [outputStyle, setOutputStyle] = useState<OutputStyle>("concise");
  const [permMode, setPermMode] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && !mounted) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    } else if (!open && mounted) {
      setShown(false);
      const t = window.setTimeout(() => setMounted(false), 220);
      return () => window.clearTimeout(t);
    }
  }, [open, mounted]);

  // Reset the form each time the drawer opens — pre-filled when editing.
  useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? "");
    setRole(editing?.role ?? "");
    setDescription(editing?.purpose ?? "");
    setAvatar(editing?.avatar ?? null);
    setModelTier(editing?.defaults.modelTier ?? "balanced");
    setEffort(editing?.defaults.effort ?? "medium");
    setOutputStyle(editing?.defaults.outputStyle ?? "concise");
    setPermMode(editing?.defaults.permMode ?? null);
    setInstructions(editing?.instructions ?? "");
  }, [open, editing]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  const previewAvatar = avatar ?? duckAvatarFor(label || "new-agent");

  const submit = async () => {
    if (!label.trim()) {
      toastError("Give the agent a name first.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        label: label.trim(),
        role: role.trim() || "Custom preset",
        description: description.trim(),
        modelTier,
        effort,
        outputStyle,
        permMode,
        instructions,
        avatar: avatar ?? undefined,
      };
      if (editing?.source === "custom" && editing.path) {
        await updatePreset(editing.path, input);
        toastSuccess(`Updated ${label.trim()}`);
      } else if (editing) {
        // Built-ins have no backing file — persist as an override layer on
        // top of the shipped definition (effectivePresetDefinition merges
        // it back in everywhere the preset is displayed/resolved).
        const ok = await setPresetOverrides(editing.id, {
          label: input.label,
          role: input.role,
          description: input.description,
          avatar: input.avatar,
          modelTier: input.modelTier,
          effort: input.effort,
          outputStyle: input.outputStyle,
          permMode: input.permMode,
          instructions: input.instructions,
        });
        if (!ok) {
          toastError("Couldn't save agent settings — try freeing browser storage or restart Quack.");
          return;
        }
        toastSuccess(`Updated ${label.trim()}`);
      } else {
        await createPreset(root, input);
        toastSuccess(`Created agent "${label.trim()}"`);
      }
      onCreated();
      onClose();
    } catch (e) {
      toastError(`Couldn't save agent: ${errMsg(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!editing || editing.source !== "builtin") return;
    await clearPresetOverrides(editing.id);
    toastSuccess(`${editing.label} reset to defaults`);
    onCreated();
    onClose();
  };

  return createPortal(
    <div className={`tool-drawer-scrim${shown ? " shown" : ""}`} onMouseDown={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`tool-drawer${shown ? " shown" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? `Edit ${editing.label}` : "New agent"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tool-drawer-head">
          <div className="tool-drawer-titles">
            <span className="tool-drawer-title">
              {editing ? `Edit ${editing.label}` : "New agent"}
            </span>
            <span className="tool-drawer-sub">
              Shapes the current session — not a subagent
            </span>
          </div>
          <button
            className="tool-drawer-close"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="agent-drawer-body">
          <div className="agent-drawer-identity">
            <button
              ref={avatarBtnRef}
              type="button"
              className="agent-drawer-avatar-btn"
              onClick={() => setPickingAvatar(true)}
              title="Choose avatar"
            >
              <img src={previewAvatar} alt="" />
            </button>
            <div className="agent-drawer-identity-fields">
              <input
                className="agent-drawer-input agent-drawer-name"
                placeholder="Name (e.g. Ada)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
              <input
                className="agent-drawer-input"
                placeholder="Role (e.g. Researcher)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>
          {pickingAvatar && (
            <AvatarPicker
              anchorRef={avatarBtnRef}
              onPick={(a) => {
                setAvatar(a);
                setPickingAvatar(false);
              }}
              onUpload={(path) =>
                uploadPresetAvatar(root, editing?.id ?? draftIdRef.current, path)
              }
              onClose={() => setPickingAvatar(false)}
            />
          )}

          <textarea
            className="agent-drawer-textarea"
            placeholder="One-line purpose"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <div className="agent-drawer-field">
            <div className="agent-drawer-label">Model</div>
            <div className="ai-effort-seg">
              {MODEL_TIER_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`ai-effort-seg-btn ${modelTier === o.value ? "active" : ""}`}
                  onClick={() => setModelTier(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="agent-drawer-field">
            <div className="agent-drawer-label">Effort</div>
            <div className="ai-effort-seg">
              {EFFORT_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`ai-effort-seg-btn ${effort === v ? "active" : ""}`}
                  onClick={() => setEffort(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="agent-drawer-field">
            <div className="agent-drawer-label">Output style</div>
            <div className="ai-effort-seg">
              {OUTPUT_STYLE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`ai-effort-seg-btn ${outputStyle === o.value ? "active" : ""}`}
                  onClick={() => setOutputStyle(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="agent-drawer-field">
            <div className="agent-drawer-label">Mode</div>
            <div className="ai-effort-seg">
              {PERM_MODE_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  className={`ai-effort-seg-btn ${permMode === o.v ? "active" : ""}`}
                  onClick={() => setPermMode(o.v)}
                  title={o.desc}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="agent-drawer-field">
            <div className="agent-drawer-label">Instructions</div>
            <textarea
              className="agent-drawer-textarea"
              placeholder="Appended to the system prompt whenever this agent is active"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        <div className="agent-drawer-foot">
          {editing?.source === "builtin" && (
            <button
              className="cust-btn agent-drawer-reset"
              onClick={() => void resetToDefault()}
              disabled={saving}
              title="Clear overrides and go back to the shipped defaults"
            >
              Reset to default
            </button>
          )}
          <button className="cust-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="cust-btn primary" onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create agent"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
