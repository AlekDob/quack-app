# Quack

Quack is a soft-fork of [Synara](https://github.com/Emanuele-web04/synara): Quack branding on the surface, Synara engine kept mergeable with upstream. Synara is itself a fork of [T3.Chat](https://t3.gg/) by Theo Browne.

See [docs/quack-soft-fork.md](./docs/quack-soft-fork.md) for remotes, sync workflow, and what to rebrand vs leave alone.

Quack is a local-first desktop workspace for coding with the AI agents and subscriptions you already use.

It brings chats, terminals, browser previews, diffs, branches, provider sessions, and handoffs into one focused workspace so you can run agent work without juggling a dozen windows.

![Quack app showing parallel agent threads, terminal output, and project navigation](assets/prod/readme-screenshot.jpeg)

## What it does

- Use the AI accounts you already pay for: Claude Code, Codex, Antigravity, OpenCode, Cursor, Grok, Kilo Code, and Pi.
- Run parallel work across projects, threads, and isolated Git worktrees without branches stepping on each other.
- Keep split chats, terminals, browser previews, and agent output visible in the same window.
- Hand off a thread to another provider when you want a second model to pick up with the same context.
- Review diffs, create branches, commit, push, and open PRs from the app.
- Keep your workspace local. Quack stores chats, projects, and history on your machine and talks directly to the providers you choose.

## How to use

> [!WARNING]
> You need to have [Codex CLI](https://github.com/openai/codex) installed and authorized for Codex sessions to work.

Run Quack locally:

```sh
bun install
bun run dev
```

## Privacy

Quack runs as the workspace layer on your machine. There is no Quack cloud holding your repositories, chats, or project history.

The provider you choose still receives the prompts, file snippets, diffs, terminal output, or tool results needed for a session, but that traffic goes to the provider you picked rather than through a separate Quack-hosted workspace.

Telemetry is off. Nothing is sent anywhere unless you turn it on and point it at
your own PostHog project:

```sh
SYNARA_TELEMETRY_ENABLED=true SYNARA_POSTHOG_KEY=phc_your_own_key quack
```

Without both variables the analytics layer stays silent.

## Linear

Open Linear issues as unsent Quack drafts: [setup guide](./docs/linear-coding-tools.md).

## Some notes

This soft-fork is still early. Expect bugs, rough edges, and fast-moving internals.

## Origins

Built on Synara, which began as a clone of [T3Code](https://github.com/pingdotgg/t3code). Synara’s runtime, packages, and MCP surface stay Synara-shaped so upstream merges remain practical.

### Quack soft-fork (this checkout)

This local tree (`quack-20`) ships Quack branding while keeping the Synara engine. Details: [docs/quack-soft-fork.md](./docs/quack-soft-fork.md).
