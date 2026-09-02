#!/usr/bin/env python3
"""Blocks commands that boot an iOS simulator outside Quack's DeviceManager.

Why: Quack never shuts down a device it did not boot itself (see
DeviceManager.releaseDevice / the synaraBooted set). A simulator started by
Simulator.app, expo or a raw `simctl boot` is owned by nobody and survives
every Quack restart, burning CPU unattributed - one was found up for 3 days at
~50% CPU (2026-08-21). Use the device pane / device_* tools instead.

PreToolUse hook: tool-call JSON on stdin, exit 2 = block. Matching is anchored
to the head of each command segment, so grepping *for* these strings (or
writing this file) is not itself blocked.
"""

import json
import re
import sys

BANNED = re.compile(
    r"""^\s*(?:sudo\s+)?(?:
          open\s+(?:-\w+\s+)*-a\s+['"]?Simulator
        | (?:npx\s+)?expo\s+run:ios
        | (?:npm|pnpm|bun|yarn)\s+(?:run\s+)?ios\b
        | (?:xcrun\s+)?simctl\s+boot\b
    )""",
    re.VERBOSE,
)

MESSAGE = (
    "Blocked: this boots a simulator Quack does not own, so nothing will ever "
    "shut it down (see CLAUDE.md). Use the device pane / device_* tools. "
    "To clean up strays: xcrun simctl shutdown all"
)

payload = json.load(sys.stdin)
command = (payload.get("tool_input") or {}).get("command") or ""
# Only the head of a segment is a command; everything after it is data.
for segment in re.split(r"(?:\|\||&&|[;\n|&])", command):
    if BANNED.search(segment):
        print(MESSAGE, file=sys.stderr)
        sys.exit(2)
