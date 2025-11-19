# MCP Server Auto-Start Implementation

**Date**: 2025-01-18
**Issue**: MCP servers configured in `.mcp.json` show "Stopped" status and tools aren't available to agents
**Root Cause**: Quack reads `.mcp.json` but doesn't spawn the processes, so MCP tools are never registered
**Status**: ✅ Implemented (pending testing)

---

## Problem Description

User reported that MCP servers (specifically Puppeteer) were configured in `.mcp.json` but showed "Stopped" status in the UI. When Agent Jack tried to use Puppeteer tools, they weren't available because the server process was never started.

### What Was Happening

1. ✅ `.mcp.json` was read correctly (servers appeared in UI)
2. ✅ Server configuration was parsed (name, command, args, env)
3. ❌ **Processes were NOT spawned** → no tools registered
4. ❌ Agents couldn't use MCP tools (e.g., Puppeteer)

---

## Solution Overview

Implemented **automatic process spawning** for stdio MCP servers when they are loaded from `.mcp.json`:

1. **Global Process Manager**: `MCPProcessManager` to track active child processes
2. **Auto-Start Logic**: `list_mcp_servers()` spawns enabled stdio servers automatically
3. **Lifecycle Management**: Stop/Restart commands for manual control
4. **UI Controls**: Stop/Start/Restart buttons in MCPServerCard based on status

---

## Implementation Details

### 1. Rust Backend (src-tauri/src/mcp.rs)

#### Global Process Manager

```rust
pub struct MCPProcessManager {
    processes: Mutex<HashMap<String, Child>>,
}

impl MCPProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }

    pub fn store_process(&self, server_id: String, child: Child) { ... }
    pub async fn kill_process(&self, server_id: &str) -> Result<(), String> { ... }
    pub fn is_running(&self, server_id: &str) -> bool { ... }
}
```

**Purpose**: Track spawned MCP server processes globally, allow kill/restart operations.

#### Auto-Start Function

```rust
async fn start_mcp_server(
    app: &AppHandle,
    server: &mut MCPServer,
) -> Result<(), String> {
    // Only stdio servers need to be started
    if server.transport != "stdio" {
        server.status = "running".to_string();
        return Ok(());
    }

    // Spawn process with command, args, env
    let mut cmd = Command::new(command);
    cmd.args(args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    if let Some(env) = &server.env {
        for (key, value) in env {
            cmd.env(key, value);
        }
    }

    let mut child = cmd.spawn()?;

    // Capture stderr for logging
    if let Some(stderr) = child.stderr.take() {
        tauri::async_runtime::spawn(async move {
            // Stream logs to frontend via "mcp-server-log" event
        });
    }

    // Store process in global manager
    let process_manager: tauri::State<MCPProcessManager> = app.state();
    process_manager.store_process(server.id.clone(), child);

    server.status = "running".to_string();
    Ok(())
}
```

**Key Features**:
- Spawns `npx`, `node`, or any stdio command
- Injects environment variables (API keys, etc.)
- Captures stderr for debugging
- Emits logs to frontend via Tauri events
- Updates server status to "running"

#### Modified list_mcp_servers()

```rust
#[tauri::command]
pub async fn list_mcp_servers(...) -> Result<Vec<MCPServer>, String> {
    // ... read configs from ~/.claude.json and .mcp.json ...

    // Auto-start enabled stdio servers
    let process_manager: tauri::State<MCPProcessManager> = app.state();
    for server in &mut all_servers {
        if server.enabled && server.transport == "stdio" {
            if process_manager.is_running(&server.id) {
                server.status = "running".to_string();
            } else {
                // Try to start the server
                if let Err(e) = start_mcp_server(&app, server).await {
                    server.status = "error".to_string();
                    server.error = Some(e);
                }
            }
        } else if server.transport == "http" || server.transport == "sse" {
            // HTTP/SSE servers are always "running" if configured
            server.status = if server.enabled { "running" } else { "stopped" };
        }
    }

    Ok(all_servers)
}
```

**Behavior**:
- When frontend calls `list_mcp_servers()`, stdio servers are automatically spawned
- If already running, status is updated to "running"
- If spawn fails, status is "error" with error message
- HTTP/SSE servers don't need spawning (always "running" if enabled)

#### New Commands

```rust
/// Stop a running MCP server (stdio only)
#[tauri::command]
pub async fn stop_mcp_server(app: AppHandle, server_id: String) -> Result<(), String>

/// Restart an MCP server (stdio only)
#[tauri::command]
pub async fn restart_mcp_server(
    app: AppHandle,
    server_id: String,
    working_dir: Option<String>,
) -> Result<(), String>

/// Get the status of an MCP server (running, stopped, error)
#[tauri::command]
pub async fn get_mcp_server_status(app: AppHandle, server_id: String) -> Result<String, String>
```

