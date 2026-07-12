/** Quack Store extension contract — external CLI + Quack UI surfaces. */

import type { IconName } from "../components/Icon";

export type InstallMethod =
  | { kind: "pip"; package: string }
  | { kind: "cargo"; crate: string }
  | { kind: "external"; url: string }
  | { kind: "quack-setup"; ipc: string };

export type UiSurface =
  | { kind: "brain-segment"; id: string; label: string }
  | { kind: "chat-chip"; id: string }
  | { kind: "composer-inject"; id: string };

export type StoreTint = "knowledge" | "skills";

export interface QuackExtension {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: "brain" | "agent" | "integration";
  icon: IconName;
  tint: StoreTint;
  detect: { command: string };
  install: InstallMethod[];
  docsUrl: string;
  requires?: string[];
  uiSurfaces: UiSurface[];
}

export interface ExtensionStatus {
  id: string;
  installed: boolean;
  version: string | null;
  workspace_ready: boolean | null;
}

export interface InstallResult {
  ok: boolean;
  message: string;
  manual_command: string | null;
}

export interface SkillOptSleepStatus {
  available: boolean;
  has_proposal: boolean;
  proposal_summary: string | null;
  proposal_skill_path: string | null;
  proposal_body: string | null;
  raw_output: string | null;
}

export interface SkillOptRunResult {
  ok: boolean;
  output: string;
}
