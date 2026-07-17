// Map a qualified model id like "claude-code:default" or "openai:gpt-4o"
// to a 2-char provider badge + tooltip-friendly model name. Shared by the
// agent-mode sessions list; extracted here because it used to be copy-
// pasted verbatim into AIChatsRail and AgentModeShell (the global Agent
// Hub now shows a project badge instead, but AgentModeShell still uses it).
export function modelBadge(model: string | undefined): {
  short: string;
  className: string;
  full: string;
} {
  if (!model)
    return { short: "··", className: "badge-none", full: "No model selected" };
  const colon = model.indexOf(":");
  const provider = colon > 0 ? model.slice(0, colon) : model;
  const id = colon > 0 ? model.slice(colon + 1) : "";
  switch (provider) {
    case "claude-code":
      return {
        short: "CC",
        className: "badge-claude-code",
        full: `Claude Code · ${id || "default"}`,
      };
    case "cursor-cli":
      return {
        short: "CU",
        className: "badge-cursor-cli",
        full: `Cursor CLI · ${id || "default"}`,
      };
    case "anthropic":
      return {
        short: "Cl",
        className: "badge-anthropic",
        full: `Anthropic API · ${id}`,
      };
    case "openai":
      return { short: "AI", className: "badge-openai", full: `OpenAI · ${id}` };
    case "ollama":
      return { short: "OL", className: "badge-ollama", full: `Ollama · ${id}` };
    default:
      return {
        short: provider.slice(0, 2).toUpperCase(),
        className: "badge-other",
        full: model,
      };
  }
}
