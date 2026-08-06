#!/usr/bin/env node
import { spawn } from "node:child_process";

const prompt = process.env.LINEAR_PROMPT?.trim();
if (!prompt) {
  process.stderr.write("LINEAR_PROMPT is required.\n");
  process.exitCode = 1;
} else {
  const url = new URL("quack://open");
  url.searchParams.set("source", "linear");
  url.searchParams.set("prompt", prompt);

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
