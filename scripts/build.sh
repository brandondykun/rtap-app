#!/usr/bin/env bash
# Starts an EAS cloud build, asking for the profile, platform, an optional message and, for production, whether to
# submit it to the store when it finishes. Warns first when the latest build already has the same native code.
#   scripts/build.sh
set -euo pipefail

cd "$(dirname "$0")/.."

eas() { npx --yes eas-cli@latest "$@"; }

# Prints the options numbered, then echoes the one picked with a single key press.
choose() {
  local prompt="$1"
  shift
  local i=1 option key
  echo "$prompt" >&2
  for option in "$@"; do
    echo "  $i) $option" >&2
    i=$((i + 1))
  done
  while true; do
    # set -e doesn't reach inside $(…), so stop here on Ctrl-D instead of asking forever.
    read -r -n 1 -p "> " key || exit 1
    echo >&2
    if [[ "$key" =~ ^[1-9]$ ]] && [ "$key" -le $# ]; then
      echo "${!key}"
      return
    fi
    echo "Press a number from 1 to $#." >&2
  done
}

# Asks a y/N question with a single key press; succeeds only on y.
confirm() {
  local key
  read -r -n 1 -p "$1 [y/N] " key || key=''
  echo
  [[ "$key" == [yY] ]]
}

if [ -n "$(git status --porcelain)" ]; then
  echo 'Commit or stash your changes first, so the build matches a commit.'
  exit 1
fi

profile=$(choose 'Profile:' 'development  RTAP (D)' 'preview      RTAP (P)' 'production   RTAP, for the App Store') || exit 1
profile="${profile%% *}"
platform=$(choose 'Platform:' ios android all) || exit 1

# The runtime version is a fingerprint of the native code. If the latest build of this profile already has the same
# one, a new build would install the same native app: ship JS changes with scripts/ota-update.sh instead.
if [ "$platform" = all ]; then platforms=(ios android); else platforms=("$platform"); fi
echo
echo 'Comparing native code with the latest builds...'
unchanged=()
for p in "${platforms[@]}"; do
  local_runtime=$(APP_VARIANT="$profile" npx expo-updates runtimeversion:resolve --platform "$p" 2>/dev/null |
    node -pe 'JSON.parse(require("fs").readFileSync(0)).runtimeVersion' 2>/dev/null) ||
    { echo "Couldn't work out the $p fingerprint. Try: APP_VARIANT=$profile npx expo-updates runtimeversion:resolve --platform $p"; exit 1; }
  build_runtime=$(eas build:list --build-profile "$profile" --platform "$p" --status finished --limit 1 --json --non-interactive 2>/dev/null |
    node -pe 'JSON.parse(require("fs").readFileSync(0))[0]?.runtime?.version ?? ""' 2>/dev/null) ||
    { echo "Couldn't list the $profile builds on EAS. Are you logged in? (npx eas-cli@latest whoami)"; exit 1; }
  if [ "$local_runtime" = "$build_runtime" ]; then
    echo "  $p: same native code as the latest $profile build (runtime $local_runtime)"
    unchanged+=("$p")
  else
    echo "  $p: changed (runtime ${build_runtime:-none} → $local_runtime)"
  fi
done
if [ ${#unchanged[@]} -gt 0 ]; then
  echo 'A new build of an unchanged platform uses up a build for nothing; JS changes ship with scripts/ota-update.sh.'
  if ! confirm 'Build anyway?'; then
    echo 'Cancelled.'
    exit 0
  fi
fi
echo

read -r -p 'Message (optional, Enter to skip): ' message

args=(build --profile "$profile" --platform "$platform")
if [ -n "$message" ]; then
  args+=(--message "$message")
fi
if [ "$profile" = production ] && confirm 'Submit to the store when the build finishes?'; then
  args+=(--auto-submit)
fi

echo
printf 'npx eas-cli@latest'
for arg in "${args[@]}"; do
  if [[ "$arg" == *' '* ]]; then printf ' "%s"' "$arg"; else printf ' %s' "$arg"; fi
done
echo
if ! confirm 'Start this build?'; then
  echo 'Cancelled.'
  exit 0
fi

eas "${args[@]}"
