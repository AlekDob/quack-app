use parking_lot::Mutex;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

/// If the claude subprocess emits nothing for this long after producing
/// at least one event, we assume it's hung (the documented
/// anthropics/claude-code#1920 class of bug — terminal `result` event
/// never arrives) and force a clean shutdown so the frontend doesn't
/// spin forever waiting for `end`.
const IDLE_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Default)]
pub struct ClaudeCodeState {
    /// stream id → pid of the live `claude` process. We store only the
    /// pid (not the `Child`) so a stop/kill can signal the process group
    /// without contending for a lock: the wait thread owns the `Child`
    /// and holds it for the whole run while blocked in `wait()`.
    /// Brain: claude-stop-kills-process-group
    children: Mutex<HashMap<String, u32>>,
    /// Per-stream buffer of every event emitted, keyed by stream id.
    /// Used by `claude_code_attach` so a frontend that just refreshed
    /// can replay everything it missed and re-subscribe to live events.
    /// Buffers stay until app restart or the chat is explicitly cleared.
    buffers: Mutex<HashMap<String, StreamBuffer>>,
    /// Reverse map: chat-session id (frontend's stable id per chat tab)
    /// → most-recent stream id. Lets the frontend look up "is there a
    /// stream still alive for this chat?" without remembering raw stream
    /// ids across reloads.
    session_streams: Mutex<HashMap<String, String>>,
}

#[derive(Clone)]
pub struct StreamBuffer {
    /// Kept for diagnostics — every buffer is also reachable via the
    /// session_streams reverse map, but storing it here lets us correlate
    /// without locking two maps at once when we just want the chat id.
    #[allow(dead_code)]
    pub chat_session_id: String,
    pub lines: Vec<serde_json::Value>,
    pub ended: Option<i32>,
}

/// Quick availability check — returns the version string or an error.
/// Tries multiple variants because npm-installed CLIs on Windows are `.cmd`
/// shims (which `Command::new("claude")` won't find without going through a
/// shell), and some users keep claude in `~/.claude/local`.
#[tauri::command]
pub fn claude_code_check() -> Result<String, String> {
    // Variant 1: direct invocation.
    if let Ok(v) = try_run_claude(&["--version"], None) {
        return Ok(v);
    }
    // Variant 2: shell-mediated — picks up .cmd shims and shell PATH
    // additions (nvm, asdf, etc.) that the spawning subprocess doesn't see.
    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", "claude --version"]);
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
            }
        }
    }
    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("sh");
        cmd.args(["-lc", "claude --version"]);
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
            }
        }
    }
    // Variant 3: common per-user install locations.
    if let Some(home) = dirs::home_dir() {
        let candidates: &[&str] = if cfg!(windows) {
            &["AppData/Roaming/npm/claude.cmd", ".claude/local/claude.cmd"]
        } else {
            &[".claude/local/claude", ".local/bin/claude"]
        };
        for rel in candidates {
            let path = home.join(rel);
            if path.exists() {
                if let Ok(v) = try_run_claude(&["--version"], Some(&path.to_string_lossy())) {
                    return Ok(v);
                }
            }
        }
    }
    Err("claude CLI not found on PATH or common install locations".to_string())
}

/// Tools that genuinely change state OR reach external networks and
/// warrant a confirm-card. Read / Glob / Grep / TodoWrite are NOT in
/// the list because they don't touch user files or run programs —
/// prompting on every one of them would be noise. WebFetch and
/// WebSearch ARE in the list because (a) the Claude CLI blocks them
/// by default in non-interactive mode and the user otherwise has no
/// way to grant access, and (b) hitting external URLs is a meaningful
/// trust decision the user should make once and for all via the
/// "Always allow" button.
/// Read/Grep/Glob are in the matcher ONLY so the frontend's privacy
/// gate can see model-initiated reads (the exclusion list is useless
/// if Claude can `Read .env` without the hook firing). The overlay
/// auto-allows them immediately after the privacy check — they never
/// produce a permission card, so day-to-day friction is unchanged.
/// AskUserQuestion is gated so the overlay can redirect it: in -p
/// (headless) mode the CLI has no question UI, so the call would just
/// fail opaquely. The overlay denies it with a reason telling the
/// model to ask in plain text and end its turn.
const PERMISSION_GATED_TOOLS: &str =
    "Bash|Edit|MultiEdit|Write|NotebookEdit|WebFetch|WebSearch|Read|Grep|Glob|AskUserQuestion|ExitPlanMode";

/// Cached resolution of the working `claude` executable name. On
/// Windows, npm-installed Claude Code is `claude.cmd`, which
/// `Command::new("claude")` will not auto-resolve via PATHEXT — we
/// must pass the explicit name. Probe variants once, cache the first
/// that runs `--version` cleanly. Returns `None` if nothing works,
/// in which case `build_claude_command` falls back to a shell-mediated
/// invocation that picks up login-shell-only PATH entries.
static CLAUDE_BIN: OnceLock<String> = OnceLock::new();

fn resolve_claude_executable() -> Option<String> {
    if let Some(cached) = CLAUDE_BIN.get() {
        return Some(cached.clone());
    }
    let probe = |name: &str| -> bool {
        let mut p = Command::new(name);
        p.arg("--version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            p.creation_flags(0x08000000);
        }
        p.output().map(|o| o.status.success()).unwrap_or(false)
    };
    #[cfg(windows)]
    let names: &[&str] = &["claude.cmd", "claude.exe", "claude"];
    #[cfg(not(windows))]
    let names: &[&str] = &["claude"];
    for n in names {
        if probe(n) {
            let _ = CLAUDE_BIN.set(n.to_string());
            return Some(n.to_string());
        }
    }
    if let Some(home) = dirs::home_dir() {
        #[cfg(windows)]
        let rels: &[&str] = &[
            "AppData/Roaming/npm/claude.cmd",
            ".claude/local/claude.cmd",
        ];
        #[cfg(not(windows))]
        let rels: &[&str] = &[".claude/local/claude", ".local/bin/claude"];
        for rel in rels {
            let path = home.join(rel);
            if path.exists() {
                let s = path.to_string_lossy().to_string();
                if probe(&s) {
                    let _ = CLAUDE_BIN.set(s.clone());
                    return Some(s);
                }
            }
        }
    }
    None
}

