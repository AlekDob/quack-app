# Scripts

- `bun run dev` — Starts contracts, server, and web in `turbo watch` mode.
- `bun run dev:server` — Starts just the WebSocket server (uses Bun TypeScript execution).
- `bun run dev:web` — Starts just the Vite dev server for the web app.
- Dev commands default `SYNARA_HOME` to `~/.synara`, which keeps dev state under `~/.synara/dev`.
- Override server CLI-equivalent flags from root dev commands with `--`, for example:
  `bun run dev -- --home-dir ~/.synara-2`
- `bun run start` — Runs the production server (serves built web app as static files).
- `bun run build` — Builds contracts, web app, and server through Turbo.
- `bun run typecheck` — Strict TypeScript checks for all packages.
- `bun run test` — Runs workspace tests.
- `bun run dist:desktop:artifact -- --platform <mac|linux|win> --target <target> --arch <arch>` — Builds a desktop artifact for a specific platform/target/arch.
- `bun run dist:desktop:dmg` — Builds a shareable macOS `.dmg` into `./release`.
- `bun run dist:desktop:dmg:arm64` — Builds an Apple Silicon macOS `.dmg`.
- `bun run dist:desktop:dmg:x64` — Builds an Intel macOS `.dmg`.
- `bun run dist:desktop:linux` — Builds a Linux AppImage into `./release`.
- `bun run dist:desktop:win` — Builds a Windows NSIS installer into `./release`.
- `make mac-app` — Convenience target for local Apple Silicon builds: runs `bun install`, then `bun run dist:desktop:dmg:arm64`. Use this when you have Synara installed from a DMG and need a fresh local build that includes repo dependency updates (for example Pi SDK bumps). The installed `/Applications/Synara.app` does not pick up checkout changes until you rebuild and reinstall.

## Desktop `.dmg` packaging notes

- Default build is unsigned/not notarized for local sharing.
- The DMG build uses `assets/macos-icon-1024.png` as the production app icon source.
- Desktop production windows load the bundled UI from `synara://app/index.html` (not a `127.0.0.1` document URL).
- Desktop packaging includes `apps/server/dist` (the `synara` backend) and starts it on loopback with an auth token for WebSocket/API traffic.
- Your tester can still open it on macOS by right-clicking the app and choosing **Open** on first launch.
- To keep staging files for debugging package contents, run: `bun run dist:desktop:dmg -- --keep-stage`
- To allow code-signing/notarization when configured in CI/secrets, add: `--signed`.
- Windows `--signed` uses Azure Trusted Signing and expects:
  `AZURE_TRUSTED_SIGNING_ENDPOINT`, `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`,
  `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`, and `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`.
- Azure authentication env vars are also required (for example service principal with secret):
  `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.
- For day-to-day verification without replacing `/Applications/Synara.app`, prefer `bun run electron:dev` from the checkout. Use `make mac-app` when you specifically need an installable local DMG.

## Running multiple dev instances

Set `SYNARA_DEV_INSTANCE` to any value to deterministically shift all dev ports together.

- Default ports: server `3773`, web `5733`
- Shifted ports: `base + offset` (offset is hashed from `SYNARA_DEV_INSTANCE`)
- Example: `SYNARA_DEV_INSTANCE=branch-a bun run dev:desktop`

If you want full control instead of hashing, set `SYNARA_PORT_OFFSET` to a numeric offset.
