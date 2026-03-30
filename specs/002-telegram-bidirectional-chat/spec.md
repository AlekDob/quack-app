# Feature Specification: Telegram Bidirectional Chat Integration

**Feature Branch**: `002-telegram-bidirectional-chat`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "Upgrade the existing Telegram bot from generic notifications to a full bidirectional chat experience with conversation summaries and direct reply capability"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive Conversation Summaries on Telegram (Priority: P1)

As a Quack user with Telegram connected, I want to receive an intelligent summary notification on Telegram every time any of my agents completes a turn, so I can monitor my agents' work without opening the desktop app.

The notification should include the agent name, session title, and a concise summary of the agent's last output. It should also include action buttons to open the full conversation in the mobile dashboard, reply directly, or stop the session.

**Why this priority**: This is the core value proposition — transforming Telegram from a dumb notification pipe into an intelligent agent monitoring channel. Without this, the bidirectional chat feature has no foundation.

**Independent Test**: Can be fully tested by starting any agent session in the desktop app and verifying that a well-formatted summary notification arrives on Telegram within seconds, with working inline buttons.

**Acceptance Scenarios**:

1. **Given** a user has Telegram connected and an agent session is active, **When** the agent completes a turn with output, **Then** the user receives a Telegram notification with the agent name, session title, and a summary of the output (max 500 characters).
2. **Given** a notification is received, **When** the user taps the "Dashboard" button, **Then** the mobile dashboard opens showing the full conversation for that session.
3. **Given** an agent produces multiple rapid outputs (within 3 seconds), **When** the debounce window expires, **Then** only one consolidated notification is sent with the latest summary.
4. **Given** a user has NOT connected Telegram, **When** any agent session produces output, **Then** no errors occur and the system silently skips Telegram notifications.

---

### User Story 2 - Reply to Agents via Telegram (Priority: P2)

As a Quack user receiving agent notifications on Telegram, I want to reply directly to a notification message and have my reply sent to the corresponding agent session, so I can interact with my agents from my phone without opening the dashboard.

**Why this priority**: This completes the bidirectional loop. Without it, Telegram is still a one-way channel — useful but not interactive. This turns Telegram into a remote control for agents.

**Independent Test**: Can be fully tested by receiving a notification, using Telegram's native reply function to respond, and verifying the message appears in the agent's session.

**Acceptance Scenarios**:

1. **Given** a user receives a notification for session X, **When** the user replies to that specific Telegram message, **Then** the reply text is sent to session X as a user message.
2. **Given** a user replies to a notification for a session that has already ended, **When** the reply is processed, **Then** the user receives an error message on Telegram indicating the session is no longer active.
3. **Given** a user replies to a notification, **When** the agent processes the reply and responds, **Then** the user receives a new notification with the agent's response (creating a back-and-forth conversation flow).

---

### User Story 3 - Stop Agent from Telegram (Priority: P3)

As a Quack user monitoring agents on Telegram, I want to stop a running agent session directly from a notification's inline button, so I can take immediate action when an agent is going off-track.

**Why this priority**: Safety control. While the /stop command already exists, having a one-tap stop button on each notification is more immediate and contextual.

**Independent Test**: Can be fully tested by tapping the "Stop" button on a notification and verifying the corresponding session terminates.

**Acceptance Scenarios**:

1. **Given** a notification with a "Stop" button is displayed, **When** the user taps "Stop", **Then** the corresponding agent session is terminated and a confirmation message is sent on Telegram.
2. **Given** the user taps "Stop" on a notification for an already-ended session, **When** the stop command is processed, **Then** the user receives a message indicating the session has already ended.

---

### Edge Cases

