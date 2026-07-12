// App-shipped Claude Code skills — always available in every workspace.
// Synced to `<workspace>/.claude/skills/<name>/SKILL.md` on load (see sync.ts).

import quackBrainMd from "./quack-brain.md?raw";
import quackWorksMd from "./quack-works.md?raw";

export const QUACK_BUNDLED_VERSION_FIELD = "quack-bundled-version";

export interface AppBundledSkill {
  dirName: string;
  content: string;
  version: number;
}

function bundledVersion(md: string): number {
  const m = md.match(/^---\n[\s\S]*?quack-bundled-version:\s*(\d+)/);
  return m ? Number.parseInt(m[1]!, 10) : 1;
}

/** Only two app skills — Works PM is merged into quack-works. */
export const APP_BUNDLED_SKILLS: AppBundledSkill[] = [
  {
    dirName: "quack-works",
    content: quackWorksMd,
    version: bundledVersion(quackWorksMd),
  },
  {
    dirName: "quack-brain",
    content: quackBrainMd,
    version: bundledVersion(quackBrainMd),
  },
];
