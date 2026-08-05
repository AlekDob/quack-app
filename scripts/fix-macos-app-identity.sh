#!/bin/sh
# Stops the endless macOS "wants access to..." prompts for a locally built Quack.
#
# Root cause: local builds are only ad-hoc/linker-signed, but they ship Synara's
# bundle id (com.emanueledipietro.synara), which TCC has on record bound to
# Synara's Developer ID signature. The identity never matches, so macOS can't
# persist any grant and re-asks forever. Fix = own bundle id + a valid signature.
#
# Usage: quit Quack, then: sh scripts/fix-macos-app-identity.sh [/Applications/Quack.app]
set -eu

APP="${1:-/Applications/Quack.app}"
BUNDLE_ID="${QUACK_BUNDLE_ID:-com.alekdob.quack}"

[ -d "$APP" ] || { echo "not found: $APP" >&2; exit 1; }
if pgrep -qx Quack; then echo "Quit Quack first (it is running)." >&2; exit 1; fi

ENT="$(mktemp -t quack-entitlements)"
cat > "$ENT" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
  <key>com.apple.security.device.audio-input</key><true/>
</dict></plist>
PLIST

set_id() { /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $2" "$1/Contents/Info.plist"; }

# Sign inside-out: helpers, then frameworks, then the app bundle itself.
for helper in "$APP"/Contents/Frameworks/*.app; do
  [ -d "$helper" ] || continue
  suffix=$(basename "$helper" .app | sed 's/.*Helper//' | tr -d '() ' | tr 'A-Z' 'a-z')
  helper_id="$BUNDLE_ID.helper${suffix:+.$suffix}"
  set_id "$helper" "$helper_id"
  codesign --force --sign - --timestamp=none --options runtime \
    --entitlements "$ENT" --identifier "$helper_id" "$helper"
done

for fw in "$APP"/Contents/Frameworks/*.framework; do
  [ -d "$fw" ] || continue
  codesign --force --deep --sign - --timestamp=none "$fw"
done

set_id "$APP" "$BUNDLE_ID"
codesign --force --sign - --timestamp=none --options runtime \
  --entitlements "$ENT" --identifier "$BUNDLE_ID" "$APP"
rm -f "$ENT"

# The check: a sealed, verifiable signature is exactly what TCC needs to remember grants.
codesign --verify --strict "$APP"
codesign -dvv "$APP" 2>&1 | grep -E "Identifier|Signature|Sealed"
echo "Done. Launch Quack, approve each prompt ONCE — it will not ask again."