#[derive(serde::Serialize)]
pub struct PluginCmdOutput {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Run a `claude` subcommand (e.g. `plugin marketplace add owner/repo`,
/// `plugin install name@marketplace`, `plugin marketplace list --json`)
/// and capture its output. The agent-mode Plugins UI uses this so the CLI
/// does the cloning/validation and writes the correct settings scope —
/// far more robust than hand-editing the plugin config JSON. Blocking (a
/// repo clone can take a few seconds), consistent with the git_* commands.
#[tauri::command]
pub fn claude_plugin_cmd(
    cwd: Option<String>,
    args: Vec<String>,
) -> Result<PluginCmdOutput, String> {
    let exe = resolve_claude_executable().ok_or_else(|| {
        "Claude Code CLI not found. Install it and run `claude /login` first.".to_string()
    })?;
    let mut cmd = Command::new(&exe);
    cmd.args(&args);
    if let Some(c) = cwd {
        if !c.is_empty() {
            cmd.current_dir(c);
        }
    }
    cmd.env("NO_COLOR", "1")
        .env("FORCE_COLOR", "0")
        .env("TERM", "dumb");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    Ok(PluginCmdOutput {
        code: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
    })
}

/// Build a Command that will invoke claude WITHOUT passing the prompt as an
/// argument — the prompt is piped via stdin instead, which sidesteps the
/// Windows ~8191-char command-line limit (otherwise blown by inlined file
/// trees / large message histories). Picks the best resolution strategy:
/// direct binary if reachable, otherwise shell-mediated so .cmd shims and
/// custom PATH entries (nvm, asdf, etc.) resolve correctly.
fn build_claude_command(
    _prompt: &str,
    model: Option<&str>,
    resume: Option<&str>,
    cwd: Option<&str>,
    use_hooks: bool,
    effort: Option<&str>,
    permission_mode: Option<&str>,
) -> Command {
    // "default" sentinel = don't pass --model, let Claude Code use its
    // own configured default (whatever `claude /login` set up).
    let model_to_pass = match model {
        Some("default") | Some("") => None,
        other => other,
    };

    if let Some(exe) = resolve_claude_executable() {
        let mut cmd = Command::new(&exe);
        // Use -p with no prompt argument — claude reads from stdin.
        cmd.arg("-p");
        cmd.arg("--output-format").arg("stream-json");
        cmd.arg("--verbose");
        // Stream token-level text deltas in stream_event records so
        // long final answers don't appear all at once after tool
        // calls. Without this flag the CLI emits one assistant event
        // per content block, so a 2KB summary lands in a single
        // chunk after all the tool work and the user sees nothing
        // for 30+ seconds.
        cmd.arg("--include-partial-messages");
        // Permission strategy:
        //   - use_hooks=true: PreToolUse hook in .claude/settings.local.json
        //     calls our localhost server, which surfaces a permission
        //     card in the GUI. The hook fires under every --permission-mode
        //     except bypass, which short-circuits hooks — so the caller
        //     hands us only `plan` or None here (acceptEdits/auto are
        //     enforced GUI-side by the permission overlay).
        //   - use_hooks=false: bypass mode (user opted in) OR the legacy
        //     fallback when the perm server didn't come up. Skip prompts
        //     entirely so the agent loop can run.
        if use_hooks {
            cmd.arg("--permission-mode")
                .arg(permission_mode.unwrap_or("default"));
        } else {
            cmd.arg("--dangerously-skip-permissions");
        }
        if let Some(e) = effort {
            cmd.arg("--effort").arg(e);
        }
        if let Some(m) = model_to_pass {
            cmd.arg("--model").arg(m);
        }
        if let Some(s) = resume {
            cmd.arg("--resume").arg(s);
        }
        if let Some(d) = cwd {
            cmd.current_dir(d);
        }
        apply_clean_env(&mut cmd);
        return cmd;
    }

    // Fall back to shell-mediated invocation — also stdin-driven.
    let perm_flag = if use_hooks {
        format!(
            "--permission-mode {}",
            shell_quote(permission_mode.unwrap_or("default"))
        )
    } else {
        "--dangerously-skip-permissions".to_string()
    };
    let mut shell_cmd = format!(
        "claude -p --output-format stream-json --verbose --include-partial-messages {}",
        perm_flag
    );
    if let Some(e) = effort {
        shell_cmd.push_str(" --effort ");
        shell_cmd.push_str(&shell_quote(e));
    }
    if let Some(m) = model_to_pass {
        shell_cmd.push_str(" --model ");
        shell_cmd.push_str(&shell_quote(m));
    }
    if let Some(s) = resume {
        shell_cmd.push_str(" --resume ");
        shell_cmd.push_str(&shell_quote(s));
    }

    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", &shell_cmd]);
        if let Some(d) = cwd {
            cmd.current_dir(d);
        }
        apply_clean_env(&mut cmd);
        cmd
    }
    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("sh");
        cmd.args(["-lc", &shell_cmd]);
        if let Some(d) = cwd {
            cmd.current_dir(d);
        }
        apply_clean_env(&mut cmd);
        cmd
    }
}

/// Ensure `<workspace>/.claude/settings.local.json` contains a
/// PreToolUse hook that POSTs to our localhost permission endpoint
/// for the destructive-tool matcher. Idempotent — preserves any
/// other hooks the user may have configured, and dedupes our own
/// entry by command string.
fn ensure_pretooluse_hook(workspace: &str, endpoint: &str) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let claude_dir = Path::new(workspace).join(".claude");
    fs::create_dir_all(&claude_dir).map_err(|e| e.to_string())?;
    let settings_path = claude_dir.join("settings.local.json");

    // Load existing settings if present, else start fresh. Tolerate
    // malformed JSON by overwriting — claude itself can't read it
    // either, so the user has nothing to lose.
    let mut root: serde_json::Value = if settings_path.exists() {
        let s = fs::read_to_string(&settings_path).unwrap_or_default();
        serde_json::from_str(&s).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if !root.is_object() {
        root = serde_json::json!({});
    }

    let hook_command = build_hook_command(endpoint);
    let our_entry = serde_json::json!({
        "matcher": PERMISSION_GATED_TOOLS,
        "hooks": [
            {
                "type": "command",
                "command": hook_command,
                // Codetta-managed marker so we can update / dedupe
                // ourselves without touching user-authored entries.
                "_codetta": true,
            }
        ]
    });

    // Drill into root.hooks.PreToolUse, creating intermediates as needed.
    let hooks_obj = root
        .as_object_mut()
        .unwrap()
        .entry("hooks".to_string())
        .or_insert_with(|| serde_json::json!({}));
    if !hooks_obj.is_object() {
        *hooks_obj = serde_json::json!({});
    }
    let pretooluse = hooks_obj
        .as_object_mut()
        .unwrap()
        .entry("PreToolUse".to_string())
        .or_insert_with(|| serde_json::json!([]));
    if !pretooluse.is_array() {
        *pretooluse = serde_json::json!([]);
    }
    let arr = pretooluse.as_array_mut().unwrap();

    // Dedupe: drop any prior Codetta-managed entry, then push fresh.
    arr.retain(|entry| {
        let inner = entry.get("hooks").and_then(|h| h.as_array());
        let is_ours = inner
            .map(|hs| {
                hs.iter()
                    .any(|h| h.get("_codetta").and_then(|v| v.as_bool()).unwrap_or(false))
            })
            .unwrap_or(false);
        !is_ours
    });
    arr.push(our_entry);

    let pretty = serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?;
    // Atomic write so a crash mid-write can't truncate the file
    // and silently disable the permission flow (or any other hooks
    // the user had configured manually).
    let mut tmp = settings_path.as_os_str().to_owned();
    tmp.push(".codetta-tmp");
    let tmp = std::path::PathBuf::from(tmp);
    fs::write(&tmp, &pretty).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &settings_path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })?;
    Ok(())
}

