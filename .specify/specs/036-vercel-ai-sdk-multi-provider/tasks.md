# Implementation Tasks: 036 Vercel AI SDK Multi-Provider Engine

## Phase 1: Foundation (Dependencies + Model Registry)

- [x] 1.1 Install Vercel AI SDK dependencies in daemon
- [x] 1.2 Create `model-registry.js` in daemon
- [x] 1.3 [P] Expand `LLMProviderType` in frontend types

## Phase 2: Daemon Engine (stream-vercel.js)

- [x] 2.1 Create `stream-vercel.js` — core streaming engine
- [x] 2.2 Add router in `stream-daemon.js`
- [x] 2.3 [P] Add `get_available_vercel_models` daemon command

## Phase 3: Rust Relay

- [x] 3.1 Add Tauri command `get_vercel_models`
- [x] 3.2 [P] Ensure provider routing in `SdkStreamRequest`

## Phase 4: Frontend — Settings

- [x] 4.1 Add API key fields in Settings store
- [x] 4.2 Update Settings UI with provider key inputs

## Phase 5: Frontend — Chat Model Picker

- [x] 5.1 Extend ChatSettingsMenu with new provider tabs
- [ ] 5.2 [P] Add preset quick-switch buttons (deferred — follow-up feature)
- [x] 5.3 Update `getProviderRequestFields()` in claudeSDK.ts

## Phase 6: StaminaBar + UX Adaptation

- [x] 6.1 Adapt StaminaBar for multi-provider context windows (via modelUsage in result event)
- [x] 6.2 [P] Provider-aware error rendering (in stream-vercel.js)

## Phase 7: Integration Testing

- [ ] 7.1 End-to-end test: OpenAI streaming chat (requires API key — manual test)
- [ ] 7.2 [P] End-to-end test: Google Gemini chat (requires API key — manual test)
- [ ] 7.3 [P] Regression test: Anthropic workflow (requires running app)

## Notes

- `[P]` indicates tasks that can be parallelized with siblings
- Preset quick-switch buttons (5.2) deferred to follow-up iteration
- Integration testing requires running the app with live API keys
- Tool use for Vercel providers is OUT OF SCOPE (Phase 2 follow-up)
