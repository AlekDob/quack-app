---
type: bug
project: quack-app
created: 2026-03-09
last_verified: 2026-03-09
tags: [bedrock, vertex, aws, env-vars, gui-launch, cloud-provider]
---
# Bedrock/Vertex env vars not propagated to SDK process (GUI launch)

## Symptom
Users with `CLAUDE_CODE_USE_BEDROCK=1` in their shell profile get:
```
API Error (claude-opus-4-6): 400 The provided model identifier is invalid
```
when using agents in Quack. The embedded terminal works fine.

## Root Cause
When Quack is launched from Finder (GUI), the Tauri process has a minimal environment.
The `shell_env` module captures the full login-shell env, but `claude_cli.rs` only used
`get_login_path()` to extract PATH — cloud provider env vars like `CLAUDE_CODE_USE_BEDROCK`,
`AWS_PROFILE`, `AWS_REGION` etc. were never propagated to the SDK child process.

The SDK needs `CLAUDE_CODE_USE_BEDROCK=1` to route API calls to Bedrock and translate
model IDs (e.g., `claude-opus-4-6` → `anthropic.claude-opus-4-6-v1`).

## Fix
Added `propagate_cloud_env()` helper in `claude_cli.rs` that reads critical cloud provider
env vars from the cached login-shell environment and injects them into the child `Command`.
Applied to both daemon spawn and SDK spawn paths.

### Propagated vars
- `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX` (provider toggle)
- `AWS_PROFILE`, `AWS_REGION`, `AWS_DEFAULT_REGION` (AWS config)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` (AWS credentials)
- `ANTHROPIC_BEDROCK_BASE_URL` (custom Bedrock endpoint)
- `CLOUD_ML_REGION`, `ANTHROPIC_VERTEX_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (GCP/Vertex)

## Trigger
Search: `propagate_cloud_env` or `CLOUD_PROVIDER_ENV_VARS` in `claude_cli.rs`

## Related
- `gotcha-shell-env-gui-launch.md` — same class of bug (GUI launch missing env vars)
- `bug-daemon-missing-provider-env-vars.md` — previous fix for provider env vars
