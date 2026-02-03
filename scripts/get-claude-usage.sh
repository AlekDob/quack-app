#!/bin/bash
# Get Claude Code usage statistics by capturing /status output

# Use expect to interact with Claude CLI
expect << 'EOF' 2>/dev/null
set timeout 10
log_user 0

spawn claude

# Wait for prompt
expect {
    ">" {
        send "/status\r"
    }
    timeout {
        exit 1
    }
}

# Wait for status to load and switch to Usage tab
sleep 2
send "\t\t\t"
sleep 1

# Capture output
log_user 1
expect {
    -re "Current session.*\n.*\n.*\n.*Current week.*\n.*\n.*\n.*Current week.*\n.*\n.*" {
        puts $expect_out(0,string)
    }
    timeout {
        # Try to get whatever is on screen
    }
}

# Exit Claude
send "\x03"
expect eof
EOF
