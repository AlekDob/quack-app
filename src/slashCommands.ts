// Slash-command catalog for the AI chat input. The chat panel reads
// this list when the user types `/` to render an autocomplete menu and
// to dispatch the selected command.
//
// Pure data — no React, no closures over chat state. The chat panel
// supplies the runtime behaviour (rewriting input vs. firing an
// in-app action) by inspecting `prompt` / `action` on the entry it
// matched. Extracted from AIChatPanel so adding or tweaking the
// catalog doesn't require touching the giant file.

export interface SlashCommand {
  name: string;
  hint: string;
  /** When provided, the command rewrites the input to this prompt. */
  prompt?: string;
  /** When provided, runs an in-app action (clear, new, etc.). */
  action?:
    | "new"
    | "clear"
    | "tree"
    | "terminal"
    | "file"
    | "usage"
    | "effort"
    | "mode"
    | "thinking";
  /** Whether the user is expected to type an argument after the name. */
  takesArg?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/explain",
    hint: "Explain what this code does",
    prompt: "Explain what this code does, step by step.",
  },
  {
    name: "/bugs",
    hint: "Find bugs or logic errors",
    prompt:
      "Are there bugs or logic errors here? Be specific and reference line numbers if possible.",
  },
  {
    name: "/refactor",
    hint: "Suggest a refactor",
    prompt:
      "Suggest a refactor that improves readability or correctness. Show the proposed change.",
  },
  {
    name: "/tests",
    hint: "Write unit tests",
    prompt: "Suggest unit tests for the functions here. Show example test code.",
  },
  {
    name: "/types",
    hint: "Improve type annotations",
    prompt: "Suggest type annotations or improvements to existing types.",
  },
  {
    name: "/docs",
    hint: "Add JSDoc / docstrings",
    prompt:
      "Add concise JSDoc/docstring comments for the exported functions and types.",
  },
  {
    name: "/summary",
    hint: "Summarize this code",
    prompt: "Summarize the responsibilities of this code in 3-5 bullets.",
  },
  {
    name: "/tree",
    hint: "Attach project file tree to the next message",
    action: "tree",
  },
  {
    name: "/file",
    hint: "/file <path> — attach a specific file's contents",
    action: "file",
    takesArg: true,
  },
  {
    name: "/terminal",
    hint: "Attach the active terminal's output",
    action: "terminal",
  },
  { name: "/new", hint: "Start a new chat", action: "new" },
  { name: "/clear", hint: "Clear current chat", action: "clear" },
  {
    name: "/usage",
    hint: "Claude account + local AI usage report",
    action: "usage",
  },
  {
    name: "/effort",
    hint: "/effort low|medium|high|xhigh|max — Claude Code reasoning effort",
    action: "effort",
    takesArg: true,
  },
  {
    name: "/mode",
    hint: "/mode ask|plan|auto-edit|auto|agent — Claude Code permission mode",
    action: "mode",
    takesArg: true,
  },
  {
    name: "/thinking",
    hint: "Toggle Claude Code extended thinking",
    action: "thinking",
    takesArg: true,
  },
];
