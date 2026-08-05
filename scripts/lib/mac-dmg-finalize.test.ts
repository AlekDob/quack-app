import { describe, expect, it } from "vitest";

import {
  buildMacDmgFinalizationCommands,
  resolveSingleMacDmgFileName,
} from "./mac-dmg-finalize.ts";

const credentials = {
  appleApiKey: "/tmp/AuthKey_TEST.p8",
  appleApiKeyId: "KEY123",
  appleApiIssuer: "issuer-123",
} as const;

describe("macOS DMG finalization", () => {
  it("requires exactly one DMG artifact", () => {
    expect(resolveSingleMacDmgFileName(["Synara-0.6.0-arm64.zip", "Synara-0.6.0-arm64.dmg"])).toBe(
      "Synara-0.6.0-arm64.dmg",
    );
    expect(() => resolveSingleMacDmgFileName([])).toThrow("found 0");
    expect(() => resolveSingleMacDmgFileName(["a.dmg", "b.dmg"])).toThrow("found 2");
  });

  it("sign-checks, notarizes, staples, and validates the final DMG in order", () => {
    const dmgPath = "/tmp/Synara-0.6.0-arm64.dmg";
    const commands = buildMacDmgFinalizationCommands(dmgPath, credentials);

    expect(commands.map(({ command, args }) => [command, args[0], args[1]])).toEqual([
      ["codesign", "--verify", "--strict"],
      ["xcrun", "notarytool", "submit"],
      ["xcrun", "stapler", "staple"],
      ["codesign", "--verify", "--strict"],
      ["spctl", "--assess", "--type"],
      ["xcrun", "stapler", "validate"],
    ]);
    expect(commands[1]?.args).toEqual([
      "notarytool",
      "submit",
      dmgPath,
      "--key",
      credentials.appleApiKey,
      "--key-id",
      credentials.appleApiKeyId,
      "--issuer",
      credentials.appleApiIssuer,
      "--wait",
    ]);
  });

  it("notarizes with Apple ID credentials when no API key is provided", () => {
    const commands = buildMacDmgFinalizationCommands("/tmp/Synara.dmg", {
      appleId: "dev@example.com",
      applePassword: "abcd-efgh-ijkl-mnop",
      appleTeamId: "TEAM12345",
    });

    expect(commands[1]?.args).toEqual([
      "notarytool",
      "submit",
      "/tmp/Synara.dmg",
      "--apple-id",
      "dev@example.com",
      "--password",
      "abcd-efgh-ijkl-mnop",
      "--team-id",
      "TEAM12345",
      "--wait",
    ]);
  });

  it("fails closed when Apple notarization credentials are unavailable", () => {
    expect(() => buildMacDmgFinalizationCommands("/tmp/Synara.dmg", {})).toThrow(
      "requires APPLE_API_KEY",
    );
  });

  it("fails closed when an auth mode is incomplete", () => {
    expect(() =>
      buildMacDmgFinalizationCommands("/tmp/Synara.dmg", { appleId: "dev@example.com" }),
    ).toThrow("requires APPLE_APP_SPECIFIC_PASSWORD");
  });
});
