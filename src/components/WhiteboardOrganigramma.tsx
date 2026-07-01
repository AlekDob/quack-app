// Whiteboard organigramma — vertical tree (Jack → agents → skills) with
// mouse-based drag-and-drop. NOT HTML5 DnD: Tauri 2's webview on macOS
// (and arguably other WebKit targets) swallows in-app HTML5 drag events
// when `dragDropEnabled: true` (default), so `dragstart` fires on the
// source but no `dragover`/`drop` ever reaches any DOM element. We
// instead track mousedown on a draggable chip, follow the cursor with
// document-level mousemove/mouseup, hit-test the agent under the
// cursor via `elementFromPoint`, and on mouseup call linkSkill() if
// the cursor is over an agent.
//
// Visual lines between parent / children are drawn with CSS pseudo-elements
// (no SVG, no library) — same tree pattern used elsewhere in the app.

import { useCallback, useMemo, useState, type MouseEventHandler } from "react";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import type { SubagentDef } from "../subagents";
import type { SkillDef } from "../skills";
import { setFrontmatterList } from "../frontmatter";
import { success as toastSuccess, error as toastError, errMsg } from "../notify";
import type { WhiteboardData } from "./WhiteboardPane";
import { openFileAndReveal } from "../revealInTree";

// DOM attribute used to mark agent nodes so document.elementFromPoint +
// closest("[data-wb-agent]") can find them during the drag.
const AGENT_DATA_ATTR = "data-wb-agent";
// Drag-threshold in pixels — a quick click (mousedown+mouseup within
// this distance) is treated as a click (opens the .md), not a drag.
const DRAG_THRESHOLD_PX = 4;

interface Props {
  wsId: string;
  root: string;
  data: WhiteboardData;
  onMutated: () => void;
}

