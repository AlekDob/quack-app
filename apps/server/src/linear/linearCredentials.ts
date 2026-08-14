// FILE: linear/linearCredentials.ts
// Purpose: Owns the Linear personal API key secret (never stored in settings.json).
// Layer: Server security boundary

import { Effect } from "effect";

import type { SecretStoreError, ServerSecretStoreShape } from "../auth/Services/ServerSecretStore";

const SECRET_NAME = "linear-api-key";

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

export const readLinearApiKey = (
  secrets: ServerSecretStoreShape,
): Effect.Effect<string | null, SecretStoreError> =>
  secrets.get(SECRET_NAME).pipe(
    Effect.map((value) => {
      if (!value || value.byteLength === 0) return null;
      const key = decoder.decode(value).trim();
      return key.length > 0 ? key : null;
    }),
  );

export const writeLinearApiKey = (
  secrets: ServerSecretStoreShape,
  apiKey: string | null,
): Effect.Effect<void, SecretStoreError> => {
  const normalized = apiKey?.trim() ?? "";
  return normalized.length > 0
    ? secrets.set(SECRET_NAME, encoder.encode(normalized))
    : secrets.remove(SECRET_NAME);
};

export const isLinearApiKeyConfigured = (
  secrets: ServerSecretStoreShape,
): Effect.Effect<boolean, SecretStoreError> =>
  readLinearApiKey(secrets).pipe(Effect.map((key) => key !== null));