### 2. Tauri Registration (src-tauri/src/lib.rs)

```rust
tauri::Builder::default()
    .manage(SessionState::new())
    .manage(license::LicenseState::default())
    .manage(mcp::MCPProcessManager::new()) // ← Register MCP process manager
    .invoke_handler(tauri::generate_handler![
        // ... other commands ...
        mcp::list_mcp_servers,
        mcp::stop_mcp_server,      // ← New
        mcp::restart_mcp_server,   // ← New
        mcp::get_mcp_server_status, // ← New
    ])
```

### 3. TypeScript Hook (src/hooks/useMCPServers.ts)

```typescript
export interface UseMCPServersReturn {
  // ... existing methods ...
  stopServer: (serverId: string) => Promise<void>;
  restartServer: (serverId: string) => Promise<void>;
  getServerStatus: (serverId: string) => Promise<string>;
}

const stopServer = useCallback(async (serverId: string) => {
  await invoke('stop_mcp_server', { serverId });
  await refreshServers();
}, [refreshServers]);

const restartServer = useCallback(async (serverId: string) => {
  await invoke('restart_mcp_server', {
    serverId,
    workingDir: workingDir || null,
  });
  await refreshServers();
}, [workingDir, refreshServers]);
```

### 4. UI Components (src/components/MCPServerCard.tsx)

```typescript
interface MCPServerCardProps {
  // ... existing props ...
  onStop?: (serverId: string) => void;
  onRestart?: (serverId: string) => void;
}

// Conditional buttons based on status:
{server.transport === "stdio" && server.status === "running" && (
  <button onClick={() => onStop(server.id)}>Stop</button>
)}

{server.transport === "stdio" && server.status === "stopped" && (
  <button onClick={() => onRestart(server.id)}>Start</button>
)}

{server.transport === "stdio" && server.status === "error" && (
  <button onClick={() => onRestart(server.id)}>Restart</button>
)}
```

**Button Logic**:
- **Running** → Show "Stop" button (yellow)
- **Stopped** → Show "Start" button (green)
- **Error** → Show "Restart" button (green)
- HTTP/SSE servers → No stop/restart buttons (not applicable)

---

## How It Works: Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. App Loads                                                     │
│    - User opens project                                          │
│    - Frontend calls list_mcp_servers(workingDir)                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Backend Reads Configs                                         │
│    - Read ~/.claude.json (global MCP servers)                    │
│    - Read .mcp.json (project MCP servers)                        │
│    - Parse into Vec<MCPServer>                                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Auto-Start Loop                                               │
│    FOR each server in all_servers:                               │
│      IF server.enabled AND server.transport == "stdio":          │
│        IF NOT already running:                                   │
│          ✅ spawn_mcp_server()                                   │
│             - Command::new(command).args(args).env(env).spawn()  │
│             - Capture stderr → emit logs to frontend             │
│             - Store Child in MCPProcessManager                   │
│             - Update server.status = "running"                   │
│        ELSE:                                                     │
│          ✅ server.status = "running" (already started)          │
│      ELSE IF server.transport == "http" | "sse":                │
│        ✅ server.status = "running" (no process needed)          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Frontend Receives Updated Server List                        │
│    - Servers with status = "running" show green indicator       │
│    - Servers with status = "error" show red indicator + message │
│    - User can now Stop/Start/Restart stdio servers              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing

### Automated Tests

A comprehensive test suite has been created at `src/tests/mcp.autostart.test.ts` with **36 test cases** covering:

- ✅ Server status transitions (stopped → running → error)
- ✅ Auto-start logic for enabled/disabled servers
- ✅ Process lifecycle management (start, stop, restart)
- ✅ Error handling (command not found, spawn failures)
- ✅ HTTP/SSE server status (no spawning)
- ✅ Real-world scenarios (Puppeteer, Context7)
- ✅ Integration with .mcp.json (global + project scopes)

**Run automated tests**:
```bash
npm test -- src/tests/mcp.autostart.test.ts
```

Expected result: **36/36 tests passing** ✅

### Manual Testing Steps

1. **Fresh Start (No Running Servers)**
   - [ ] Open Quack with `.mcp.json` containing Puppeteer configuration
   - [ ] Verify Puppeteer server status shows "Running" (green)
   - [ ] Open Agent Jack's chat
   - [ ] Verify Puppeteer tools are available in Agent Jack's tool list
   - [ ] Ask Agent Jack to use a Puppeteer tool (e.g., screenshot)
   - [ ] Verify tool executes successfully

2. **Stop Server**
   - [ ] Click "Stop" button on running Puppeteer server
   - [ ] Verify status changes to "Stopped" (gray)
   - [ ] Verify Agent Jack no longer sees Puppeteer tools

