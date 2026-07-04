#!/bin/bash
# Load only APPLE_SIGNING_IDENTITY from .env for Tauri build.
# We intentionally DO NOT export APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID here
# because Tauri would attempt automatic notarization before all embedded
# binaries are signed. Full signing + notarization is handled by
# scripts/sign-and-notarize.sh after the build.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
    IDENTITY=$(grep 'APPLE_SIGNING_IDENTITY=' "$ENV_FILE" | sed 's/^export //' | cut -d= -f2- | sed 's/^"//;s/"$//')
    if [ -n "$IDENTITY" ]; then
        export APPLE_SIGNING_IDENTITY="$IDENTITY"
    fi
fi