/// Build the shell command that the PreToolUse hook runs.
///
/// Uses Node (Claude Code requires it anyway, so it's guaranteed
/// available). Reads the JSON payload from stdin, POSTs it to our
/// localhost permission server, and emits a Claude Code hook-protocol
/// JSON response on stdout — NOT just an exit code.
///
/// Why JSON output and not just exit codes:
/// the Claude Code harness treats a hook that exits 0 with no stdout
/// as ambiguous (some versions interpret as "no decision", which can
/// surface as a hook error). Always emitting the structured response
/// `{"hookSpecificOutput":{"hookEventName":"PreToolUse",
/// "permissionDecision":"allow"|"deny"}}` is the documented contract
/// and works across every CC version we've tested.
///
/// Why fail OPEN (allow) on connection error or timeout:
/// the most common reason the script can't reach the endpoint is that
/// Codetta isn't running — for example, the user installed Codetta
/// once, the hook was written into `.claude/settings.local.json`, then
/// they later opened the same workspace from a terminal `claude`
/// session. Failing closed (deny) would silently break their entire CLI
/// in that workspace until they hand-deleted the hook config — a real
/// bug we hit in v0.2.0 dogfooding.
///
/// Why a 3-second timeout:
/// Codetta's server's own DECISION_TIMEOUT is 50s. If Codetta IS
/// running, the user has up to that long to click. But if Codetta
/// ISN'T running, ECONNREFUSED fires almost instantly via `r.on('error',...)`.
/// The 3s timeout is purely a belt-and-suspenders for the very rare
/// case where the connection *opens* but the server hangs without
/// responding — fail open and let the agent proceed.
///
/// Note: `path` MUST be `pathname + search` because our endpoint URL
/// includes a `?token=<secret>` query string that the server uses to
/// reject drive-by requests. Using `pathname` alone strips the token
/// and the server returns 403.
fn build_hook_command(endpoint: &str) -> String {
    // Node one-liner. Inlined for minimum config-file size.
    // Logic: pipe stdin → POST endpoint → emit hook-protocol JSON.
    // Server body protocol: "0" = allow, "2" = deny, "2:<reason>" =
    // deny with a permissionDecisionReason the model gets to read —
    // used e.g. to redirect AskUserQuestion ("ask in plain text") so
    // the agent recovers instead of treating it as a hard failure.
    let js = format!(
        r#"const http=require('http');let b='';process.stdin.on('data',c=>b+=c).on('end',()=>{{let done=false;function out(d,reason){{if(done)return;done=true;const o={{hookEventName:'PreToolUse',permissionDecision:d}};if(reason)o.permissionDecisionReason=reason;process.stdout.write(JSON.stringify({{hookSpecificOutput:o}}));process.exit(0)}}const t=setTimeout(()=>out('allow'),3000);try{{const u=new URL('{endpoint}');const r=http.request({{hostname:u.hostname,port:u.port,path:u.pathname+u.search,method:'POST',headers:{{'content-length':Buffer.byteLength(b)}}}},res=>{{let d='';res.on('data',c=>d+=c);res.on('end',()=>{{clearTimeout(t);const s=String(d).trim();if(s[0]==='2'){{const i=s.indexOf(':');out('deny',i>0?s.slice(i+1):undefined)}}else{{out('allow')}}}})}});r.on('error',()=>{{clearTimeout(t);out('allow')}});r.write(b);r.end()}}catch(_){{clearTimeout(t);out('allow')}}}});"#,
        endpoint = endpoint
    );
    format!("node -e \"{}\"", js.replace('"', "\\\""))
}

/// Disable color / TTY-style output from the claude subprocess so ANSI
/// escapes can't leak into the JSON stream and corrupt our parser. Also
/// suppress the npm-style update check so it doesn't add a noisy
/// pre-output banner that might hit stdout before the first stream-json
/// event.
fn apply_clean_env(cmd: &mut Command) {
    cmd.env("NO_COLOR", "1");
    cmd.env("CLICOLOR", "0");
    cmd.env("FORCE_COLOR", "0");
    cmd.env("TERM", "dumb");
    // Some CLIs auto-detect interactive output; explicitly opt out.
    cmd.env("CI", "1");
    // Avoid claude-cli's auto-update banner stealing the first stdout
    // line (which would break our JSON parser).
    cmd.env("CLAUDE_SKIP_UPDATE_CHECK", "1");
}

fn shell_quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

