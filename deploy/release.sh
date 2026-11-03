#!/usr/bin/env bash
#
# Build the checked-out code into a new release and switch the site over to it.
#
# Runs INSIDE the container, as root, from the checkout: by
# deploy/proxmox-install.sh on install, and by `update` afterwards (which pulls
# first). It lives in the repo, rather than being written out by the install
# script, so changes to the deploy steps arrive with the code they deploy.
#
# Releases are immutable directories under ${SITE_DIR}/releases, and
# ${SITE_DIR}/current is a symlink to the live one, swapped atomically. So a
# visitor never sees a half-written site, and rolling back is one `ln`.

set -Eeuo pipefail

APP_DIR="/opt/metrolink-stop"
SITE_DIR="/srv/metrolink-stop"
ENV_FILE="/etc/metrolink-stop.env"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

RELEASES_DIR="${SITE_DIR}/releases"
CURRENT="${SITE_DIR}/current"

cd "$APP_DIR"
SHA="$(git rev-parse --short HEAD)"

# ------------------------------------------------------------------ caddy ----

# Validated before it replaces the live config, so a bad Caddyfile can never
# take down a working site.
install -m 644 deploy/Caddyfile /etc/caddy/Caddyfile.new
if ! caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile >/dev/null 2>&1; then
  caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile || true
  rm -f /etc/caddy/Caddyfile.new
  echo "deploy/Caddyfile is invalid (above); leaving the live config alone." >&2
  exit 1
fi
mv /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile

# ------------------------------------------------------------------ build ----

npm ci --no-audit --no-fund --loglevel=error

# VITE_* settings are baked into the bundle at build time, so they're read here
# rather than by anything at runtime.
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

npm run build

# ---------------------------------------------------------------- release ----

mkdir -p "$RELEASES_DIR"
rm -rf "${RELEASES_DIR}"/*.partial

RELEASE="${RELEASES_DIR}/$(date -u +%Y%m%dT%H%M%SZ)-${SHA}"
STAGING="${RELEASE}.partial"

mkdir -p "$STAGING"
cp -a dist "${STAGING}/www"

# Record this build's own assets (outside the web root), before any are
# carried over below.
ls -1 "${STAGING}/www/assets" > "${STAGING}/assets.txt"

# Keep the previous release's assets available too. A visitor whose page loaded
# just before this release still has the old index.html, which lazy-loads old
# chunk names (the travel time map, isochrones); without these, those requests
# would 404 until they reload. Only the previous release's own assets are
# carried, so they don't accumulate across releases.
if [[ -L "$CURRENT" ]]; then
  PREVIOUS="$(readlink -f "$CURRENT")"
  if [[ -f "${PREVIOUS}/assets.txt" ]]; then
    while IFS= read -r asset; do
      if [[ ! -e "${STAGING}/www/assets/${asset}" && -e "${PREVIOUS}/www/assets/${asset}" ]]; then
        cp -a "${PREVIOUS}/www/assets/${asset}" "${STAGING}/www/assets/"
      fi
    done < "${PREVIOUS}/assets.txt"
  fi
fi

mv "$STAGING" "$RELEASE"

# Atomic switch: rename(2) over the old symlink, so there is no moment where
# `current` is missing.
ln -sfn "$RELEASE" "${SITE_DIR}/current.next"
mv -T "${SITE_DIR}/current.next" "$CURRENT"

# Caddy resolves the symlink per request, so a reload is only needed for a
# changed Caddyfile -- but it's cheap and keeps this to one code path.
systemctl reload-or-restart caddy

# ------------------------------------------------------------------ prune ----

# Release names start with a UTC timestamp, so they sort chronologically.
mapfile -t OLD_RELEASES < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '*.partial' | sort -r \
  | tail -n +$((KEEP_RELEASES + 1)))
for old in "${OLD_RELEASES[@]}"; do
  if [[ "$(readlink -f "$old")" != "$(readlink -f "$CURRENT")" ]]; then
    rm -rf "$old"
  fi
done

echo "Released ${SHA}: ${RELEASE}"
