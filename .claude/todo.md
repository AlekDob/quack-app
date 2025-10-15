# 📋 Notification System Improvements Todo List
## TerminalFlow (Quack App) - Created by Mike

*Last Updated: October 15, 2025*

---

## 📊 Current System Summary

### ✅ What's Already Implemented:
- Desktop notifications via `tauri-plugin-notification`
- Quack sound feedback (WebAudio at 0.6 volume)
- Visual feedback: pulsing dots, badges (⚡ busy, ✓ idle)
- 3-tier timer system (5s activity, 60s notification, 400ms anti-flicker)
- External hook integration (http://127.0.0.1:6768/terminal/status)
- Smart notification logic (first response only, anti-spam protection)
- In-app toast notifications (sonner library)
- Attention states for background terminals

### 🎨 Existing Design Documentation:
- Comprehensive design system in `docs/notification-system-design.md`
- Analysis report in `project-plan/notification-system-analysis.md`
- Julie's UI/UX specs with GSAP animations, color system, accessibility

---

## 🚀 PHASE 1: Quick Wins & Configuration
**Priority: HIGH | Complexity: LOW | Time: 1-2 days**

### 1.1 User Preferences System
- [ ] Create notification preferences in Rust backend (`preferences.rs`)
  - [ ] Volume control (0-100%)
  - [ ] Timer customization (idle, notification, anti-flicker)
  - [ ] Enable/disable per terminal type
  - [ ] Do Not Disturb schedule
- [ ] Add preferences UI panel in React
  - [ ] Use existing shadcn/ui components
  - [ ] Integrate with tauri-plugin-store for persistence
  - [ ] Add to Quack menu dropdown

### 1.2 Sound Management
- [ ] Volume slider component (shadcn/ui Slider)
- [ ] Custom sound file picker
  - [ ] Support mp3, wav, ogg formats
  - [ ] Preview button to test sounds
  - [ ] Default sounds library (quack variations)
- [ ] Mute/unmute global toggle
  - [ ] Keyboard shortcut: Cmd+Shift+M
  - [ ] Visual indicator in header

### 1.3 Global Controls
- [ ] Quick access buttons (top-right corner)
  - [ ] 🔇 Mute toggle
  - [ ] 🌙 Do Not Disturb toggle
  - [ ] ⚙️ Settings shortcut
- [ ] Implement DND scheduling
  - [ ] Time picker for start/end
  - [ ] Auto-enable based on schedule
  - [ ] Override for urgent notifications

---

## 🧠 PHASE 2: Intelligent Notifications
**Priority: HIGH | Complexity: MEDIUM | Time: 3-4 days**

### 2.1 Pattern Recognition System
- [ ] Command type detection
  ```typescript
  enum CommandType {
    BUILD,     // npm run build, cargo build, etc.
    TEST,      // npm test, pytest, cargo test
    AI,        // Claude, GPT, AI assistant commands
    GIT,       // git operations
    INSTALL,   // npm install, pip install, cargo install
    SERVER,    // dev servers, localhost
    CUSTOM     // user-defined patterns
  }
  ```
- [ ] Different notification behaviors per type
  - [ ] Build: High priority, always notify
  - [ ] Test: Show test results summary
  - [ ] AI: Special "thinking" animation
  - [ ] Git: Quick success/fail feedback
- [ ] Learning system for custom patterns
  - [ ] Track command frequency
  - [ ] Auto-categorize after 5+ uses
  - [ ] User can manually tag commands

### 2.2 Smart Timing Adjustments
- [ ] Dynamic timeout based on command history
  - [ ] Short commands: 3-5 second notification delay
  - [ ] Long commands: 30-60 second delay
  - [ ] Learn average duration per command type
- [ ] Context-aware notifications
  - [ ] Suppress during rapid command sequences
  - [ ] Batch similar notifications
  - [ ] Priority queue for critical errors

### 2.3 Enhanced Status Detection
- [ ] Multiple prompt patterns support
  ```typescript
  const PROMPT_PATTERNS = [
    /\$\s*$/,           // Bash
    />\s*$/,            // PowerShell
    /%\s*$/,            // Zsh
    /❯\s*$/,            // Custom prompts
    /\[.*\]\$/,         // Git bash
    // Add user-defined patterns
  ];
  ```
- [ ] Error detection patterns
  - [ ] Build failures
  - [ ] Test failures
  - [ ] Compilation errors
  - [ ] Runtime exceptions
- [ ] Success detection patterns
  - [ ] "Successfully built"
  - [ ] "All tests passed"
  - [ ] "Deployment complete"

---

## 🎨 PHASE 3: Advanced UI Components
**Priority: MEDIUM | Complexity: HIGH | Time: 5-7 days**

### 3.1 Notification Center Drawer
- [ ] Implement right-side drawer (380px width)
  - [ ] Use Radix UI Dialog primitive
  - [ ] GSAP slide-in animation (300ms)
  - [ ] Backdrop blur overlay
- [ ] Notification history list
  - [ ] Virtual scrolling for performance
  - [ ] Group by time (Today, Yesterday, This Week)
  - [ ] Search/filter functionality
  - [ ] Max 100 items, auto-cleanup after 7 days
- [ ] Notification item cards
  - [ ] Icon based on command type
  - [ ] Timestamp (relative and absolute)
  - [ ] Terminal name and command preview
  - [ ] Expand to show full output
  - [ ] Quick actions (Copy, Re-run, Dismiss)

### 3.2 Visual Enhancements
- [ ] Implement badge system from design doc
  - [ ] Priority colors (critical/high/medium/low)
  - [ ] Progress indicators (circular/linear)
  - [ ] Animated transitions
  - [ ] Timer displays for long-running commands
- [ ] GSAP animations
  - [ ] Pulse attention (2s loop)
  - [ ] Success checkmark animation
  - [ ] Error shake animation
  - [ ] Progress bar smooth updates
- [ ] Terminal chip improvements
  - [ ] Show command type icon
  - [ ] Elapsed time counter
  - [ ] Mini progress bar
  - [ ] Color-coded by priority

### 3.3 Toast Notification Improvements
- [ ] Custom toast component (replace sonner)
  - [ ] Match design system aesthetics
  - [ ] Support for actions in toasts
  - [ ] Progress indicator for long operations
  - [ ] Stack and group similar toasts
- [ ] Toast action buttons
  - [ ] "View Output" - opens terminal
  - [ ] "Copy Command" - to clipboard
  - [ ] "Re-run" - execute command again
  - [ ] "Silence Similar" - mute this type

---

## 🔌 PHASE 4: Integration & API
**Priority: LOW | Complexity: MEDIUM | Time: 2-3 days**

### 4.1 Enhanced Hook System
- [ ] Extend HTTP API endpoints
  ```rust
  POST /terminal/status     // existing
  POST /terminal/progress   // new: progress updates
  POST /terminal/error      // new: error reporting
  GET  /terminal/list       // new: list terminals
  POST /notification/send   // new: custom notifications
  ```
- [ ] WebSocket support for real-time updates
  - [ ] Bidirectional communication
  - [ ] Automatic reconnection
  - [ ] Event subscription model
- [ ] API authentication
  - [ ] Optional API key/token
  - [ ] Rate limiting per client
  - [ ] Whitelist trusted sources

### 4.2 External Tool Integrations
- [ ] Claude Code enhanced integration
  - [ ] Progress percentage from hook
  - [ ] Error details with stack traces
  - [ ] Multiple status levels (thinking/writing/complete)
- [ ] GitHub Copilot Chat support
- [ ] VS Code task runner integration
- [ ] Docker compose status monitoring
- [ ] npm/yarn script monitoring

### 4.3 Automation & Workflows
- [ ] Notification rules engine
  ```typescript
  interface NotificationRule {
    pattern: RegExp;
    action: 'notify' | 'silence' | 'alert';
    priority: Priority;
    customSound?: string;
    autoActions?: Action[];
  }
  ```
- [ ] Conditional notifications
  - [ ] Only notify if command takes > X seconds
  - [ ] Different behavior for different directories
  - [ ] Time-of-day based rules
- [ ] Chained actions
  - [ ] Auto-run next command on success
  - [ ] Open browser when server starts
  - [ ] Send webhook on completion

---

## 🎯 PHASE 5: Performance & Polish
**Priority: MEDIUM | Complexity: LOW | Time: 2-3 days**

### 5.1 Performance Optimizations
- [ ] React performance
  - [ ] Memoize expensive computations
  - [ ] Implement React.memo for static components
  - [ ] Use useCallback/useMemo appropriately
  - [ ] Virtualize long lists
- [ ] Animation performance
  - [ ] Use CSS transforms over position
  - [ ] Leverage GPU acceleration
  - [ ] Limit concurrent animations (max 3)
  - [ ] RequestAnimationFrame batching
- [ ] Memory management
  - [ ] Clear old notification data
  - [ ] Dispose GSAP animations properly
  - [ ] Limit output buffer sizes
  - [ ] Periodic garbage collection

### 5.2 Accessibility Improvements
- [ ] ARIA labels and roles
  - [ ] Live regions for notifications
  - [ ] Descriptive button labels
  - [ ] Status announcements
- [ ] Keyboard navigation
  - [ ] Tab order optimization
  - [ ] Shortcut for notification center
  - [ ] Arrow key navigation in lists
  - [ ] Escape to close drawers
- [ ] Screen reader support
  - [ ] Announce notification content
  - [ ] Describe terminal states
  - [ ] Read command output summaries
- [ ] Reduced motion support
  - [ ] Respect prefers-reduced-motion
  - [ ] Alternative static indicators
  - [ ] Simplified transitions

### 5.3 Testing & Validation
- [ ] Unit tests for notification logic
- [ ] Integration tests for hook system
- [ ] E2E tests for user workflows
- [ ] Performance benchmarks
- [ ] Accessibility audit (WCAG AA)
- [ ] Cross-platform testing (Mac, Windows, Linux)

---

## 📝 Additional Improvements

### Nice-to-Have Features
- [ ] Notification templates/presets
- [ ] Export notification history
- [ ] Notification analytics dashboard
- [ ] Voice notifications (TTS)
- [ ] Rich media in notifications (images, charts)
- [ ] Notification sharing/collaboration
- [ ] Mobile app companion for remote notifications
- [ ] AI-powered notification summarization

### Developer Experience
- [ ] Notification debugging mode
- [ ] Mock notification generator for testing
- [ ] Performance profiler for animations
- [ ] Documentation site with examples
- [ ] Storybook for notification components
- [ ] CLI for notification management

---

## 🎯 Success Metrics

### User Experience Goals
- Reduce notification fatigue by 70%
- Increase command completion awareness by 90%
- Zero missed critical notifications
- < 100ms notification display latency
- 60fps animation consistency

### Technical Goals
- 100% test coverage for critical paths
- < 5% CPU usage for idle app
- < 50MB memory overhead for notifications
- WCAG AA accessibility compliance
- Cross-platform feature parity

---

## 📅 Suggested Implementation Order

1. **Week 1**: Phase 1 (Quick Wins) - Immediate value, low risk
2. **Week 2**: Phase 2.1-2.2 (Pattern Recognition) - Smart features
3. **Week 3**: Phase 3.1 (Notification Center) - Major UX improvement
4. **Week 4**: Phase 3.2-3.3 (Visual Polish) - Delight users
5. **Week 5**: Phase 4 (Integrations) - Extend capabilities
6. **Week 6**: Phase 5 (Performance & Polish) - Production ready

---

## 🚧 Current Blockers & Questions

### Need Clarification:
1. Should we maintain backward compatibility with current hook API?
2. What's the preferred animation library (GSAP vs Framer Motion)?
3. Should notification data sync across devices?
4. Do we need offline notification support?
5. Priority: Better defaults vs more customization?

### Technical Decisions Needed:
1. State management: Zustand vs React Context vs Jotai?
2. Animation library: GSAP (powerful) vs CSS-only (performant)?
3. Notification storage: IndexedDB vs tauri-plugin-store?
4. Component library: Continue with shadcn/ui or custom?
5. Testing framework: Vitest vs Jest vs Playwright?

---

## 🎉 Definition of Done

Each task is considered complete when:
- [ ] Feature implemented and working
- [ ] Unit tests written and passing
- [ ] Accessibility verified
- [ ] Performance benchmarked
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Cross-platform tested

---

*This todo list represents a comprehensive improvement plan for the TerminalFlow notification system. Items are organized by priority and complexity to enable incremental delivery of value while working toward the complete vision outlined in the design documentation.*

**Next Steps:**
1. Review and prioritize items with Alek
2. Create detailed technical specs for Phase 1
3. Set up development branch for notification improvements
4. Begin implementation with user preferences system

---

*Document maintained by Mike - Project Manager*
*Quack Agency - Building Better Terminal Experiences*