fn try_run_claude(args: &[&str], explicit_path: Option<&str>) -> Result<String, String> {
    let mut cmd = Command::new(explicit_path.unwrap_or("claude"));
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(format!(
            "claude failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Spawn `claude -p <prompt>` with stream-json output. Each output line is
/// emitted on the event `claude-stream:<id>` as `{ kind: "line", line: "<json>" }`,
/// and an end event `claude-stream:<id>` with `{ kind: "end", code: <i32> }`
/// fires when the process exits. Returns the stream id.
#[tauri::command]
pub fn claude_code_chat(
    app: AppHandle,
    state: State<'_, ClaudeCodeState>,
    prompt: String,
    cwd: Option<String>,
    model: Option<String>,
    resume_session_id: Option<String>,
    chat_session_id: Option<String>,
    allow_unguarded: Option<bool>,
    effort: Option<String>,
    permission_mode: Option<String>,
    thinking: Option<bool>,
) -> Result<String, String> {
    // Whitelist both knobs — they land on a command line. Anything
    // unexpected (including bypassPermissions, which would silently
    // disable the hook-based permission guard) is dropped.
    let effort = effort.filter(|e| {
        matches!(e.as_str(), "low" | "medium" | "high" | "xhigh" | "max")
    });
    let permission_mode = permission_mode.filter(|m| {
        matches!(
            m.as_str(),
            "default" | "plan" | "acceptEdits" | "auto" | "bypassPermissions"
        )
    });
    // "bypassPermissions" is Claude Code's real full-skip mode, chosen
    // explicitly by the user. We run it WITHOUT the hook (the hook would be
    // short-circuited by --dangerously-skip-permissions anyway) so there are
    // no cards and no privacy gate. acceptEdits/auto, by contrast, keep the
    // hook on and are enforced GUI-side by the permission overlay.
    let bypass = permission_mode.as_deref() == Some("bypassPermissions");
    let id = Uuid::new_v4().to_string();
    let event_name = format!("claude-stream:{}", id);

    // Register a buffer for this stream so the frontend can attach later
    // (refresh-resume). If the same chat session was streaming before
    // (rare — usually means user fired two sends back-to-back), evict
    // the old buffer entry so we don't grow unbounded.
    let chat_sid = chat_session_id.clone().unwrap_or_else(|| id.clone());
    {
        let mut streams = state.session_streams.lock();
        if let Some(prev_stream) = streams.insert(chat_sid.clone(), id.clone()) {
            state.buffers.lock().remove(&prev_stream);
        }
    }
    state.buffers.lock().insert(
        id.clone(),
        StreamBuffer {
            chat_session_id: chat_sid.clone(),
            lines: Vec::new(),
            ended: None,
        },
    );

    // Install / refresh the PreToolUse hook in this workspace so
    // destructive tool calls hit our permission card. If the perm
    // server didn't come up (port collision etc.) fall back to
    // dangerously-skip-permissions so the agent still works.
    let perm_endpoint = app
        .try_state::<crate::claude_perm::PermState>()
        .and_then(|s| {
            let port = *s.port.lock();
            let token = s.auth_token.lock().clone();
            match (port, token) {
                // Hook URL bakes in the per-startup auth token so a
                // drive-by request from another local process (or a
                // CORS-permissive simple POST from a malicious page)
                // can't trigger fake permission cards.
                (Some(p), Some(t)) => Some(format!(
                    "http://127.0.0.1:{}/permission?token={}",
                    p, t
                )),
                _ => None,
            }
        });
    let use_hooks = if bypass {
        // User opted into full bypass — don't install/refresh the hook.
        false
    } else if let (Some(endpoint), Some(workspace_cwd)) =
        (perm_endpoint.as_ref(), cwd.as_deref())
    {
        match ensure_pretooluse_hook(workspace_cwd, endpoint) {
            Ok(_) => true,
            Err(e) => {
                eprintln!("[claude_code] hook install failed: {} — falling back", e);
                false
            }
        }
    } else {
        false
    };

    // No permission guard available → REFUSE to run unless the user
    // has explicitly opted into the unguarded fallback. Silently
    // degrading to --dangerously-skip-permissions contradicted the
    // product's own red line: every Edit/Bash would have executed with
    // no card and no indication the guard was gone.
    // `bypass` is itself an explicit opt-in to unguarded execution, so it
    // doesn't trip the refusal below.
    if !use_hooks && !bypass && !allow_unguarded.unwrap_or(false) {
        state.buffers.lock().remove(&id);
        state.session_streams.lock().remove(&chat_sid);
        return Err(
            "Codetta's permission guard isn't available (the local permission \
             server failed to start, or no workspace folder is open), so this \
             chat would run Claude Code with --dangerously-skip-permissions. \
             Refusing by default. To accept unguarded runs, enable \
             \"Allow unguarded fallback\" in Settings → Claude Code — \
             Permission guard, then retry."
                .to_string(),
        );
    }

    // On the hooked path the CLI value is inert except for `plan` (the
    // overlay enforces acceptEdits/auto, and "auto" isn't even a valid CLI
    // mode). Pass only `plan`; everything else collapses to the CLI default.
    // Bypass takes use_hooks=false, so build_claude_command ignores this and
    // uses --dangerously-skip-permissions instead.
    let cli_mode = match permission_mode.as_deref() {
        Some("plan") => Some("plan"),
        _ => None,
    };
    let mut cmd = build_claude_command(
        &prompt,
        model.as_deref(),
        resume_session_id.as_deref(),
        cwd.as_deref(),
        use_hooks,
        effort.as_deref(),
        cli_mode,
    );
    // Extended-thinking toggle. There's no headless CLI flag for it,
    // but the CLI honors MAX_THINKING_TOKENS: 0 disables thinking,
    // a large budget forces it on. None = CLI default behavior.
    if let Some(t) = thinking {
        cmd.env("MAX_THINKING_TOKENS", if t { "31999" } else { "0" });
    }
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Run claude in its own process group so a stop reaches the whole
    // subtree (node + every tool/search child). Signalling only the
    // parent pid orphans those children → a runaway recursive search
    // keeps pinning the CPU and drags the whole machine down.
    // Brain: claude-stop-kills-process-group
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0); // new group; pgid == child pid
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW
        cmd.creation_flags(0x0000_0200 | 0x0800_0000);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn claude: {}", e))?;

    // Write the prompt to stdin and close it, so claude knows the input
    // is complete. Doing this in a thread to avoid blocking on a large
    // prompt vs. the OS pipe buffer.
    if let Some(mut stdin) = child.stdin.take() {
        let prompt_bytes = prompt.into_bytes();
        thread::spawn(move || {
            let _ = stdin.write_all(&prompt_bytes);
            // Drop stdin closes the pipe → EOF for claude.
        });
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "no stdout from claude".to_string())?;
    let stderr = child.stderr.take();

    // Record the pid so stop/kill can signal the whole process group
    // (see kill_process_tree) without ever locking the Child — the wait
    // thread below owns it and blocks in wait() for the entire run.
    let pid = child.id();
    state.children.lock().insert(id.clone(), pid);

    // Flipped to true once the process has been reaped, so the watchdog
    // stops polling and never signals a pid the OS may have recycled.
    let finished = Arc::new(AtomicBool::new(false));

    // Tracks the wall-clock instant of the most recent stdout/stderr
    // event so the watchdog thread can detect a hung subprocess. Stored
    // as i64 millis since the spawn instant — atomic for cross-thread
    // updates without a lock.
    let started = Instant::now();
    let last_activity = Arc::new(AtomicI64::new(0));

    // Reader thread for stdout — emit each line as a stream event.
    // Uses read_line directly instead of `.lines()` so a single huge
    // tool_result (Read on a large file, Bash with verbose stdout)
    // can't blow up against the default Lines iterator buffer cap.
    let app_for_stdout = app.clone();
    let event_for_stdout = event_name.clone();
    let id_for_stdout = id.clone();
    let last_activity_stdout = Arc::clone(&last_activity);
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut buf = String::with_capacity(8 * 1024);
        loop {
            buf.clear();
            match reader.read_line(&mut buf) {
                Ok(0) => break, // EOF
                Ok(_) => {
                    // Trim the trailing newline but keep the rest verbatim
                    // (a tool_result line can be arbitrarily long).
                    let line = buf.trim_end_matches(&['\n', '\r'][..]).to_string();
                    if line.is_empty() {
                        continue;
                    }
                    last_activity_stdout
                        .store(started.elapsed().as_millis() as i64, Ordering::Relaxed);
                    let payload = serde_json::json!({ "kind": "line", "line": line });
                    if let Some(state) = app_for_stdout.try_state::<ClaudeCodeState>() {
                        if let Some(buf) = state.buffers.lock().get_mut(&id_for_stdout) {
                            buf.lines.push(payload.clone());
                        }
                    }
                    let _ = app_for_stdout.emit(&event_for_stdout, payload);
                }
                Err(_) => break,
            }
        }
    });

    // Reader thread for stderr — surface errors as a separate event channel
    // so the frontend can show them in the chat result.
    if let Some(stderr) = stderr {
        let app_for_stderr = app.clone();
        let event_for_stderr = event_name.clone();
        let id_for_stderr = id.clone();
        let last_activity_stderr = Arc::clone(&last_activity);
        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut buf = String::with_capacity(2 * 1024);
            loop {
                buf.clear();
                match reader.read_line(&mut buf) {
                    Ok(0) => break,
                    Ok(_) => {
                        let line = buf.trim_end_matches(&['\n', '\r'][..]).to_string();
                        if line.is_empty() {
                            continue;
                        }
                        last_activity_stderr
                            .store(started.elapsed().as_millis() as i64, Ordering::Relaxed);
                        let payload =
                            serde_json::json!({ "kind": "stderr", "line": line });
                        if let Some(state) = app_for_stderr.try_state::<ClaudeCodeState>() {
                            if let Some(buf) = state.buffers.lock().get_mut(&id_for_stderr) {
                                buf.lines.push(payload.clone());
                            }
                        }
                        let _ = app_for_stderr.emit(&event_for_stderr, payload);
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Watchdog: if no stdout/stderr activity for IDLE_TIMEOUT after the
    // first event, kill the child and synthesize an error so the
    // frontend doesn't hang forever (anthropics/claude-code#1920).
    let app_for_watchdog = app.clone();
    let event_for_watchdog = event_name.clone();
    let id_for_watchdog = id.clone();
    let finished_watchdog = Arc::clone(&finished);
    let last_activity_watchdog = Arc::clone(&last_activity);
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(5));
            // Reaped already (exited or stopped)? Stop polling.
            if finished_watchdog.load(Ordering::Relaxed) {
                return;
            }
            let last = last_activity_watchdog.load(Ordering::Relaxed);
            // No activity yet (haven't even started streaming) — skip.
            if last == 0 {
                continue;
            }
            let now = started.elapsed().as_millis() as i64;
            if now - last > IDLE_TIMEOUT.as_millis() as i64 {
                // Hung. Kill the whole group and let the wait thread emit `end`.
                let payload = serde_json::json!({
                    "kind": "stderr",
                    "line": format!(
                        "[claude] no events for {}s — force-closing the stream (this is the documented anthropics/claude-code#1920 hang).",
                        IDLE_TIMEOUT.as_secs()
                    ),
                });
                if let Some(state) = app_for_watchdog.try_state::<ClaudeCodeState>() {
                    if let Some(buf) = state.buffers.lock().get_mut(&id_for_watchdog) {
                        buf.lines.push(payload.clone());
                    }
                }
                let _ = app_for_watchdog.emit(&event_for_watchdog, payload);
                kill_process_tree(pid);
                return;
            }
        }
    });

    // Waiter thread — owns the Child, emits `end` once the process exits.
    let app_for_wait = app.clone();
    let event_for_wait = event_name.clone();
    let id_for_wait = id.clone();
    let finished_wait = Arc::clone(&finished);
    thread::spawn(move || {
        let exit_code = match child.wait() {
            Ok(s) => s.code().unwrap_or(-1),
            Err(_) => -1,
        };
        // Let the watchdog stop polling before we touch shared state.
        finished_wait.store(true, Ordering::Relaxed);
        let payload = serde_json::json!({ "kind": "end", "code": exit_code });
        if let Some(state) = app_for_wait.try_state::<ClaudeCodeState>() {
            if let Some(buf) = state.buffers.lock().get_mut(&id_for_wait) {
                buf.lines.push(payload.clone());
                buf.ended = Some(exit_code);
            }
            state.children.lock().remove(&id_for_wait);
        }
        let _ = app_for_wait.emit(&event_for_wait, payload);
    });

    Ok(id)
}

