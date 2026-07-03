# Contributing to Codetta

Thanks for considering a contribution. Codetta aims to stay **small, fast,
and focused** — please read the scope statement below before opening a
large PR, so we don't have to ask you to scope it down after the fact.

## Scope statement (what we say no to)

Codetta deliberately does **not** plan to add:

- A full extension/plugin system (use VS Code if you need that)
- Language Server Protocol (LSP) — Monaco's built-in IntelliSense is
  what we ship; per-language servers are out of scope
- An integrated debugger
- Telemetry, analytics, or phone-home features of any kind
- Built-in cloud sync or account systems

We DO accept:

- Editor UX improvements (keybindings, tab management, splits, search)
- AI panel improvements and additional providers
- Terminal / PTY improvements
- Git integration features
- Multi-platform polish (macOS / Linux parity)
- Performance work
- Bug fixes — always welcome

If you're not sure something fits, **open an issue first** rather than a
large PR.

## Getting set up

```bash
git clone https://github.com/getcodetta/codetta.git
cd codetta
npm install
npm run tauri dev
```

You need Node 18+ and the Rust toolchain. See the [README's developer
section](README.md#develop--build-from-source) for full prerequisites.

## Branch + commit style

> **This fork (`AlekDob/quack-app`):** integrate desktop work on local `main`, push to
> **`origin/quack-1.0`** — not `origin/main`. See
> `documentation/decisions/003-git-remote-quack-1.0.md`.

- Branch off `main` (local). Name branches by topic: `feat/popout-redock`,
  `fix/ai-stop-button`, `docs/install-instructions`.
- Use the [Developer Certificate of Origin](https://developercertificate.org/)
  by signing your commits: `git commit -s -m "your message"`. We don't
  require a CLA — DCO sign-off is enough.
- Keep commits focused; one logical change per commit when reasonable.
- Write commit messages that explain the *why*, not just the *what*. The
  diff already shows the what.

## Pull requests

- Open against `main` (upstream Codetta). **This fork:** open against **`quack-1.0`** for desktop work.
- Include a short description of what changed and why.
- If the change is user-visible, mention how to test it (e.g. "open AI
  panel, type a message, hit Esc — stream should stop").
- CI must pass. Cross-platform build matrix runs on each PR — check the
  Actions tab if anything fails.
- For UI changes, a screenshot or short clip helps reviewers.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). The
key things we need:

- OS + version
- Codetta version (Help → About, or `codetta --version`)
- Reproduction steps — even three short bullets is enough
- What you expected vs what happened

## Reporting security issues

Don't open a public issue. Email `getcodetta@gmail.com` with details.
We'll respond within a week. After a fix is shipped, we'll credit you in
the release notes (unless you'd rather stay anonymous).

## Code style

- TypeScript: existing config + Prettier defaults. Run `npm run build`
  before pushing — it type-checks the whole frontend.
- Rust: `cargo fmt` before pushing.
- Don't reformat files you didn't touch — it makes diffs unreviewable.

## License

By submitting a contribution you agree to license it under the project's
[MIT License](LICENSE).
