// Purpose: Validates prompt-bearing links from external coding tools.

import type { ExternalPromptRequest } from "@synara/contracts";

export const EXTERNAL_PROMPT_SCHEME = "quack";
export const MAX_EXTERNAL_PROMPT_BYTES = 32 * 1024;
export const MAX_EXTERNAL_PROJECT_BYTES = 1024;

export function parseExternalPromptLink(rawUrl: string): ExternalPromptRequest | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== `${EXTERNAL_PROMPT_SCHEME}:` || url.hostname !== "open") {
    return null;
  }

  try {
    decodeURIComponent(url.search);
  } catch {
    return null;
  }

  if (
    Array.from(url.searchParams.keys()).some(
      (key) => key !== "source" && key !== "prompt" && key !== "project",
    )
  ) {
    return null;
  }

  const sources = url.searchParams.getAll("source");
  const prompts = url.searchParams.getAll("prompt");
  if (sources.length !== 1 || sources[0] !== "linear" || prompts.length !== 1) {
    return null;
  }

  const prompt = prompts[0] ?? "";
  if (!prompt.trim() || Buffer.byteLength(prompt, "utf8") > MAX_EXTERNAL_PROMPT_BYTES) {
    return null;
  }

  const projects = url.searchParams.getAll("project");
  if (projects.length > 1) return null;
  const project = projects[0]?.trim() ?? "";
  if (Buffer.byteLength(project, "utf8") > MAX_EXTERNAL_PROJECT_BYTES) return null;

  return project ? { source: "linear", prompt, project } : { source: "linear", prompt };
}

export function findExternalPromptLink(
  commandLine: readonly string[],
): ExternalPromptRequest | null {
  for (const argument of commandLine) {
    const request = parseExternalPromptLink(argument);
    if (request) return request;
  }
  return null;
}
