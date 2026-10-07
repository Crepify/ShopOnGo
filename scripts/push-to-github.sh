#!/usr/bin/env bash
set -euo pipefail

REMOTE_URL="https://github.com/Crepify/ShopOnGo.git"
BRANCH="main"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this script from the project directory." >&2
  exit 1
fi

git remote get-url origin >/dev/null 2>&1 || git remote add origin "$REMOTE_URL"

echo "This reads the token locally and never writes it into git config, the remote URL, or a file."
read -r -s -p "GitHub PAT: " GITHUB_TOKEN
echo
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "No token supplied." >&2
  exit 1
fi

ASKPASS_SCRIPT="$(mktemp)"
cleanup() {
  rm -f "$ASKPASS_SCRIPT"
  unset GITHUB_TOKEN
}
trap cleanup EXIT

cat > "$ASKPASS_SCRIPT" <<'ASKPASS'
#!/usr/bin/env sh
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$GITHUB_TOKEN" ;;
  *) printf '%s\n' "$GITHUB_TOKEN" ;;
esac
ASKPASS
chmod 700 "$ASKPASS_SCRIPT"

GIT_ASKPASS="$ASKPASS_SCRIPT" \
GIT_TERMINAL_PROMPT=0 \
GITHUB_TOKEN="$GITHUB_TOKEN" \
git -c credential.helper= push -u origin "$BRANCH"

echo "Push complete: $REMOTE_URL"