/// Force-kill the claude subprocess together with everything it spawned.
/// claude runs in its own process group (see the spawn site), so a single
/// signal to the negated pid reaps node + all tool/search children at
/// once. Killing just the parent pid would orphan its children → a
/// mid-flight recursive file search keeps burning CPU and freezes the box.
/// Brain: claude-stop-kills-process-group
#[cfg(unix)]
fn kill_process_tree(pid: u32) {
    // SAFETY: a negative pid targets the whole process group; an
    // already-dead group just yields ESRCH, which we ignore.
    unsafe {
        libc::kill(-(pid as i32), libc::SIGKILL);
    }
}

#[cfg(windows)]
fn kill_process_tree(pid: u32) {
    use std::os::windows::process::CommandExt;
    // taskkill /T walks and kills the whole tree; /F forces it.
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .status();
}

/// Kill an in-flight claude process (and its whole subtree) by stream id.
/// We leave the map entry in place — the wait thread removes it once the
/// process is actually reaped, so `active_sessions` stays honest.
#[tauri::command]
pub fn claude_code_kill(state: State<'_, ClaudeCodeState>, id: String) -> Result<(), String> {
    if let Some(pid) = state.children.lock().get(&id).copied() {
        kill_process_tree(pid);
    }
    Ok(())
}

#[derive(serde::Serialize)]
pub struct AttachResult {
    /// Stream id the frontend should `listen` on for live events. Same
    /// `claude-stream:<id>` channel as `claude_code_chat` returns.
    pub stream_id: String,
    /// Every event we've emitted so far for this stream, in order. The
    /// frontend replays these through its normal parser before
    /// subscribing to live events, so a refresh restores the chat to
    /// exactly where it was — including in-flight tool calls and
    /// partial assistant text.
    pub lines: Vec<serde_json::Value>,
    /// Exit code if the subprocess has already finished. None = still
    /// running. The frontend uses this to decide whether to treat the
    /// chat as live (spinner) or terminal (just replay and stop).
    pub ended: Option<i32>,
}

