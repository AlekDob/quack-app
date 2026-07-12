import type { QuackExtension } from "./types";

/** Curated Quack Store catalog — static, versioned in repo. */
export const QUACK_EXTENSIONS: QuackExtension[] = [
  {
    id: "pinky-brain",
    name: "Knowledge Search",
    tagline: "Hybrid BM25 + vector search over project docs",
    description:
      "Indexes documentation/ into a local brain.db, injects top hits into chat turns, and lets Jack propose saves for hard-won gotchas.",
    category: "brain",
    icon: "brain",
    tint: "knowledge",
    detect: { command: "pinky" },
    install: [
      { kind: "cargo", crate: "pinky" },
      { kind: "external", url: "https://pinkybrain.dev" },
    ],
    docsUrl: "https://pinkybrain.dev",
    uiSurfaces: [
      { kind: "brain-segment", id: "knowledge", label: "Knowledge" },
      { kind: "chat-chip", id: "brain-save" },
      { kind: "composer-inject", id: "brain-inject" },
    ],
  },
  {
    id: "skill-trainer",
    name: "Skill Trainer",
    tagline: "Nightly skill optimization from your sessions",
    description:
      "Runs SkillOpt-Sleep to harvest Claude Code transcripts, mine recurring tasks, and stage validated SKILL.md proposals for your review.",
    category: "brain",
    icon: "zap",
    tint: "skills",
    detect: { command: "skillopt-sleep" },
    install: [
      { kind: "pip", package: "skillopt" },
      {
        kind: "external",
        url: "https://github.com/microsoft/SkillOpt/blob/main/docs/sleep/README.md",
      },
    ],
    docsUrl:
      "https://github.com/microsoft/SkillOpt/blob/main/docs/sleep/README.md",
    uiSurfaces: [
      { kind: "brain-segment", id: "skills", label: "Skills" },
      { kind: "chat-chip", id: "skill-proposal" },
    ],
  },
];

export function extensionById(id: string): QuackExtension | undefined {
  return QUACK_EXTENSIONS.find((e) => e.id === id);
}

export function brainSegmentExtensions(
  installed: Set<string>,
): { id: string; label: string; extId: string }[] {
  const out: { id: string; label: string; extId: string }[] = [];
  for (const ext of QUACK_EXTENSIONS) {
    if (!installed.has(ext.id)) continue;
    for (const s of ext.uiSurfaces) {
      if (s.kind === "brain-segment") {
        out.push({ id: s.id, label: s.label, extId: ext.id });
      }
    }
  }
  return out;
}