- What happens when the Telegram API is unreachable? The system must log the error and continue operating without blocking agent execution.
- What happens when the notification text exceeds Telegram's 4096 character limit? The summary must be truncated at sentence boundaries to stay under the limit.
- What happens when the user replies to a very old notification whose session mapping has been cleaned up? The system must respond with a clear error message.
- What happens when multiple sessions are active simultaneously? Each notification must be independently trackable, and replies must route to the correct session.
- What happens when the polling service restarts? The session-to-message mapping is in-memory and will be lost. New notifications will rebuild mappings as agents produce output.
- What happens when the Telegram bot hits rate limits (30 msg/sec)? The debounce mechanism should naturally prevent this, but if it occurs, messages should be queued and retried with exponential backoff.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST send a summary notification to Telegram when any agent session produces output, containing the agent name, session title, and a concise summary (max 500 characters).
- **FR-002**: System MUST include inline keyboard buttons on each notification: Dashboard link and Stop session. No Reply button — the notification text includes a hint to use Telegram's native reply-to-message feature.
- **FR-003**: System MUST debounce rapid session updates, consolidating notifications within a 3-second window to avoid spam.
- **FR-004**: System MUST track the mapping between Telegram message IDs and session IDs to enable reply correlation.
- **FR-005**: System MUST route Telegram reply messages to the correct agent session based on the reply_to_message relationship.
- **FR-006**: System MUST respond with an error message when a user replies to a notification for an inactive or expired session.
- **FR-007**: System MUST clean up session-to-message mappings when sessions complete to prevent unbounded memory growth.
- **FR-008**: System MUST NOT break existing Telegram commands (/status, /new, /stop, /chat, /screenshot, /help).
- **FR-009**: System MUST work with both the Central Bot (polling-based) and Manual Bot configurations.
- **FR-010**: System MUST gracefully degrade when Telegram is not configured — no errors, no notifications, no impact on agent execution.
- **FR-011**: System MUST truncate summaries at sentence boundaries when the full message would exceed Telegram's 4096 character limit.
- **FR-012**: System MUST format notifications in Telegram Markdown with agent emoji, agent name in bold, session title in italic, and a "reply to respond" hint.
- **FR-013**: System MUST provide a global "Mute Telegram notifications" toggle in settings that silences all outbound notifications without disconnecting the bot. Existing commands (/status, /new, etc.) MUST continue to work even when muted.

### Key Entities

- **NotificationMessage**: Represents a sent Telegram notification — contains session ID, Telegram message ID, agent name, timestamp. Used for reply correlation.
- **SessionMapping**: Bidirectional map between session IDs and Telegram message IDs — lives in memory, rebuilt on new notifications, cleaned on session completion.
- **DebouncedUpdate**: Represents a pending session update waiting for the debounce window to expire — contains session ID, latest content, and a timer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users receive a notification on Telegram within 5 seconds of an agent completing a turn.
- **SC-002**: Users can reply to a Telegram notification and see their message processed by the agent within 3 seconds.
- **SC-003**: Rapid agent outputs (3+ updates within 3 seconds) result in a single consolidated notification, not multiple messages.
- **SC-004**: The system operates without errors or performance degradation when Telegram is not configured.
- **SC-005**: All existing Telegram commands continue to work identically after the feature is deployed.
- **SC-006**: Users can monitor and interact with 5+ concurrent agent sessions via Telegram without message routing errors.

## Clarifications

### Session 2026-03-30

- Q: What does the "Reply" inline button do, given Telegram callback buttons can't initiate a native reply-to-message? → A: Remove the Reply button entirely. Keep only Dashboard + Stop. The text hint "Usa reply per rispondere" in the notification message is sufficient to guide users.
- Q: Should there be a mute/DND mechanism to control notification volume during intensive multi-agent work? → A: Yes — a global "Mute Telegram notifications" toggle in settings. Silences all notifications without disconnecting the bot. One click to re-enable. No per-agent granularity in v1.

## Assumptions

- The existing Telegram polling mechanism (2-second interval) provides sufficient responsiveness for receiving reply messages.
- The WebSocket broadcast channel already carries all necessary session event data (session_completed, agent_status) to trigger notifications.
- In-memory session-to-message mapping is acceptable — persistence across app restarts is not required (notifications will naturally rebuild mappings as agents produce output).
- The notification summary is a simple text truncation of the last assistant message, not an AI-generated summary (keeping scope manageable).
- The mobile dashboard URL can be constructed from the local hostname and session ID without additional configuration.
- Telegram's Markdown parse mode is sufficient for the notification format (no need for HTML parse mode).