/// Look up whether there's an in-flight (or recently-completed) stream
/// for this chat session id, and return its buffered events plus the
/// stream id to subscribe to. Returns `None` if no buffer exists, which
/// is the common case for chats that haven't been used since app start.
#[tauri::command]
pub fn claude_code_attach(
    state: State<'_, ClaudeCodeState>,
    chat_session_id: String,
) -> Option<AttachResult> {
    let stream_id = state
        .session_streams
        .lock()
        .get(&chat_session_id)
        .cloned()?;
    let buf = state.buffers.lock().get(&stream_id).cloned()?;
    Some(AttachResult {
        stream_id,
        lines: buf.lines,
        ended: buf.ended,
    })
}

/// List the chat-session ids whose subprocess is still alive. Powers the
/// global agent hub's "working" indicator: the hub matches each chat-tab
/// `sessionId` against this set without needing to mount its panel (the
/// mount-asymmetry gotcha). A session is "active" only while its child is
/// in the `children` map — the watchdog removes it on exit (`buf.ended`
/// is set at the same time), so a finished run drops out immediately.
#[tauri::command]
pub fn claude_code_active_sessions(state: State<'_, ClaudeCodeState>) -> Vec<String> {
    let children = state.children.lock();
    let streams = state.session_streams.lock();
    streams
        .iter()
        .filter(|(_, stream_id)| children.contains_key(*stream_id))
        .map(|(chat_sid, _)| chat_sid.clone())
        .collect()
}

/// Drop the buffer + reverse mapping for a chat session. Called by the
/// frontend after the user starts a fresh chat or explicitly clears, so
/// subsequent attaches for that session don't replay stale state.
#[tauri::command]
pub fn claude_code_clear_session(
    state: State<'_, ClaudeCodeState>,
    chat_session_id: String,
) -> Result<(), String> {
    if let Some(stream_id) = state.session_streams.lock().remove(&chat_session_id) {
        state.buffers.lock().remove(&stream_id);
    }
    Ok(())
}

#[derive(serde::Serialize, Clone)]
pub struct ClaudeSession {
    /// Session UUID — pass to `--resume` to continue this conversation.
    pub id: String,
    /// First user message of the session, trimmed to ~80 chars. Used as
    /// the picker entry's title.
    pub title: String,
    /// Last user message preview, trimmed to ~140 chars. Helps the user
    /// remember which session is which when titles look similar.
    pub preview: String,
    /// Total USD cost summed across all result events. May be 0 for
    /// subscription-only sessions where cost wasn't reported.
    pub cost_usd: f64,
    /// Number of user turns (i.e. distinct user messages) in the file.
    pub turn_count: usize,
    /// Unix epoch millis of the last modification to the JSONL file.
    pub last_turn_at_ms: u64,
}

/// List all Claude Code sessions persisted on disk for the given
/// workspace cwd. Reads `~/.claude/projects/<encoded-cwd>/*.jsonl`
/// and extracts a summary of each. Sorted newest-first.
#[tauri::command]
pub fn claude_code_list_sessions(cwd: String) -> Result<Vec<ClaudeSession>, String> {
    use std::fs;
    use std::time::SystemTime;

    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let encoded = encode_project_path(&cwd);
    let dir = home.join(".claude").join("projects").join(&encoded);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut sessions: Vec<ClaudeSession> = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let ext = path.extension().and_then(|x| x.to_str()).unwrap_or("");
        if ext != "jsonl" {
            continue;
        }
        let id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() {
            continue;
        }
        // Parse the file line-by-line to avoid loading huge sessions.
        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let mut first_user: Option<String> = None;
        let mut last_user: Option<String> = None;
        let mut cost_usd: f64 = 0.0;
        let mut turn_count: usize = 0;
        let reader = BufReader::new(file);
        let mut buf = String::with_capacity(4 * 1024);
        let mut r = reader;
        loop {
            buf.clear();
            match std::io::BufRead::read_line(&mut r, &mut buf) {
                Ok(0) => break,
                Ok(_) => {
                    let line = buf.trim();
                    if line.is_empty() {
                        continue;
                    }
                    let v: serde_json::Value = match serde_json::from_str(line) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    let ty = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
                    if ty == "user" {
                        if let Some(text) = extract_user_text(&v) {
                            // Skip system-generated user messages
                            // (tool_result blocks, etc) — only count
                            // genuine user turns.
                            if !text.trim().is_empty() {
                                if first_user.is_none() {
                                    first_user = Some(text.clone());
                                }
                                last_user = Some(text);
                                turn_count += 1;
                            }
                        }
                    } else if ty == "result" {
                        if let Some(c) = v.get("cost_usd").and_then(|x| x.as_f64()) {
                            cost_usd += c;
                        }
                    }
                }
                Err(_) => break,
            }
        }
        let title = first_user
            .as_deref()
            .map(|s| trim_oneline(s, 80))
            .unwrap_or_else(|| "(empty)".to_string());
        let preview = last_user
            .as_deref()
            .map(|s| trim_oneline(s, 140))
            .unwrap_or_default();
        let last_turn_at_ms = entry
            .metadata()
            .and_then(|m| m.modified())
            .map(|t| {
                t.duration_since(SystemTime::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0)
            })
            .unwrap_or(0);
        sessions.push(ClaudeSession {
            id,
            title,
            preview,
            cost_usd,
            turn_count,
            last_turn_at_ms,
        });
    }
    // Newest first.
    sessions.sort_by_key(|s| std::cmp::Reverse(s.last_turn_at_ms));
    Ok(sessions)
}

/// One reconstructed message from a saved session, in the same shape
/// the frontend's ChatMessage type uses. We emit the standard four
/// roles plus an optional `tool_results` array on assistant messages
/// so the UI can render Read / Edit / Bash output the same way it
/// does for fresh stream-json events.
#[derive(serde::Serialize, Clone)]
pub struct LoadedMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<LoadedToolCall>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tool_results: Vec<LoadedToolResult>,
}

#[derive(serde::Serialize, Clone)]
pub struct LoadedToolCall {
    /// Skip-if-none so the JSON omits the field entirely when there's
    /// no id, matching TypeScript's `id?: string` (undefined) rather
    /// than serializing as `null`. The chat UI uses `Map.get(c.id)`
    /// to pair calls with their results; `Map.get(null)` returns
    /// undefined and silently drops the pairing — looks like a UI
    /// bug in the rare case Claude Code omits the id.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub function: LoadedToolFunction,
}

#[derive(serde::Serialize, Clone)]
pub struct LoadedToolFunction {
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(serde::Serialize, Clone)]
pub struct LoadedToolResult {
    pub tool_use_id: String,
    pub content: String,
    pub is_error: Option<bool>,
}

