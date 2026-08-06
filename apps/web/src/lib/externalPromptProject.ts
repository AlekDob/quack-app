// FILE: externalPromptProject.ts
// Purpose: Maps the optional `project` hint of a quack://open link to a real Quack project.
// Layer: Web orchestration helper
// Exports: resolveExternalPromptProjectId

import type { ProjectId } from "@synara/contracts";
import type { Project } from "../types";

function normalize(value: string): string {
  return value.trim().replace(/\/+$/u, "").toLowerCase();
}

/**
 * Accepts a project id, a project name (or its local/folder name), or an absolute
 * workspace path. Returns null when the hint matches nothing.
 */
export function resolveExternalPromptProjectId(
  projects: readonly Project[],
  hint: string | undefined,
): ProjectId | null {
  const needle = hint ? normalize(hint) : "";
  if (!needle) return null;

  const match =
    projects.find((project) => project.id === hint) ??
    projects.find((project) => normalize(project.cwd) === needle) ??
    projects.find((project) =>
      [project.name, project.localName, project.folderName, project.remoteName].some(
        (candidate) => typeof candidate === "string" && normalize(candidate) === needle,
      ),
    );

  return match?.id ?? null;
}
