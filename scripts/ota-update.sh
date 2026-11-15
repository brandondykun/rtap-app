#!/usr/bin/env bash
# Publishes an over-the-air update to one channel, then uploads its source maps to Sentry.
#   scripts/ota-update.sh preview "What changed"
#   scripts/ota-update.sh production "What changed"
set -euo pipefail

channel="${1:-}"
message="${2:-}"

case "$channel" in
  preview | production) ;;
  *)
    echo 'Usage: scripts/ota-update.sh preview "What changed"   (or production)'
    exit 1
    ;;
esac
if [ -z "$message" ]; then
  echo "Give the update a message: scripts/ota-update.sh $channel \"What changed\""
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo 'Commit or stash your changes first, so the update matches a commit.'
  exit 1
fi

# The store app gets updates only from a release branch, so work on main can't reach it even with a matching fingerprint.
branch=$(git branch --show-current)
if [ "$channel" = production ] && [[ "$branch" != release/* ]]; then
  echo "Production updates come from a release branch, not ${branch:-a detached HEAD}: git switch release/1.x"
  exit 1
fi

eas() { npx --yes eas-cli@latest "$@"; }

# An update only reaches builds with the same native fingerprint, and each platform has its own. Publish to the
# platforms whose latest build matches, skip a platform with no build on this channel yet, and refuse when no phone
# would run the update.
matched=()
stale=()
for p in ios android; do
  local_runtime=$(APP_VARIANT="$channel" npx expo-updates runtimeversion:resolve --platform "$p" 2>/dev/null |
    node -pe 'JSON.parse(require("fs").readFileSync(0)).runtimeVersion')
  build_runtime=$(eas build:list --channel "$channel" --platform "$p" --status finished --limit 1 --json --non-interactive 2>/dev/null |
    node -pe 'JSON.parse(require("fs").readFileSync(0))[0]?.runtime?.version ?? ""')
  if [ -z "$build_runtime" ]; then
    echo "  $p: no $channel build yet, skipping"
  elif [ "$local_runtime" = "$build_runtime" ]; then
    echo "  $p: matches the latest $channel build"
    matched+=("$p")
  else
    echo "  $p: native code has changed since the latest $channel build (runtime $build_runtime → $local_runtime)"
    stale+=("$p")
  fi
done

if [ ${#matched[@]} -eq 0 ]; then
  echo "No installed $channel app would run this update. Make a new build instead: scripts/build.sh"
  exit 1
fi
if [ ${#stale[@]} -gt 0 ]; then
  echo "This update will reach ${matched[*]} only; ${stale[*]} needs a new build (scripts/build.sh)."
  read -r -n 1 -p 'Publish anyway? [y/N] ' key || key=''
  echo
  if [[ "$key" != [yY] ]]; then
    echo 'Cancelled.'
    exit 0
  fi
fi
if [ ${#matched[@]} -eq 2 ]; then platform=all; else platform="${matched[0]}"; fi

rm -rf dist
eas update --channel "$channel" --environment "$channel" --platform "$platform" --message "$message" --non-interactive
# env:exec runs the upload with this environment's EAS variables, so SENTRY_AUTH_TOKEN never sits on this machine.
eas env:exec "$channel" 'npx sentry-expo-upload-sourcemaps dist' --non-interactive
