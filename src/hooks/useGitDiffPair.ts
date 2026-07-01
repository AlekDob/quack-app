import { useEffect, useState } from "react";
import {
  computeGitDiffPair,
  type GitDiffPair,
} from "../editorGitDiff";

export function useGitDiffPair(
  gitRoot: string | undefined,
  filePath: string | undefined,
  current: string,
): GitDiffPair | null {
  const [pair, setPair] = useState<GitDiffPair | null>(null);

  useEffect(() => {
    if (!gitRoot || !filePath) {
      setPair(null);
      return;
    }
    let alive = true;
    void computeGitDiffPair(gitRoot, filePath, current).then((next) => {
      if (alive) setPair(next);
    });
    return () => {
      alive = false;
    };
  }, [gitRoot, filePath, current]);

  return pair;
}
