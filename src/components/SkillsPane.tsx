// Skills tab for the Agent Customizations modal. Lists Claude Code
// skills (.claude/skills/<name>/SKILL.md, project + user scope), creates
// new ones, and edits a skill's SKILL.md inline via FileEditorPane.

import { useCallback, useEffect, useState } from "react";
import { fs } from "../ipc";
import { joinPath } from "../pathUtils";
import { prompt as dialogPrompt } from "../dialog";
import { error as toastError, errMsg } from "../notify";
import { Icon } from "./Icon";
import { FileEditorPane } from "./FileEditorPane";

interface Props {
  root: string;
  /** Forwarded to the embedded editor so the host can guard close. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface SkillEntry {
  name: string;
  path: string;
  scope: "project" | "user";
}

const SKILL_STARTER = (name: string) =>
  `---
name: ${name}
description: One-line summary of when Claude should use this skill.
---

# ${name}

Describe the workflow, steps, and any domain knowledge Claude should
follow when this skill is active.
`;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SkillsPane({ root, onDirtyChange }: Props) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{
    path: string;
    name: string;
    starter?: string;
  } | null>(null);

  const projectSkillsDir = joinPath(root, ".claude", "skills");

  const listFrom = async (
    dir: string,
    scope: SkillEntry["scope"],
  ): Promise<SkillEntry[]> => {
    try {
      if (!(await fs.exists(dir))) return [];
      const entries = await fs.listDir(dir);
      const out: SkillEntry[] = [];
      for (const e of entries) {
        if (!e.is_dir) continue;
        const md = joinPath(e.path, "SKILL.md");
        if (await fs.exists(md)) out.push({ name: e.name, path: md, scope });
      }
      return out;
    } catch {
      return [];
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    const project = await listFrom(projectSkillsDir, "project");
    let user: SkillEntry[] = [];
    try {
      const { homeDir, join } = await import("@tauri-apps/api/path");
      const home = await homeDir();
      const userDir = await join(home, ".claude", "skills");
      user = await listFrom(userDir.replace(/\\/g, "/"), "user");
    } catch {
      /* no user scope */
    }
    setSkills([...project, ...user]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSkillsDir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSkill = async () => {
    const raw = await dialogPrompt("New skill name (e.g. release-notes)");
    if (!raw) return;
    const name = slugify(raw);
    if (!name) {
      toastError("Invalid skill name.");
      return;
    }
    const dir = joinPath(projectSkillsDir, name);
    try {
      for (const d of [joinPath(root, ".claude"), projectSkillsDir, dir]) {
        if (!(await fs.exists(d))) await fs.createDir(d);
      }
    } catch (e) {
      toastError(`Could not create skill folder: ${errMsg(e)}`);
      return;
    }
    setEditing({
      path: joinPath(dir, "SKILL.md"),
      name,
      starter: SKILL_STARTER(name),
    });
  };

  if (editing) {
    return (
      <FileEditorPane
        path={editing.path}
        title={editing.name}
        subtitle="SKILL.md"
        starter={editing.starter}
        gitRoot={root}
        onDirtyChange={onDirtyChange}
        onBack={() => {
          setEditing(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="cust-pane">
      <div className="cust-pane-head">
        <div className="cust-pane-intro">
          Reusable workflows Claude can invoke. Stored in{" "}
          <code>.claude/skills/&lt;name&gt;/SKILL.md</code> and loaded by Claude
          Code.
        </div>
        <button className="cust-btn primary" onClick={() => void createSkill()}>
          <Icon name="plus" size={12} />
          <span>New skill</span>
        </button>
      </div>
      <div className="cust-list">
        {loading && <div className="cust-empty">Loading…</div>}
        {!loading && skills.length === 0 && (
          <div className="cust-empty">
            No skills yet. Create one to teach Claude a reusable workflow.
          </div>
        )}
        {!loading &&
          skills.map((sk) => (
            <button
              key={`${sk.scope}:${sk.path}`}
              className="cust-row"
              onClick={() =>
                setEditing({ path: sk.path, name: sk.name })
              }
              title={sk.path}
            >
              <Icon name="file-text" size={13} />
              <span className="cust-row-name">{sk.name}</span>
              <span className="cust-row-tag">{sk.scope}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