/// Reconstruct the full message history of a saved Claude Code
/// session from its JSONL file. Coalesces tool_use blocks into the
/// assistant message they belong to, and matches tool_result blocks
/// to that same assistant message via tool_use_id (so the chat UI
/// can render results inline beneath their calls).
#[tauri::command]
pub fn claude_code_load_session(
    cwd: String,
    session_id: String,
) -> Result<Vec<LoadedMessage>, String> {
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let encoded = encode_project_path(&cwd);
    let path = home
        .join(".claude")
        .join("projects")
        .join(&encoded)
        .join(format!("{}.jsonl", session_id));
    if !path.exists() {
        return Err(format!("session {} not found at {:?}", session_id, path));
    }
    parse_session_jsonl(&path)
}

/// Result of loading one subagent's full transcript from disk. `agent_type`
/// and `description` come from the sibling `*.meta.json`.
#[derive(serde::Serialize)]
pub struct LoadedSubagent {
    pub agent_type: String,
    pub description: String,
    pub messages: Vec<LoadedMessage>,
}

/// Load the FULL transcript of one subagent (sidechain) run. Claude Code
/// writes each subagent to `<session>/subagents/agent-<id>.jsonl` with a
/// sibling `agent-<id>.meta.json` carrying `{agentType, description,
/// toolUseId}`. We locate the meta whose `toolUseId` matches the parent
/// Task tool-call, then parse its jsonl with the same reader as the main
/// session.
#[tauri::command]
pub fn claude_code_load_subagent(
    cwd: String,
    session_id: String,
    tool_use_id: String,
) -> Result<LoadedSubagent, String> {
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let encoded = encode_project_path(&cwd);
    let sub_dir = home
        .join(".claude")
        .join("projects")
        .join(&encoded)
        .join(&session_id)
        .join("subagents");
    if !sub_dir.exists() {
        return Err(format!("no subagents dir at {:?}", sub_dir));
    }
    for entry in std::fs::read_dir(&sub_dir).map_err(|e| e.to_string())? {
        let p = entry.map_err(|e| e.to_string())?.path();
        let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("");
        if !name.ends_with(".meta.json") {
            continue;
        }
        let txt = match std::fs::read_to_string(&p) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let meta: serde_json::Value = match serde_json::from_str(&txt) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if meta.get("toolUseId").and_then(|x| x.as_str()) != Some(tool_use_id.as_str()) {
            continue;
        }
        let base = name.trim_end_matches(".meta.json");
        let jsonl = sub_dir.join(format!("{}.jsonl", base));
        return Ok(LoadedSubagent {
            agent_type: meta
                .get("agentType")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            description: meta
                .get("description")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            messages: parse_session_jsonl(&jsonl)?,
        });
    }
    Err(format!("no subagent transcript for tool_use {}", tool_use_id))
}

/// Parse a Claude Code JSONL transcript (main session OR subagent) into our
/// message model. Coalesces tool_use blocks into the assistant message they
/// belong to and attaches tool_result blocks to the latest assistant message.
fn parse_session_jsonl(path: &std::path::Path) -> Result<Vec<LoadedMessage>, String> {
    use std::fs;
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let mut buf = String::with_capacity(8 * 1024);

    let mut messages: Vec<LoadedMessage> = Vec::new();

    loop {
        buf.clear();
        match std::io::BufRead::read_line(&mut reader, &mut buf) {
            Ok(0) => break,
            Ok(_) => {
                let line = buf.trim();
                if line.is_empty() {
                    continue;
                }
                let v: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let ty = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
                match ty {
                    "user" => {
                        // User messages may be a real prompt OR a
                        // tool_result echo. Collect text + any
                        // tool_results, attach the tool_results to
                        // the most recent assistant message.
                        let (text, results) = extract_user_blocks(&v);
                        if !results.is_empty() {
                            // Find the latest assistant message and
                            // append these tool_results to it.
                            if let Some(last_asst) = messages
                                .iter_mut()
                                .rev()
                                .find(|m| m.role == "assistant")
                            {
                                last_asst.tool_results.extend(results);
                            }
                        }
                        if !text.is_empty() {
                            messages.push(LoadedMessage {
                                role: "user".into(),
                                content: text,
                                tool_calls: Vec::new(),
                                tool_results: Vec::new(),
                            });
                        }
                    }
                    "assistant" => {
                        let (text, calls) = extract_assistant_blocks(&v);
                        // Skip empty assistant frames (Claude Code
                        // sometimes emits init-only assistant messages).
                        if text.is_empty() && calls.is_empty() {
                            continue;
                        }
                        messages.push(LoadedMessage {
                            role: "assistant".into(),
                            content: text,
                            tool_calls: calls,
                            tool_results: Vec::new(),
                        });
                    }
                    // System / result events are metadata only —
                    // skip them; the UI doesn't render them.
                    _ => {}
                }
            }
            Err(_) => break,
        }
    }

    Ok(messages)
}

