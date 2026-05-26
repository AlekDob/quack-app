#!/usr/bin/env bash
# Install repo-managed git hooks via symlinks into .git/hooks/.
# Run once per fresh clone. Idempotent.

set -e

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x scripts/git-hooks/pre-commit
echo "Installed: .git/hooks/pre-commit -> scripts/git-hooks/pre-commit"
