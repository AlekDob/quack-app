#!/usr/bin/env node
// Quack is a Tauri desktop app, not a Node-based CLI. This stub exists so
// the npm package has a working `bin` entry — `npx codetta` or
// `npm i -g codetta && codetta` print a friendly pointer to the real
// installer.

const VERSION = require("../package.json").version;

const msg = `
  ⌘  Quack ${VERSION}
  ─────────────────────────────────────────────────────────────

  Quack is a desktop application — it doesn't run from npm.

  Download the latest release:
    https://www.quack.build/

  Community:
    https://discord.com/invite/bQd39uDhnc
`;

process.stdout.write(msg + "\n");
