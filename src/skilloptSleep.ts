import { invoke } from "@tauri-apps/api/core";
import type { SkillOptRunResult, SkillOptSleepStatus } from "./quackStore/types";

export type { SkillOptSleepStatus, SkillOptRunResult };

/** Parse skillopt-sleep CLI text — avoids false positives on "no staged proposals". */
export function parseSkillOptOutput(raw: string): SkillOptSleepStatus {
  const lower = raw.toLowerCase();
  const noProposal =
    lower.includes("no staged proposal") ||
    lower.includes("no proposal") ||
    lower.includes("nothing staged");
  const path = extractSkillPath(raw);
  const hasProposal =
    !noProposal &&
    (path !== null ||
      lower.includes("staged proposal:") ||
      lower.includes("proposal ready") ||
      lower.includes("pending proposal"));
  return {
    available: true,
    has_proposal: hasProposal,
    proposal_summary: hasProposal ? firstNonEmptyLine(raw) : null,
    proposal_skill_path: path,
    proposal_body: hasProposal && raw.trim().length > 80 ? raw : null,
    raw_output: raw,
  };
}

function firstNonEmptyLine(raw: string): string {
  const line = raw.split("\n").find((l) => l.trim().length > 0);
  return line?.trim() ?? "";
}

function extractSkillPath(raw: string): string | null {
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t.includes("SKILL.md") || t.includes(".claude/skills")) return t;
  }
  return null;
}

export const skilloptSleep = {
  status: () => invoke<SkillOptSleepStatus>("skillopt_sleep_status"),
  dryRun: () => invoke<SkillOptRunResult>("skillopt_sleep_dry_run"),
  adopt: () => invoke<SkillOptRunResult>("skillopt_sleep_adopt"),
};
