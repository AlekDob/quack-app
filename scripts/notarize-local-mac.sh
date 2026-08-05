#!/bin/bash
# Local signed + notarized macOS DMG build.
# Credentials live in quack-app/.env (Developer ID cert must also be in the login keychain).
set -e

ENV_FILE="$HOME/Desktop/Dev/Personal/quack-app/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export APPLE_APP_SPECIFIC_PASSWORD="$APPLE_PASSWORD"
export CSC_NAME="${APPLE_SIGNING_IDENTITY#Developer ID Application: }"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/build-desktop-artifact.ts" --platform mac --target dmg --arch "${1:-arm64}" --signed --verbose
