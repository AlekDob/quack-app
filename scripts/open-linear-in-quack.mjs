#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const prompt = process.env.LINEAR_PROMPT?.trim();

/** Reads the optional Linear-name -> Quack-project map. */
function readProjectMap() {
  try {
    const raw = readFileSync(join(homedir(), ".quack", "linear-projects.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function attributeFromPrompt(tag, text) {
  return new RegExp(`<${tag}\\s+name="([^"]+)"`, "u").exec(text)?.[1] ?? null;
}

/** Explicit env wins, then the Linear project name, then the team name, then "default". */
function resolveProject(text) {
  const explicit = process.env.QUACK_PROJECT?.trim();
  if (explicit) return explicit;
  const map = readProjectMap();
  const keys = [attributeFromPrompt("project", text), attributeFromPrompt("team", text), "default"];
  for (const key of keys) {
    if (key && typeof map[key] === "string" && map[key].trim()) return map[key].trim();
  }
  return null;
}

if (!prompt) {
  process.stderr.write("LINEAR_PROMPT is required.\n");
  process.exitCode = 1;
} else {
  const url = new URL("quack://open");
  url.searchParams.set("source", "linear");
  url.searchParams.set("prompt", prompt);
  const project = resolveProject(prompt);
  if (project) url.searchParams.set("project", project);

  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url.toString()]]
      : process.platform === "win32"
        ? [
            "powershell.exe",
            ["-NoProfile", "-Command", "Start-Process -FilePath $args[0]", url.toString()],
          ]
        : ["xdg-open", [url.toString()]];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}
