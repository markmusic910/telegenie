#!/usr/bin/env bash
# Vendored teleproto (git subtree). Source lives in packages/teleproto.
# Upstream: https://github.com/sanyok12345/teleproto
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PREFIX="packages/teleproto"
REMOTE="${TELEPROTO_REMOTE:-https://github.com/sanyok12345/teleproto.git}"
BRANCH="${TELEPROTO_BRANCH:-main}"

cd "$ROOT"

usage() {
  cat <<'EOF'
Usage: yarn teleproto:<command>

  yarn teleproto:pull    Merge the latest upstream teleproto into packages/teleproto
  yarn teleproto:help    Show this help

Customize teleproto by editing files under packages/teleproto and committing on main.

On pull conflicts, keep your local changes in customized files (often package.json
and teleproto/crypto, teleproto/platform). Those are TeleGenie-only so teleproto
can run in the web worker (Web Crypto + JS AES, no Node builtins).
Override remote/branch with TELEPROTO_REMOTE and TELEPROTO_BRANCH.
EOF
}

require_clean_worktree() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Working tree must be clean before pulling teleproto." >&2
    exit 1
  fi
}

cmd="${1:-help}"

case "$cmd" in
  pull)
    require_clean_worktree
    echo "Pulling ${REMOTE} (${BRANCH}) into ${PREFIX}"
    git subtree pull --prefix="$PREFIX" "$REMOTE" "$BRANCH" --squash
    echo "Done. Review the merge commit, then yarn to refresh the lockfile if package.json changed."
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
