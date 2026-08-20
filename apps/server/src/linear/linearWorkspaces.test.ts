import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerSecretStoreShape } from "../auth/Services/ServerSecretStore";
import { LEGACY_LINEAR_API_KEY_SECRET, linearApiKeySecretName } from "./linearCredentials";
import {
  addLinearWorkspace,
  LEGACY_LINEAR_WORKSPACE,
  migrateLegacyLinearApiKey,
  renameLinearWorkspace,
} from "./linearWorkspaces";

vi.mock("./linearClient", () => ({
  fetchLinearOrganization: vi.fn(),
}));

import { fetchLinearOrganization } from "./linearClient";

const fetchOrg = vi.mocked(fetchLinearOrganization);

function memorySecrets(initial: Record<string, string> = {}): ServerSecretStoreShape {
  const map = new Map<string, Uint8Array>(
    Object.entries(initial).map(([name, value]) => [name, new TextEncoder().encode(value)]),
  );
  return {
    get: (name) => Effect.succeed(map.get(name) ?? null),
    set: (name, value) =>
      Effect.sync(() => {
        map.set(name, value);
      }),
    getOrCreateRandom: (name, bytes) =>
      Effect.sync(() => {
        const existing = map.get(name);
        if (existing) return existing;
        const created = new Uint8Array(bytes);
        map.set(name, created);
        return created;
      }),
    remove: (name) =>
      Effect.sync(() => {
        map.delete(name);
      }),
  };
}

const ORG = { id: "org-1", name: "Alek", urlKey: "alekdob" };
const ORG_2 = { id: "org-2", name: "Esopo", urlKey: "esopo" };

describe("linearWorkspaces", () => {
  beforeEach(() => {
    fetchOrg.mockReset();
  });

  it("keeps a visible workspace when the legacy key cannot look up an org", async () => {
    fetchOrg.mockRejectedValue(new Error("offline"));
    const secrets = memorySecrets({ [LEGACY_LINEAR_API_KEY_SECRET]: "old-key" });

    const workspaces = await Effect.runPromise(migrateLegacyLinearApiKey(secrets, []));

    expect(workspaces).toEqual([LEGACY_LINEAR_WORKSPACE]);
    expect(await Effect.runPromise(secrets.get(LEGACY_LINEAR_API_KEY_SECRET))).toBeNull();
    expect(
      new TextDecoder().decode(
        (await Effect.runPromise(secrets.get(linearApiKeySecretName("legacy")))) ??
          new Uint8Array(),
      ),
    ).toBe("old-key");
  });

  it("promotes the legacy key before adding a second workspace", async () => {
    fetchOrg.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(ORG_2);
    const secrets = memorySecrets({ [LEGACY_LINEAR_API_KEY_SECRET]: "old-key" });

    const workspaces = await Effect.runPromise(addLinearWorkspace(secrets, [], "new-key"));

    expect(workspaces).toEqual([LEGACY_LINEAR_WORKSPACE, ORG_2]);
  });

  it("replaces the placeholder when the same key later resolves to an org", async () => {
    fetchOrg.mockResolvedValue(ORG);
    const secrets = memorySecrets({
      [linearApiKeySecretName("legacy")]: "same-key",
    });

    const workspaces = await Effect.runPromise(
      addLinearWorkspace(secrets, [LEGACY_LINEAR_WORKSPACE], "same-key"),
    );

    expect(workspaces).toEqual([ORG]);
    expect(await Effect.runPromise(secrets.get(linearApiKeySecretName("legacy")))).toBeNull();
  });

  it("stores a user label when adding a workspace", async () => {
    fetchOrg.mockResolvedValue(ORG_2);
    const secrets = memorySecrets();

    const workspaces = await Effect.runPromise(
      addLinearWorkspace(secrets, [], "new-key", "Lavoro"),
    );

    expect(workspaces).toEqual([{ ...ORG_2, label: "Lavoro" }]);
  });

  it("keeps a user label when the placeholder later resolves to an org", async () => {
    fetchOrg.mockResolvedValue(ORG);
    const secrets = memorySecrets({
      [linearApiKeySecretName("legacy")]: "same-key",
    });

    const workspaces = await Effect.runPromise(
      addLinearWorkspace(secrets, [{ ...LEGACY_LINEAR_WORKSPACE, label: "Casa" }], "same-key"),
    );

    expect(workspaces).toEqual([{ ...ORG, label: "Casa" }]);
  });

  it("renames a workspace and clears the label when it matches Linear's name", () => {
    const named = renameLinearWorkspace([ORG], "org-1", "Casa");
    expect(named).toEqual([{ ...ORG, label: "Casa" }]);
    expect(renameLinearWorkspace(named, "org-1", "Alek")).toEqual([ORG]);
  });
});
