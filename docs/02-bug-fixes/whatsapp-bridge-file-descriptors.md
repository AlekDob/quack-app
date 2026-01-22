# WhatsApp Bridge - "Too Many Open Files" Error

## Problem

When running the Go WhatsApp bridge, you may encounter:
```
http: Accept error: accept tcp [::]:8080: accept: too many open files in system; retrying in 5ms
```

## Cause

This is a **system resource limit issue**, NOT caused by the Quack watcher integration. The Go HTTP server is hitting the OS limit for open file descriptors.

## Quick Fix

```bash
# Check current limit
ulimit -n

# Temporarily increase limit (for current terminal session)
ulimit -n 4096

# Restart the Go bridge
cd ~/Desktop/Dev/Personal/whatsapp-mcp/whatsapp-bridge
go run main.go
```

## Permanent Fix (macOS)

Add to `~/.zshrc` or `~/.bash_profile`:
```bash
ulimit -n 4096
```

## Alternative: Fix in Go Code

The Go bridge should implement proper connection handling:

```go
// In main.go
server := &http.Server{
    Addr:         ":8080",
    Handler:      router,
    ReadTimeout:  15 * time.Second,
    WriteTimeout: 15 * time.Second,
    IdleTimeout:  60 * time.Second,
}

// Add graceful shutdown
go func() {
    if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatalf("Server error: %v", err)
    }
}()

// Listen for interrupt signal
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
server.Shutdown(ctx)
```

## Verification

After applying the fix:
1. Check the limit: `ulimit -n` should show 4096 or higher
2. Restart the Go bridge
3. Monitor for the error (should not appear anymore)
4. Test the Quack integration again with `@quack` messages

## Notes

- The Quack watcher makes only 1 HTTP connection at a time
- This error is unrelated to our integration
- Default macOS limit is typically 256 (too low for HTTP servers)
