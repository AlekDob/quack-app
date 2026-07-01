import { git as gitApi } from "./ipc";

export interface GitDiffPair {
  original: string;
  modified: string;
}

function relPathInRepo(gitRoot: string, absPath: string): string | null {
  const root = gitRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const norm = absPath.replace(/\\/g, "/");
  if (!norm.startsWith(root + "/")) return null;
  return norm.slice(root.length + 1);
}

/** HEAD vs working buffer. Null when outside repo or no git changes. */
export async function computeGitDiffPair(
  gitRoot: string,
  absPath: string,
  current: string,
): Promise<GitDiffPair | null> {
  const rel = relPathInRepo(gitRoot, absPath);
  if (!rel) return null;
  try {
    const original = await gitApi.show(gitRoot, "HEAD", rel);
    if (original === current) return null;
    return { original, modified: current };
  } catch {
    return null;
  }
}