export function WhiteboardOrganigramma({ wsId, data, onMutated }: Props) {
  const { agents, skills } = data;
  const projectAgents = useMemo(
    () => agents.filter((a) => a.source === "project"),
    [agents],
  );
  const userAgents = useMemo(
    () => agents.filter((a) => a.source === "user"),
    [agents],
  );

  const skillsByName = useMemo(() => {
    const m = new Map<string, SkillDef>();
    for (const s of skills) m.set(s.name, s);
    return m;
  }, [skills]);

  // Track which agent node is the current drop target (for visual highlight).
  const [hoverAgent, setHoverAgent] = useState<string | null>(null);

  const linkSkill = async (agent: SubagentDef, skillName: string) => {
    if (!agent.path) {
      toastError(`Can't write to ${agent.name} — file path unknown.`);
      return;
    }
    if (agent.skills.includes(skillName)) return; // already linked
    const next = [...agent.skills, skillName];
    try {
      await setFrontmatterList(agent.path, "skills", next);
      toastSuccess(`Linked ${skillName} → ${agent.name}`);
      onMutated();
    } catch (e) {
      toastError(`Couldn't link: ${errMsg(e)}`);
    }
  };

  const unlinkSkill = async (agent: SubagentDef, skillName: string) => {
    if (!agent.path) {
      toastError(`Can't write to ${agent.name} — file path unknown.`);
      return;
    }
    const next = agent.skills.filter((s) => s !== skillName);
    try {
      await setFrontmatterList(agent.path, "skills", next);
      toastSuccess(`Unlinked ${skillName} ← ${agent.name}`);
      onMutated();
    } catch (e) {
      toastError(`Couldn't unlink: ${errMsg(e)}`);
    }
  };

  // ── Mouse-based DnD ──────────────────────────────────────────────
  // Started by the chip's onMouseDown. Document-level mousemove/mouseup
  // follow the cursor, and we hit-test which agent is under the cursor
  // via elementFromPoint + closest(`[data-wb-agent]`). On mouseup we
  // call linkSkill if any agent is currently hovered.

  // Hit-test the agent under (clientX, clientY). Returns the agent's
  // SubagentDef if found, else null. Uses the AGENT_DATA_ATTR marker
  // we set on every agent wrapper.
  const findAgentAt = useCallback(
    (clientX: number, clientY: number): SubagentDef | null => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const node = el.closest<HTMLElement>(`[${AGENT_DATA_ATTR}]`);
      if (!node) return null;
      const name = node.getAttribute(AGENT_DATA_ATTR);
      if (!name) return null;
      return agents.find((a) => a.name === name) ?? null;
    },
    [agents],
  );

  // Called by SkillChip.onMouseDown — registers global listeners.
  // Takes the source chip element so we can dim it ("lifting") and
  // clone it as the floating ghost that follows the cursor. Returns
  // a cleanup function the chip calls on mouseup with the final
  // cursor coords — that's where we hit-test the agent, fade the
  // ghost, and link the skill.
  const startDrag = useCallback(
    (
      skill: SkillDef,
      startClientX: number,
      startClientY: number,
      sourceChip: HTMLElement,
    ) => {
      let active = true;
      // (1) Dim the source chip while the ghost is the active drag
      // representation. Restored in the cleanup.
      sourceChip.classList.add("whiteboard-skill-chip--dragging");

      // (2) Build the floating ghost and append it to <body>. The ghost
      // is `position: fixed` with `pointer-events: none`, so it never
      // affects hit-testing for the agent underneath the cursor.
      const ghost = sourceChip.cloneNode(true) as HTMLElement;
      ghost.classList.add("whiteboard-drag-ghost");
      ghost.removeAttribute("data-wb-skill");
      ghost.style.position = "fixed";
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "9999";
      ghost.style.left = `${startClientX}px`;
      ghost.style.top = `${startClientY}px`;
      ghost.style.transform = "translate(-50%, -50%) scale(1.05)";
      document.body.appendChild(ghost);

      const onMove = (e: MouseEvent) => {
        if (!active) return;
        // Position the ghost — the chip follows the cursor 1:1.
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
        // Only flip the hover state once the cursor has moved past the
        // threshold — before that, we're still inside the chip's
        // "maybe-a-click" zone.
        const dx = e.clientX - startClientX;
        const dy = e.clientY - startClientY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        const agent = findAgentAt(e.clientX, e.clientY);
        setHoverAgent(agent ? agent.name : null);
      };

      // Cleanup returned to the chip's mouseup — performs the final
      // position update + hit-test + ghost fade-out + skill link.
      return (endX: number, endY: number) => {
        if (!active) return;
        active = false;
        window.removeEventListener("mousemove", onMove);
        // Snap the ghost to the exact final cursor position before
        // fading it out.
        ghost.style.left = `${endX}px`;
        ghost.style.top = `${endY}px`;
        const agent = findAgentAt(endX, endY);
        setHoverAgent(null);
        sourceChip.classList.remove("whiteboard-skill-chip--dragging");
        ghost.classList.add("whiteboard-drag-ghost--fading");
        window.setTimeout(() => {
          if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
        }, 120);
        if (agent && agent.name) {
          void linkSkill(agent, skill.name);
        }
      };
    },
    [findAgentAt, linkSkill],
  );

  // Click handler for skill chips (no drag) — opens the SKILL.md in
  // an editor tab.
  const openSkillFile = useCallback(
    (skill: SkillDef) => {
      if (!skill.path) {
        toastError(`${skill.name} has no known SKILL.md path.`);
        return;
      }
      void openFileAndReveal(wsId, skill.path);
    },
    [wsId],
  );

  if (agents.length === 0) {
    return (
      <div className="whiteboard-empty">
        <AIIcon size={28} />
        <div className="whiteboard-empty-title">No subagents yet.</div>
        <div className="whiteboard-empty-hint">
          Add a <code>.md</code> file in <code>.claude/agents/</code> and it
          will appear here.
        </div>
      </div>
    );
  }

  // Skills not attached to ANY agent — go in the free pile at the bottom.
  const usedSlugs = new Set<string>();
  for (const a of agents) for (const s of a.skills) usedSlugs.add(s);
  const freeSkills = skills.filter((s) => !usedSlugs.has(s.name));

  // [removed] window-level DnD diagnostic — replaced by mouse-based DnD
  // after diagnostics confirmed Tauri 2 with default `dragDropEnabled`
  // swallows in-app HTML5 drag events. The new flow is mousedown on
  // <SkillChip> → document mousemove/mouseup → elementFromPoint. See
  // startDrag() above and the chip's onMouseDown handler.

  return (
    <div className="whiteboard-org">
      {/* Root — Jack */}
      <div className="whiteboard-org-root-row">
        <div className="whiteboard-org-root">
          <AIIcon size={36} />
          <div className="whiteboard-org-root-text">
            <div className="whiteboard-org-root-name">Jack</div>
            <div className="whiteboard-org-role">Project Manager</div>
          </div>
        </div>
        <div className="whiteboard-org-stem" />
      </div>

      {userAgents.length > 0 && (
        <OrgGroup
          wsId={wsId}
          title="Global subagents"
          agents={userAgents}
          skillsByName={skillsByName}
          hoverAgent={hoverAgent}
          onUnlink={unlinkSkill}
          openSkillFile={openSkillFile}
        />
      )}
      {projectAgents.length > 0 && (
        <OrgGroup
          wsId={wsId}
          title="Project subagents"
          agents={projectAgents}
          skillsByName={skillsByName}
          hoverAgent={hoverAgent}
          onUnlink={unlinkSkill}
          openSkillFile={openSkillFile}
        />
      )}

      {freeSkills.length > 0 && (
        <div className="whiteboard-org-pool">
          <div className="whiteboard-org-pool-title">
            <Icon name="star" size={12} />
            <span>
              Unassigned skills — drag onto an agent to link · click to open
            </span>
          </div>
          <div className="whiteboard-org-pool-chips">
            {freeSkills.map((s) => (
              <SkillChip
                key={s.name}
                skill={s}
                onDragStart={(skill, x, y, el) =>
                  startDrag(skill, x, y, el)
                }
                onClick={openSkillFile}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Group (Project / Global) ─────────────────────────────────────────
function OrgGroup({
  wsId,
  title,
  agents,
  skillsByName,
  hoverAgent,
  onUnlink,
  openSkillFile,
}: {
  wsId: string;
  title: string;
  agents: SubagentDef[];
  skillsByName: Map<string, SkillDef>;
  hoverAgent: string | null;
  onUnlink: (agent: SubagentDef, skillName: string) => Promise<void> | void;
  openSkillFile: (skill: SkillDef) => void;
}) {
  return (
    <div className="whiteboard-org-group">
      <div className="whiteboard-org-group-title">{title}</div>
      <div className="whiteboard-org-group-agents">
        {agents.map((a) => (
          <AgentNode
            key={a.name}
            wsId={wsId}
            agent={a}
            skillsByName={skillsByName}
            isHover={hoverAgent === a.name}
            onUnlink={onUnlink}
            openSkillFile={openSkillFile}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single agent node + its attached skills ──────────────────────────
function AgentNode({
  wsId,
  agent,
  skillsByName,
  isHover,
  onUnlink,
  openSkillFile,
}: {
  wsId: string;
  agent: SubagentDef;
  skillsByName: Map<string, SkillDef>;
  isHover: boolean;
  onUnlink: (agent: SubagentDef, skillName: string) => Promise<void> | void;
  openSkillFile: (skill: SkillDef) => void;
}) {
  // Click on the agent → open its .md in an editor tab. We skip the
  // open when the click landed on a child skill chip (which handles its
  // own action via SkillChip's mouseup/click → openSkillFile).
  const openAgentFile: MouseEventHandler<HTMLDivElement> = (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-wb-skill]")) return;
    if (!agent.path) {
      toastError(`${agent.name} has no known file path.`);
      return;
    }
    void openFileAndReveal(wsId, agent.path);
  };

  return (
    <div
      className={`whiteboard-org-agent ${isHover ? "is-drop-target" : ""}`}
      data-wb-agent={agent.name}
      onClick={openAgentFile}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          // Only handle Enter/Space when focus is on the wrapper
          // itself, not when it's on a child (e.g. the × button).
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          // Bypass openAgentFile's closest() check — synthesize an event
          // without a target that won't match any data-wb-skill.
          if (!agent.path) {
            toastError(`${agent.name} has no known file path.`);
            return;
          }
          void openFileAndReveal(wsId, agent.path);
        }
      }}
      title={agent.path ?? `${agent.name} — click to open its .md file`}
    >
      <div className="whiteboard-org-agent-head">
        <img
          className="whiteboard-org-agent-avatar"
          src={agent.avatar}
          alt=""
          aria-hidden="true"
        />
        <div className="whiteboard-org-agent-meta">
          <div className="whiteboard-org-agent-name">{agent.name}</div>
          {agent.description && (
            <div
              className="whiteboard-org-agent-desc"
              title={agent.description}
            >
              {agent.description}
            </div>
          )}
        </div>
        <span className="whiteboard-org-agent-count" aria-label="linked skills">
          {agent.skills.length}
        </span>
      </div>
      {agent.skills.length > 0 && (
        <ul className="whiteboard-org-agent-skills">
          {agent.skills.map((slug) => {
            const sk = skillsByName.get(slug);
            // If we can't resolve the linked skill from the loaded
            // SkillDef list (e.g. the skill was deleted), skip — don't
            // render a broken chip we can't open or unlink.
            if (!sk) return null;
            return (
              <li key={slug}>
                <SkillChip
                  skill={sk}
                  // No onDragStart — linked chips don't initiate a
                  // re-link drag (unlink → re-link requires explicit
                  // × + drag-from-pool). Click still opens SKILL.md.
                  onClick={(s) => openSkillFile(s)}
                />
                <button
                  className="whiteboard-skill-chip-x-standalone"
                  title={`Unlink ${slug} from ${agent.name}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void onUnlink(agent, slug);
                  }}
                  aria-label={`Unlink ${slug}`}
                >
                  <Icon name="x" size={10} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Skill chip (mouse-draggable + click-to-open) ───────────────────
// Unified mousedown handler:
//   - mousedown → record start position + dim the chip
//   - mousemove: cross DRAG_THRESHOLD_PX → call onDragStart (parent
//     creates the ghost + manages the drag); before threshold, do nothing
//     (the chip is still in "maybe-a-click" mode)
//   - mouseup:
//       * if it was a drag → call the cleanup returned by onDragStart
//       * if it stayed under the threshold → it's a CLICK, call onClick
//         (parent opens SKILL.md)
function SkillChip({
  skill,
  onDragStart,
  onClick,
}: {
  skill: SkillDef;
  /** Fired once the cursor has moved past DRAG_THRESHOLD_PX during a
   *  mousedown. Receives the start coords + the source element (so the
   *  parent can dim it + clone it as a ghost). Returns a function the
   *  chip will call on mouseup with the final cursor coords — that
   *  function is responsible for updating the ghost position, hit-
   *  testing the agent, fading the ghost, and (if over an agent)
   *  linking the skill. */
  onDragStart?: (
    skill: SkillDef,
    startX: number,
    startY: number,
    sourceEl: HTMLElement,
  ) => ((endX: number, endY: number) => void) | undefined;
  /** Fired on mouseup that never crossed the drag threshold (= click).
   *  Parent opens the SKILL.md in an editor tab. */
  onClick?: (skill: SkillDef) => void;
}) {
  return (
    <div
      className="whiteboard-skill-chip"
      data-wb-skill={skill.name}
      // No HTML5 `draggable` — Tauri 2 swallows internal HTML5 drags.
      // The parent's onMouseDown sets up document-level mousemove +
      // mouseup listeners to perform the drop via elementFromPoint.
      onMouseDown={(e) => {
        // Only left button.
        if (e.button !== 0) return;
        // Prevent text selection on a quick click. The click event
        // would otherwise still fire on this element, but with no
        // onClick handler so it does nothing.
        e.preventDefault();
        const sourceEl = e.currentTarget;
        const startX = e.clientX;
        const startY = e.clientY;
        let didDrag = false;
        let cleanupDrag:
          | ((endX: number, endY: number) => void)
          | undefined;

        const onMove = (moveE: MouseEvent) => {
          const dx = moveE.clientX - startX;
          const dy = moveE.clientY - startY;
          if (
            !didDrag &&
            onDragStart &&
            Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
          ) {
            didDrag = true;
            cleanupDrag = onDragStart(skill, startX, startY, sourceEl);
          }
        };
        const onUp = (upE: MouseEvent) => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (didDrag && cleanupDrag) {
            // Hand the final cursor coords to the drag controller —
            // it will hit-test the agent, fade the ghost, and link.
            cleanupDrag(upE.clientX, upE.clientY);
          } else if (onClick) {
            // Didn't drag — treat the mousedown+mouseup as a click.
            onClick(skill);
          }
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
      title={
        skill.description
          ? `/skills/${skill.name} — ${skill.description}`
          : `/skills/${skill.name}`
      }
      style={{ cursor: onDragStart || onClick ? "pointer" : undefined }}
    >
      <Icon name="star" size={11} />
      <span className="whiteboard-skill-chip-name">{skill.name}</span>
      <span className="whiteboard-skill-chip-scope">{skill.source}</span>
    </div>
  );
}