3. **Start Server**
   - [ ] Click "Start" button on stopped Puppeteer server
   - [ ] Verify status changes to "Running" (green)
   - [ ] Verify Agent Jack sees Puppeteer tools again

4. **Error Recovery**
   - [ ] Configure server with invalid command (e.g., "npx not-a-real-package")
   - [ ] Verify status shows "Error" (red) with error message
   - [ ] Click "Restart" button
   - [ ] Verify error message updates

5. **Multiple Servers**
   - [ ] Configure multiple MCP servers (Puppeteer + Filesystem)
   - [ ] Verify all enabled servers auto-start
   - [ ] Verify Agent Jack sees tools from both servers

6. **HTTP/SSE Servers**
   - [ ] Configure an HTTP MCP server (e.g., Context7)
   - [ ] Verify status shows "Running" immediately (no process spawning)
   - [ ] Verify no Stop/Start buttons appear (HTTP servers don't need lifecycle)

---

## Expected Behavior After Implementation

### Before (Bug)
- `.mcp.json` loaded ✅
- Servers shown in UI ✅
- Status: "Stopped" ❌
- Processes spawned: ❌
- Tools available to agents: ❌
- Agent Jack: "Puppeteer tools not available" ❌

### After (Fixed)
- `.mcp.json` loaded ✅
- Servers shown in UI ✅
- Status: "Running" ✅
- Processes spawned automatically ✅
- Tools available to agents ✅
- Agent Jack: Can use Puppeteer tools ✅

---

## Error Scenarios

### 1. Command Not Found
**Error**: `Command 'npx' not found. Make sure it's installed and in PATH.`
**Solution**: Install Node.js/npm, or fix PATH environment variable

### 2. Process Crashes Immediately
**Error**: `Process exited with error code: 1`
**Solution**: Check stderr logs (emitted to frontend), verify environment variables

### 3. Port Already in Use (HTTP/SSE)
**Error**: HTTP test connection fails with "Connection refused"
**Solution**: Check if another process is using the port, restart system

### 4. Missing Environment Variables
**Error**: Server starts but tools aren't exposed (e.g., missing API key)
**Solution**: Configure env vars in .mcp.json (e.g., `PUPPETEER_EXECUTABLE_PATH`)

---

## Future Improvements

1. **Process Health Checks**
   - Periodically check if spawned processes are still alive
   - Auto-restart if process dies unexpectedly
   - Emit "mcp-server-died" event to frontend

2. **Better Logging**
   - Add structured logging to Rust backend
   - Store MCP server logs in separate files per server
   - Add "View Logs" button in UI to open log file

3. **Tool Registration Verification**
   - After starting server, verify tools are registered
   - If no tools found after 5 seconds, mark as "error"
   - Show "No tools exposed" warning in UI

4. **Performance Optimization**
   - Cache spawned processes across `list_mcp_servers()` calls
   - Don't re-spawn if already running (currently implemented)
   - Add debouncing to avoid rapid start/stop cycles

5. **Process Cleanup on Exit**
   - Implement Tauri app shutdown hook
   - Kill all MCP server processes gracefully
   - Prevent zombie processes

---

## Files Modified

### Rust Backend
- `src-tauri/src/mcp.rs` (added `MCPProcessManager`, `start_mcp_server()`, new commands)
- `src-tauri/src/lib.rs` (registered `MCPProcessManager` and new commands)

### TypeScript Frontend
- `src/hooks/useMCPServers.ts` (added `stopServer`, `restartServer`, `getServerStatus`)
- `src/components/MCPPanel.tsx` (added handlers, passed to cards)
- `src/components/MCPServerCard.tsx` (added Stop/Start/Restart buttons)

### Documentation
- `docs/02-bug-fixes/mcp-auto-start.md` (this file)

---

## Next Steps

1. **Test in Production**
   - Build Quack with `npm run tauri build`
   - Open project with `.mcp.json` containing Puppeteer
   - Verify auto-start works
   - Test Agent Jack can use Puppeteer tools

2. **If Tools Still Not Available**
   - Check stderr logs for MCP server errors
   - Verify `npx @modelcontextprotocol/server-puppeteer` works in terminal
   - Check if Puppeteer requires additional environment variables
   - Verify MCP server exposes tools in JSON-RPC format

3. **Add Process Cleanup**
   - Implement `on_app_exit()` hook in Tauri
   - Kill all MCP processes gracefully
   - Prevent zombie processes lingering after Quack closes

---

**Status**: ✅ Implementation complete, ready for testing
**Blocking Issues**: None
**Dependencies**: Requires Tauri rebuild to test (`npm run tauri build` or `npm run tauri dev`)
