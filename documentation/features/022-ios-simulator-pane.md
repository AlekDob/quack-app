---
type: feature-doc
project: synara
stack: React / TypeScript / Swift (macOS)
created: 2026-08-11
last_verified: 2026-08-11
status: active
tags: [device, ios, simulator, dock-pane, agent-gateway, webcodecs]
---

## iOS Simulator Pane

**Purpose:** A dock pane that mirrors a booted iOS Simulator inside Quack and lets both the user and the agent drive it — tap, swipe, type, install, launch — without ever opening `Simulator.app`.
**Stack:** React / TypeScript (web), Node + Effect (server), Swift/ObjC helper binary (macOS only)

### Files

| Type      | Path                                             | Exports/Purpose                                                     |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Contracts | `packages/contracts/src/device.ts`               | Device schemas, `ThreadDeviceState`, frame envelope                 |
| Contracts | `packages/contracts/src/rpc.ts`, `ws.ts`         | The 17 device RPC methods and WS channels                           |
| Server    | `apps/server/src/device/DeviceManager.ts`        | Thread-scoped attachment, versioned state, boot cap, shutdown rules |
| Server    | `apps/server/src/device/IosSimulatorBackend.ts`  | Drives simulators through `simctl` + the native helper              |
| Server    | `apps/server/src/device/FakeDeviceBackend.ts`    | Deterministic backend for tests                                     |
| Server    | `apps/server/src/device/helperClient.ts`         | JSON-RPC over stdio + frame socket to the helper                    |
| Server    | `apps/server/src/device/deviceFrameTransport.ts` | Fans encoded frames to WS clients, bounded queues                   |
| Server    | `apps/server/src/agentGateway/deviceTools.ts`    | The 11 `device_*` MCP tools                                         |
| Native    | `apps/server/native/device-helper/`              | Swift/ObjC helper; built on the user's Xcode via `build.sh`         |
| Web       | `apps/web/src/components/DevicePanel.tsx`        | The pane                                                            |
| Web       | `apps/web/src/components/DevicePanel.logic.ts`   | Frame gate, canvas→device mapping, gesture classification           |
| Web       | `apps/web/src/components/device/DeviceFrame.tsx` | WebCodecs decoder + canvas                                          |
| Web       | `apps/web/src/deviceStateStore.ts`               | Version-gated per-thread device state                               |

### Data Flow

- The helper grabs frames from CoreSimulator and pushes H.264 over its own Unix socket, never over the RPC pipe. A burst of video can't delay a command.
- The server relays those frames on a dedicated binary WebSocket, with bounded per-client queues and keyframe-aligned drops.
- The browser decodes with WebCodecs into a canvas, deriving the `avc1` codec string from the SPS instead of hardcoding a profile.
- Clicks become taps, drags become swipes, focused keys become HID events. `Simulator.app` hardware chords are matched before passthrough, so Cmd+W still belongs to Quack.

### Agent control

- Eleven `device_*` tools on the existing per-session gateway, gated on a new `device:control` capability granted next to browser control. No second MCP server.
- `device_open_url` always needs approval. Every input tool is refused outright for providers with no approval gate (Antigravity runs `--dangerously-skip-permissions`). Read tools stay open.
- `DeviceService` is platform-gated: off macOS the agent never sees the tools at all.

### Platform gate

macOS only, and specifically a macOS _server_ — the pane works fine in a plain browser tab as long as there's a Mac on the other end. The add-menu entry and the `device.toggle` shortcut only light up when the server reports `darwin`.

The helper is not shipped as a binary. Source lives in-repo and compiles with the user's own Xcode, because the private API surface moves with the toolchain. The build is cached under `~/Library/Caches/synara/device-helper/<xcode-build>/`.

### What we changed against upstream

Imported from upstream `467d2f218` (#529). Four files conflicted, all resolved in favour of our fork:

- `harnessPolicy.ts` — kept Quack branding and our OAuth-popup wording, added the device guidance with "Synara" rewritten to "Quack", bumped the policy version to `2026-08-11.1`.
- `icons.tsx` — kept our Tabler globe; took only the `Device*` glyphs.
- `shortcutsSheet.ts` — took `device.toggle`, dropped the `thread.copyId` entry that belongs to a commit we haven't imported.
- `wsNativeApi.ts` — plain import merge.
- `serverLayers.device.test.ts` — our `ThreadId` is branded, upstream's is a plain string; added the cast.

### Out of scope (deliberately not built)

- Real devices. Simulators only.
- Building the app for you — the agent runs `xcodebuild` itself, then `device_install`.
- Windows and Linux servers.
