.PHONY: mac-app mac-app-dist

# Build a local arm64 macOS DMG into ./release (installs deps first).
mac-app:
	bun install
	bun run dist:desktop:dmg:arm64

# Build a signed + notarized arm64 macOS DMG into ./release (installs deps first).
# Credentials read from quack-app/.env by scripts/notarize-local-mac.sh.
mac-app-dist:
	bun install
	bun run dist:desktop:dmg:arm64:signed
