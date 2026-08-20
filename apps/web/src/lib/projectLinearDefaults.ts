// FILE: projectLinearDefaults.ts
// Purpose: Optional Linear team/project a Quack project points at, per machine.
// Layer: Web data access
// Kept in localStorage on purpose: it is a UI default, not project metadata the
// server or other machines need. Move it to `project.meta.update` if it ever
// has to sync.

const STORAGE_KEY = "synara:project-linear-defaults:v1";

export type ProjectLinearDefaults = {
  workspaceId: string;
  teamId: string;
  /** null = "no project", the Linear-side default. */
  projectId: string | null;
};

type Store = Record<string, ProjectLinearDefaults>;

function readStore(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

export function readProjectLinearDefaults(projectId: string): ProjectLinearDefaults | null {
  const entry = readStore()[projectId];
  return entry && entry.workspaceId && entry.teamId ? entry : null;
}

/** `null` clears the association. */
export function writeProjectLinearDefaults(
  projectId: string,
  value: ProjectLinearDefaults | null,
): void {
  const store = readStore();
  if (value === null) delete store[projectId];
  else store[projectId] = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked: the association is a convenience, not state to guard.
  }
}
