#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_ID="com.harubom.app"
KEYSTORE_PATH="${NAHARU_KEYSTORE_PATH:-$PROJECT_ROOT/naharu.keystore}"
KEYSTORE_ALIAS="${NAHARU_KEYSTORE_ALIAS:-naharu}"
STORE_PASSWORD="${NAHARU_KEYSTORE_PASSWORD:-}"
KEY_PASSWORD="${NAHARU_KEY_ALIAS_PASSWORD:-}"

info() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v java >/dev/null 2>&1 || fail "JDK 17+ is required."
command -v keytool >/dev/null 2>&1 || fail "keytool is required. Install a JDK and add it to PATH."

if [ -z "$STORE_PASSWORD" ] || [ -z "$KEY_PASSWORD" ]; then
  fail "Set NAHARU_KEYSTORE_PASSWORD and NAHARU_KEY_ALIAS_PASSWORD before building a release."
fi

info "Installing dependencies"
cd "$PROJECT_ROOT"
npm install

info "Preparing Capacitor Android project"
if [ ! -d "$PROJECT_ROOT/android" ]; then
  npx cap add android
fi
npx cap sync android

if [ ! -f "$KEYSTORE_PATH" ]; then
  fail "Keystore not found at '$KEYSTORE_PATH'. Create or restore the release keystore before building."
fi

info "Release signing certificate SHA-256"
SHA256="$(
  keytool -list -v \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEYSTORE_ALIAS" \
    -storepass "$STORE_PASSWORD" 2>/dev/null \
    | sed -n 's/.*SHA256: //p' \
    | head -1
)"

if [ -z "$SHA256" ]; then
  fail "Could not read SHA-256 fingerprint from the keystore."
fi

printf '%s\n' "$SHA256"
ASSETLINKS="$PROJECT_ROOT/public/.well-known/assetlinks.json"
if [ -f "$ASSETLINKS" ] && grep -q 'REPLACE_WITH_YOUR_SHA256_FINGERPRINT' "$ASSETLINKS"; then
  printf '\nUpdate public/.well-known/assetlinks.json with this SHA-256 before TWA/Play release.\n'
fi

info "Building Android App Bundle for $APP_ID"
cd "$PROJECT_ROOT/android"
./gradlew bundleRelease

info "AAB files"
find . -name "*.aab" -type f 2>/dev/null
