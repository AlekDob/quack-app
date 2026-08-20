// FILE: linear/linearWorkspaces.ts
// Purpose: Add/remove Linear workspaces and migrate the legacy single-key secret.
// Layer: Server Linear settings

import {
  LINEAR_WORKSPACE_LABEL_MAX,
  LINEAR_WORKSPACE_LIMIT,
  type LinearServerSettings,
  type LinearWorkspace,
} from "@synara/contracts";
import { Effect } from "effect";

import type { SecretStoreError, ServerSecretStoreShape } from "../auth/Services/ServerSecretStore";
import { fetchLinearOrganization, type LinearWorkspaceKey } from "./linearClient";
import {
  readLinearApiKey,
  readLinearWorkspaceApiKey,
  writeLinearApiKey,
  writeLinearWorkspaceApiKey,
} from "./linearCredentials";

export type { LinearWorkspaceKey };

/** Shown when the old single-key secret exists but Linear did not return an org. */
export const LEGACY_LINEAR_WORKSPACE: LinearWorkspace = {
  id: "legacy",
  name: "Linear",
  urlKey: "linear",
};

export function setLinearWorkspaceLabel(
  workspace: LinearWorkspace,
  label: string,
): LinearWorkspace {
  const trimmed = label.trim().slice(0, LINEAR_WORKSPACE_LABEL_MAX);
  if (trimmed.length === 0 || trimmed === workspace.name) {
    if (workspace.label === undefined) return workspace;
    const { label: _removed, ...rest } = workspace;
    return rest;
  }
  return { ...workspace, label: trimmed };
}

export function renameLinearWorkspace(
  workspaces: ReadonlyArray<LinearWorkspace>,
  workspaceId: string,
  label: string,
): ReadonlyArray<LinearWorkspace> {
  const targetId = workspaces.some((workspace) => workspace.id === workspaceId)
    ? workspaceId
    : workspaces.length === 1 && workspaceId === LEGACY_LINEAR_WORKSPACE.id
      ? (workspaces[0]?.id ?? workspaceId)
      : workspaceId;
  return workspaces.map((workspace) =>
    workspace.id === targetId ? setLinearWorkspaceLabel(workspace, label) : workspace,
  );
}

export function linearSettingsView(
  workspaces: ReadonlyArray<LinearWorkspace>,
): LinearServerSettings {
  return {
    workspaces: [...workspaces],
    apiKeyConfigured: workspaces.length > 0,
  };
}

export const loadLinearWorkspaceKeys = (
  secrets: ServerSecretStoreShape,
  workspaces: ReadonlyArray<LinearWorkspace>,
): Effect.Effect<ReadonlyArray<LinearWorkspaceKey>, SecretStoreError> =>
  Effect.forEach(workspaces, (workspace) =>
    readLinearWorkspaceApiKey(secrets, workspace.id).pipe(
      Effect.map((apiKey) => (apiKey ? { workspace, apiKey } : null)),
    ),
  ).pipe(
    Effect.map((entries) => entries.filter((entry): entry is LinearWorkspaceKey => entry !== null)),
  );

export const requireLinearWorkspaceKeys = (
  secrets: ServerSecretStoreShape,
  workspaces: ReadonlyArray<LinearWorkspace>,
): Effect.Effect<ReadonlyArray<LinearWorkspaceKey>, SecretStoreError | Error> =>
  Effect.gen(function* () {
    const migrated = yield* migrateLegacyLinearApiKey(secrets, workspaces);
    const keys = yield* loadLinearWorkspaceKeys(secrets, migrated);
    if (keys.length > 0) return keys;
    const legacyKey = yield* readLinearApiKey(secrets);
    if (!legacyKey) {
      return yield* Effect.fail(new Error("Connect Linear in Settings first."));
    }
    return [{ workspace: LEGACY_LINEAR_WORKSPACE, apiKey: legacyKey }];
  });

export const migrateLegacyLinearApiKey = (
  secrets: ServerSecretStoreShape,
  workspaces: ReadonlyArray<LinearWorkspace>,
): Effect.Effect<ReadonlyArray<LinearWorkspace>, SecretStoreError> =>
  Effect.gen(function* () {
    if (workspaces.length > 0) return workspaces;
    const legacyKey = yield* readLinearApiKey(secrets);
    if (!legacyKey) return workspaces;
    const workspace = yield* Effect.tryPromise({
      try: () => fetchLinearOrganization(legacyKey),
      catch: (cause) =>
        cause instanceof Error ? cause : new Error("Linear workspace lookup failed."),
    }).pipe(Effect.catch(() => Effect.succeed(null)));
    const next = workspace ?? LEGACY_LINEAR_WORKSPACE;
    yield* writeLinearWorkspaceApiKey(secrets, next.id, legacyKey);
    yield* writeLinearApiKey(secrets, null);
    return [next];
  });

export const addLinearWorkspace = (
  secrets: ServerSecretStoreShape,
  workspaces: ReadonlyArray<LinearWorkspace>,
  apiKey: string,
  label?: string,
): Effect.Effect<ReadonlyArray<LinearWorkspace>, SecretStoreError | Error> =>
  Effect.gen(function* () {
    const current = yield* migrateLegacyLinearApiKey(secrets, workspaces);
    const workspace = yield* Effect.tryPromise({
      try: () => fetchLinearOrganization(apiKey),
      catch: (cause) =>
        cause instanceof Error ? cause : new Error("Linear workspace lookup failed."),
    });
    const legacyStoredKey = yield* readLinearWorkspaceApiKey(secrets, LEGACY_LINEAR_WORKSPACE.id);
    const existingIndex = current.findIndex(
      (entry) =>
        entry.id === workspace.id ||
        entry.urlKey === workspace.urlKey ||
        (legacyStoredKey === apiKey && entry.id === LEGACY_LINEAR_WORKSPACE.id),
    );
    if (existingIndex === -1 && current.length >= LINEAR_WORKSPACE_LIMIT) {
      return yield* Effect.fail(
        new Error(`Quack keeps at most ${LINEAR_WORKSPACE_LIMIT} Linear workspaces.`),
      );
    }
    yield* writeLinearWorkspaceApiKey(secrets, workspace.id, apiKey);
    const previous = existingIndex === -1 ? undefined : current[existingIndex];
    const base = previous?.label ? { ...workspace, label: previous.label } : workspace;
    const named = label !== undefined ? setLinearWorkspaceLabel(base, label) : base;
    if (existingIndex === -1) return [...current, named];
    const next = [...current];
    if (previous && previous.id !== workspace.id) {
      yield* writeLinearWorkspaceApiKey(secrets, previous.id, null);
    }
    next[existingIndex] = named;
    return next;
  });

export const removeLinearWorkspace = (
  secrets: ServerSecretStoreShape,
  workspaces: ReadonlyArray<LinearWorkspace>,
  workspaceId: string,
): Effect.Effect<ReadonlyArray<LinearWorkspace>, SecretStoreError> =>
  Effect.gen(function* () {
    yield* writeLinearWorkspaceApiKey(secrets, workspaceId, null);
    const next = workspaces.filter((workspace) => workspace.id !== workspaceId);
    if (workspaceId === LEGACY_LINEAR_WORKSPACE.id || next.length === 0) {
      yield* writeLinearApiKey(secrets, null);
    }
    return next;
  });
