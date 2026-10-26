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

eas() { npx --yes eas-cli@latest "$@"; }

# An update only reaches builds with the same native fingerprint. Refuse instead of publishing one no phone will run.
local_runtime=$(APP_VARIANT="$channel" npx expo-updates runtimeversion:resolve --platform ios 2>/dev/null |
  node -pe 'JSON.parse(require("fs").readFileSync(0)).runtimeVersion')
build_runtime=$(eas build:list --channel "$channel" --platform ios --status finished --limit 1 --json --non-interactive 2>/dev/null |
  node -pe 'JSON.parse(require("fs").readFileSync(0))[0]?.runtime?.version ?? ""')
if [ "$local_runtime" != "$build_runtime" ]; then
  echo "Native code has changed since the latest $channel build (runtime ${build_runtime:-none} → $local_runtime)."
  echo "No installed $channel app would run this update. Make a new build instead:"
  echo "  npx eas-cli@latest build --profile $channel --platform ios"
  exit 1
fi

rm -rf dist
eas update --channel "$channel" --environment "$channel" --platform ios --message "$message" --non-interactive
# env:exec runs the upload with this environment's EAS variables, so SENTRY_AUTH_TOKEN never sits on this machine.
eas env:exec "$channel" 'npx sentry-expo-upload-sourcemaps dist' --non-interactive
