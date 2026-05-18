/**
 * Curated Codex model identifiers for the Codex-backend model picker.
 *
 * Codex CLI has NO model-discovery endpoint (`codex models` does not exist)
 * and availability is gated by the user's OpenAI account/plan — so this list
 * is intentionally short and anchored to TEXTUAL EVIDENCE only (no invented
 * ids; lesson from the 0.42→0.130 version-pinning incident):
 *   - `gpt-5-codex`  — the default, observed in every live 0.130 spike
 *   - `gpt-5`        — OpenAI flagship, accepted by `codex -m`
 *   - `gpt-5.5`      — used verbatim in developers.openai.com/codex config-reference
 *   - `o3`           — used verbatim in `codex --help` (`-c model="o3"`)
 *
 * Anything else is reachable via the free-text override in the picker. The
 * value is passed straight to `codex exec -c model=<id>`; an id the account
 * cannot access fails at runtime (surfaced as a Codex error event).
 *
 * Brain: pattern-backend-capability-gated-ui
 */
export const CODEX_DEFAULT_MODEL = 'gpt-5-codex';

export interface CodexModelOption {
  id: string;
  label: string;
}

export const CURATED_CODEX_MODELS: CodexModelOption[] = [
  { id: 'gpt-5-codex', label: 'gpt-5-codex · default' },
  { id: 'gpt-5', label: 'gpt-5' },
  { id: 'gpt-5.5', label: 'gpt-5.5' },
  { id: 'o3', label: 'o3' },
];
