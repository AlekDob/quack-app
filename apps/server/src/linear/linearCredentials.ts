// FILE: linear/linearCredentials.ts
// Purpose: Owns Linear personal API keys in the secret store (never settings.json).
// Layer: Server security boundary

import { Effect } from "effect";

import type { SecretStoreError, ServerSecretStoreShape } from "../auth/Services/ServerSecretStore";

export const LEGACY_LINEAR_API_KEY_SECRET = "linear-api-key";

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

export function linearApiKeySecretName(workspaceId: string): string {
  return `${LEGACY_LINEAR_API_KEY_SECRET}:${workspaceId}`;
}

function decodeSecret(value: Uint8Array | null): string | null {
  if (!value || value.byteLength === 0) return null;
  const key = decoder.decode(value).trim();
  return key.length > 0 ? key : null;
}

export const readSecretString = (
  secrets: ServerSecretStoreShape,
  name: string,
): Effect.Effect<string | null, SecretStoreError> =>
  secrets.get(name).pipe(Effect.map(decodeSecret));

export const writeSecretString = (
  secrets: ServerSecretStoreShape,
  name: string,
  value: string | null,
): Effect.Effect<void, SecretStoreError> => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0
    ? secrets.set(name, encoder.encode(normalized))
    : secrets.remove(name);
};

export const readLinearApiKey = (
  secrets: ServerSecretStoreShape,
): Effect.Effect<string | null, SecretStoreError> =>
  readSecretString(secrets, LEGACY_LINEAR_API_KEY_SECRET);

export const writeLinearApiKey = (
  secrets: ServerSecretStoreShape,
  apiKey: string | null,
): Effect.Effect<void, SecretStoreError> =>
  writeSecretString(secrets, LEGACY_LINEAR_API_KEY_SECRET, apiKey);

export const readLinearWorkspaceApiKey = (
  secrets: ServerSecretStoreShape,
  workspaceId: string,
): Effect.Effect<string | null, SecretStoreError> =>
  readSecretString(secrets, linearApiKeySecretName(workspaceId));

export const writeLinearWorkspaceApiKey = (
  secrets: ServerSecretStoreShape,
  workspaceId: string,
  apiKey: string | null,
): Effect.Effect<void, SecretStoreError> =>
  writeSecretString(secrets, linearApiKeySecretName(workspaceId), apiKey);

export const isLinearApiKeyConfigured = (
  secrets: ServerSecretStoreShape,
): Effect.Effect<boolean, SecretStoreError> =>
  readLinearApiKey(secrets).pipe(Effect.map((key) => key !== null));
