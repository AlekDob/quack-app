// Purpose: Validates prompt-bearing links from external coding tools.

import type { ExternalPromptRequest } from "@synara/contracts";

export const EXTERNAL_PROMPT_SCHEME = "quack";
export const MAX_EXTERNAL_PROMPT_BYTES = 32 * 1024;

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

  if (Array.from(url.searchParams.keys()).some((key) => key !== "source" && key !== "prompt")) {
    return null;
  }

  const sources = url.searchParams.getAll("source");
  const prompts = url.searchParams.getAll("prompt");
  if (sources.length !== 1 || sources[0] !== "linear" || prompts.length !== 1) {
    return null;
  }

  const prompt = prompts[0];
  if (!prompt.trim() || Buffer.byteLength(prompt, "utf8") > MAX_EXTERNAL_PROMPT_BYTES) {
    return null;
  }

  return { source: "linear", prompt };
}

export function findExternalPromptLink(commandLine: readonly string[]): ExternalPromptRequest | null {
  for (const argument of commandLine) {
    const request = parseExternalPromptLink(argument);
    if (request) return request;
  }
  return null;
}