fn extract_user_blocks(v: &serde_json::Value) -> (String, Vec<LoadedToolResult>) {
    let mut text = String::new();
    let mut results: Vec<LoadedToolResult> = Vec::new();
    let content = v.get("message").and_then(|m| m.get("content"));
    if let Some(s) = content.and_then(|c| c.as_str()) {
        text.push_str(s);
        return (text, results);
    }
    if let Some(arr) = content.and_then(|c| c.as_array()) {
        for block in arr {
            let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
            if bt == "text" {
                if let Some(t) = block.get("text").and_then(|x| x.as_str()) {
                    if !text.is_empty() {
                        text.push('\n');
                    }
                    text.push_str(t);
                }
            } else if bt == "tool_result" {
                let tool_use_id = block
                    .get("tool_use_id")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                // Content here can be a string or an array of blocks.
                let body = match block.get("content") {
                    Some(serde_json::Value::String(s)) => s.clone(),
                    Some(serde_json::Value::Array(items)) => items
                        .iter()
                        .filter_map(|b| {
                            let bt = b.get("type").and_then(|x| x.as_str())?;
                            if bt == "text" {
                                b.get("text").and_then(|x| x.as_str()).map(|s| s.to_string())
                            } else if bt == "image" {
                                Some("[image]".to_string())
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n"),
                    _ => String::new(),
                };
                let is_error = block.get("is_error").and_then(|x| x.as_bool());
                results.push(LoadedToolResult {
                    tool_use_id,
                    content: body,
                    is_error,
                });
            }
        }
    }
    (text, results)
}

fn extract_assistant_blocks(v: &serde_json::Value) -> (String, Vec<LoadedToolCall>) {
    let mut text = String::new();
    let mut calls: Vec<LoadedToolCall> = Vec::new();
    let content = v
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_array());
    let Some(arr) = content else {
        return (text, calls);
    };
    for block in arr {
        let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
        if bt == "text" {
            if let Some(t) = block.get("text").and_then(|x| x.as_str()) {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(t);
            }
        } else if bt == "tool_use" {
            calls.push(LoadedToolCall {
                id: block
                    .get("id")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string()),
                function: LoadedToolFunction {
                    name: block
                        .get("name")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string(),
                    arguments: block
                        .get("input")
                        .cloned()
                        .unwrap_or(serde_json::Value::Object(Default::default())),
                },
            });
        }
    }
    (text, calls)
}

/// Encode an absolute filesystem path the same way Claude Code does
/// when storing sessions: lowercase the drive letter (Windows only),
/// then replace any character that's not alphanumeric or '-' with '-'.
/// Verified against `~/.claude/projects/` entries on Windows + WSL.
fn encode_project_path(cwd: &str) -> String {
    // `mut` is only needed on Windows (drive-letter lowercase below);
    // the warning fires on other platforms where the block is empty.
    #[allow(unused_mut)]
    let mut s = cwd.to_string();
    #[cfg(windows)]
    {
        // "C:\Users\..." → "c:\Users\..." before the punctuation pass.
        if s.len() >= 2 && s.as_bytes()[1] == b':' {
            let first = s.chars().next().unwrap().to_lowercase().to_string();
            s = first + &s[1..];
        }
    }
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect()
}

/// Extract the user-visible text from a stream-json `user` entry.
/// Handles both string and array-of-blocks shapes; returns None when
/// the entry only contains tool_result / image blocks.
fn extract_user_text(v: &serde_json::Value) -> Option<String> {
    let msg = v.get("message")?;
    let content = msg.get("content")?;
    if let Some(s) = content.as_str() {
        return Some(s.to_string());
    }
    if let Some(arr) = content.as_array() {
        let mut out = String::new();
        for block in arr {
            let bt = block.get("type").and_then(|x| x.as_str()).unwrap_or("");
            if bt == "text" {
                if let Some(t) = block.get("text").and_then(|x| x.as_str()) {
                    if !out.is_empty() {
                        out.push('\n');
                    }
                    out.push_str(t);
                }
            }
        }
        if !out.is_empty() {
            return Some(out);
        }
    }
    None
}

fn trim_oneline(s: &str, max: usize) -> String {
    let line = s.lines().next().unwrap_or("").trim();
    if line.chars().count() <= max {
        return line.to_string();
    }
    let mut out: String = line.chars().take(max).collect();
    out.push('…');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression for the v0.2.0 dogfooding bug where the hook script
    /// exited 0 with no stdout, and Claude Code's harness blocked the
    /// agent's tool call as a hook error. The hook MUST always emit
    /// the structured `hookSpecificOutput.permissionDecision` JSON.
    #[test]
    fn hook_command_embeds_protocol_output() {
        let cmd = build_hook_command(
            "http://127.0.0.1:14272/permission?token=abc",
        );
        // Sanity: it's a node -e invocation
        assert!(cmd.starts_with("node -e \""));
        // The hook protocol JSON shape must be emitted on every code path
        assert!(
            cmd.contains("hookSpecificOutput"),
            "hook script must always emit hookSpecificOutput JSON"
        );
        assert!(
            cmd.contains("permissionDecision"),
            "hook script must always emit a permissionDecision"
        );
        // Three explicit code paths must call out(...) — server response,
        // connection error, timeout — so the hook never silently exits
        // with empty stdout.
        let out_count = cmd.matches("out(").count();
        assert!(
            out_count >= 3,
            "expected ≥3 out(...) calls (server/error/timeout); got {}",
            out_count
        );
        // Token query string must be preserved (we use pathname+search,
        // not pathname alone). Otherwise the server returns 403.
        assert!(
            cmd.contains("u.pathname+u.search"),
            "hook must POST to pathname+search so the auth token survives"
        );
    }

    /// CC's project-dir encoding: lowercase Windows drive letter,
    /// every non-alphanumeric becomes '-'. Verified against actual
    /// `~/.claude/projects/` entries on disk.
    #[test]
    fn encode_project_path_matches_claude_code() {
        // Windows-style absolute path
        if cfg!(windows) {
            assert_eq!(
                encode_project_path("C:\\Users\\Bishal-SEO\\Documents\\Codes\\lite-coder-pro"),
                "c--Users-Bishal-SEO-Documents-Codes-lite-coder-pro"
            );
        }
        // POSIX path (always run, since the alphanumeric branch is
        // platform-independent)
        assert_eq!(
            encode_project_path("/home/user/projects/foo"),
            "-home-user-projects-foo"
        );
        // Path with dots
        assert_eq!(
            encode_project_path("/var/lib/app.v2/data"),
            "-var-lib-app-v2-data"
        );
    }

    /// Claude Code stream-json `user` events can carry plain text OR
    /// an array of blocks (text + tool_result + image). Loader must
    /// pull both shapes correctly.
    #[test]
    fn extract_user_blocks_handles_string_and_array_content() {
        // Plain string content
        let v = serde_json::json!({
            "type": "user",
            "message": { "content": "what's up" }
        });
        let (text, results) = extract_user_blocks(&v);
        assert_eq!(text, "what's up");
        assert!(results.is_empty());

        // Array with tool_result block
        let v = serde_json::json!({
            "type": "user",
            "message": {
                "content": [
                    { "type": "tool_result", "tool_use_id": "abc", "content": "file contents" }
                ]
            }
        });
        let (text, results) = extract_user_blocks(&v);
        assert!(text.is_empty());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].tool_use_id, "abc");
        assert_eq!(results[0].content, "file contents");

        // Array with mixed text + tool_result
        let v = serde_json::json!({
            "type": "user",
            "message": {
                "content": [
                    { "type": "text", "text": "hello" },
                    { "type": "tool_result", "tool_use_id": "x", "content": "ok" }
                ]
            }
        });
        let (text, results) = extract_user_blocks(&v);
        assert_eq!(text, "hello");
        assert_eq!(results.len(), 1);
    }

    /// trim_oneline must not panic on multibyte chars at the boundary
    /// — naive `.slice(0, max)` would crash on non-ASCII. We use
    /// `chars().take()` so this works.
    #[test]
    fn trim_oneline_handles_multibyte() {
        // ASCII shorter than max — verbatim
        assert_eq!(trim_oneline("hello", 80), "hello");
        // Multibyte that fits
        assert_eq!(trim_oneline("héllo", 80), "héllo");
        // Multibyte that overflows — must not panic
        let long = "héllo wörld ".repeat(20);
        let trimmed = trim_oneline(&long, 10);
        assert_eq!(trimmed.chars().count(), 11); // 10 chars + ellipsis
        assert!(trimmed.ends_with('…'));
        // Multi-line — keep only the first
        assert_eq!(
            trim_oneline("first line\nsecond line", 80),
            "first line"
        );
    }
}
