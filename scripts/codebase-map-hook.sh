#!/bin/bash
# Codebase Map Hook - PostToolUse wrapper for Write|Edit
# Reads Claude Code hook JSON from stdin, extracts file_path, runs incremental update.

SCRIPT_DIR="$(dirname "$0")"
GENERATOR="$SCRIPT_DIR/generate-codebase-map.mjs"
MAP_PATH=".quack/codebase-map.md"

# Read JSON from stdin
INPUT=$(cat)

# Extract file_path from tool_input (works for both Write and Edit tools)
FILE_PATH=$(echo "$INPUT" | node -e "
  let data = '';
  process.stdin.on('data', chunk => data += chunk);
  process.stdin.on('end', () => {
    try {
      const json = JSON.parse(data);
      const fp = json.tool_input?.file_path || '';
      process.stdout.write(fp);
    } catch { process.exit(0); }
  });
")

# Skip if no file path or not a TS/TSX file
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.ts|*.tsx|*.swift) ;;
  *) exit 0 ;;
esac

# Run incremental update
node "$GENERATOR" --update-file "$FILE_PATH" . "$MAP_PATH" 2>/dev/null

exit 0
