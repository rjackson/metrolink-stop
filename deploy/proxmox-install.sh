#!/usr/bin/env bash
#
# Create (or update) an LXC container on a Proxmox host serving the metrolink
# stops static site with Caddy.
#
# Run this ON THE PROXMOX HOST, as root:
#
#   bash proxmox-install.sh
#
# It is safe to re-run: pointed at an existing container it pulls the latest
# code, rebuilds and releases, leaving the config alone.
#
# Deliberately self-contained -- it sources nothing over the network, so the
# only remote code that ever runs is this (public) repo, the npm packages in
# its lockfile, and the distro's packages.

set -Eeuo pipefail

# ---------------------------------------------------------------- settings ---

REPO_URL="${REPO_URL:-https://github.com/rjackson/metrolink-stop.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

APP="metrolink-stop"
# These must agree with deploy/release.sh and deploy/Caddyfile.
APP_DIR="/opt/${APP}"
SITE_DIR="/srv/${APP}"
ENV_FILE="/etc/${APP}.env"
NODE_MIN_MAJOR="20"

# Container defaults. Override any of these from the environment, e.g.
#   CTID=142 CT_RAM=2048 bash proxmox-install.sh
CT_HOSTNAME="${CT_HOSTNAME:-metrolink-stop}"
CT_CPU="${CT_CPU:-2}"
CT_RAM="${CT_RAM:-1024}"         # MB. Builds need it; serving needs very little
CT_DISK="${CT_DISK:-4}"          # GB
CT_BRIDGE="${CT_BRIDGE:-vmbr0}"
CT_STORAGE="${CT_STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
DEBIAN_RELEASE="${DEBIAN_RELEASE:-13}"

# ----------------------------------------------------------------- output ----

RD=$'\033[0;31m'; GN=$'\033[0;32m'; YW=$'\033[0;33m'; BL=$'\033[0;34m'; CL=$'\033[0m'
msg_info()  { echo -e " ${BL}→${CL} $1"; }
msg_ok()    { echo -e " ${GN}✓${CL} $1"; }
msg_warn()  { echo -e " ${YW}!${CL} $1"; }
msg_error() { echo -e " ${RD}✗${CL} $1" >&2; }

trap 'msg_error "Failed at line $LINENO. The container was left as-is for inspection."' ERR

# Run a command inside the container.
#
# The inner shell gets -euo pipefail so a failing line in a multi-line block
# aborts and propagates, rather than continuing and returning 0 -- which would
# let the caller's `if`/msg_ok report success after something had already
# failed.
#
# The locale is pinned to C.UTF-8, which glibc always provides: pct exec passes
# the host's LANG through (often en_US.UTF-8), which the minimal template does
# not have generated, and perl/apt then print a wall of locale warnings.
ct_exec() { pct exec "$CTID" -- env LANG=C.UTF-8 LC_ALL=C.UTF-8 bash -euo pipefail -c "$1"; }

# --------------------------------------------------------------- preflight ---

if [[ "${EUID}" -ne 0 ]]; then
  msg_error "Run this on the Proxmox host as root."
  exit 1
fi

if ! command -v pct >/dev/null 2>&1; then
  msg_error "'pct' not found — this must run on the Proxmox host, not inside a container."
  exit 1
fi

# -------------------------------------------------------- pick a container ---

# Reuse an existing container if one already has our hostname, so that
# re-running this script updates rather than duplicating.
# Match the LAST field rather than $3: `pct list` has an optional Lock column
# that shifts the Name across when a container is locked.
EXISTING_CTID="$(pct list | awk -v h="$CT_HOSTNAME" 'NR > 1 && $NF == h {print $1}' | head -n1)"

if [[ -n "${CTID:-}" ]]; then
  : # explicit override wins
elif [[ -n "$EXISTING_CTID" ]]; then
  CTID="$EXISTING_CTID"
else
  CTID="$(pvesh get /cluster/nextid)"
fi

if pct status "$CTID" >/dev/null 2>&1; then
  MODE="update"
  msg_info "Found existing container ${CTID} (${CT_HOSTNAME}) — updating it."
else
  MODE="create"
  msg_info "Creating new container ${CTID} (${CT_HOSTNAME})."
fi

# ---------------------------------------------------------- create the LXC ---

if [[ "$MODE" == "create" ]]; then
  TEMPLATE="debian-${DEBIAN_RELEASE}-standard"
  msg_info "Locating a ${TEMPLATE} template..."

  TEMPLATE_FILE="$(pveam list "$TEMPLATE_STORAGE" 2>/dev/null \
    | awk -v t="$TEMPLATE" '$1 ~ t {print $1}' | sort -V | tail -n1)"

  if [[ -z "$TEMPLATE_FILE" ]]; then
    msg_info "Not downloaded yet — fetching it."
    pveam update >/dev/null
    AVAILABLE="$(pveam available --section system \
      | awk -v t="$TEMPLATE" '$2 ~ t {print $2}' | sort -V | tail -n1)"
    if [[ -z "$AVAILABLE" ]]; then
      msg_error "No ${TEMPLATE} template available. Check 'pveam available --section system'."
      exit 1
    fi
    pveam download "$TEMPLATE_STORAGE" "$AVAILABLE" >/dev/null
    TEMPLATE_FILE="${TEMPLATE_STORAGE}:vztmpl/${AVAILABLE}"
  fi
  msg_ok "Template: ${TEMPLATE_FILE}"

  msg_info "Creating container..."
  # Unprivileged, with nesting enabled.
  #
  # nesting=1 is required despite this container running nothing nested: it is
  # what lets an unprivileged LXC perform its own mounts. Without it,
  # systemd-journald dies at startup with status=243/CREDENTIALS while trying
  # to mount the ramfs backing LoadCredential=, and journalctl stays silently
  # empty forever. It is also the setting Proxmox expects for systemd guests.
  #
  # --cmode shell makes the Proxmox "Console" button open a root shell directly,
  # rather than a getty login prompt for a root account with no password.
  pct create "$CTID" "$TEMPLATE_FILE" \
    --hostname "$CT_HOSTNAME" \
    --cmode shell \
    --cores "$CT_CPU" \
    --memory "$CT_RAM" \
    --rootfs "${CT_STORAGE}:${CT_DISK}" \
    --net0 "name=eth0,bridge=${CT_BRIDGE},ip=dhcp,ip6=auto" \
    --features "nesting=1" \
    --unprivileged 1 \
    --onboot 1 \
    --tags "metrolink;web" \
    --description "Metrolink stops — static site (live tram departures), served by Caddy" \
    >/dev/null
  msg_ok "Container ${CTID} created."

  pct start "$CTID" >/dev/null
  msg_info "Waiting for the network..."
  for _ in $(seq 1 30); do
    if ct_exec "getent hosts github.com >/dev/null 2>&1"; then break; fi
    sleep 2
  done
  if ! ct_exec "getent hosts github.com >/dev/null 2>&1"; then
    msg_error "Container has no working DNS/network. Check the bridge (${CT_BRIDGE}) and DHCP."
    exit 1
  fi
  msg_ok "Network up."
else
  # Repair a container created without nesting=1 (see above). The change only
  # takes effect after a restart.
  if ! pct config "$CTID" | grep -qE '^features:.*nesting=1'; then
    msg_info "Enabling nesting (needed for journald) and restarting..."
    # --features replaces the whole string, so merge rather than clobber any
    # existing flags (keyctl, fuse, ...).
    EXISTING_FEATURES="$(pct config "$CTID" | sed -n 's/^features: //p')"
    OTHER_FEATURES="$(printf '%s' "$EXISTING_FEATURES" \
      | tr ',' '\n' | grep -v '^nesting=' | grep -v '^$' | paste -sd, -)"
    if [[ -n "$OTHER_FEATURES" ]]; then
      NEW_FEATURES="${OTHER_FEATURES},nesting=1"
    else
      NEW_FEATURES="nesting=1"
    fi
    pct set "$CTID" --features "$NEW_FEATURES" >/dev/null
    pct stop "$CTID" >/dev/null 2>&1 || true
    pct start "$CTID" >/dev/null
    for _ in $(seq 1 30); do
      if pct exec "$CTID" -- true 2>/dev/null; then break; fi
      sleep 2
    done
    msg_ok "Nesting enabled."
  fi

  if ! pct config "$CTID" | grep -qE '^cmode: shell$'; then
    pct set "$CTID" --cmode shell >/dev/null
    msg_ok "Console set to open a root shell directly."
  fi

  [[ "$(pct status "$CTID")" == "status: running" ]] || pct start "$CTID" >/dev/null
fi

# ----------------------------------------------------------- base packages ---

msg_info "Installing base packages (this takes a minute or two on first run)..."
# Node, npm and Caddy all come from Debian's own repositories: Debian 13 ships
# Node 20, which is all the build needs, so no third-party apt source is added.
ct_exec "export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl git nodejs npm caddy >/dev/null"

NODE_VERSION="$(ct_exec 'node -v')"
if [[ "$(printf '%s' "$NODE_VERSION" | sed -n 's/^v\([0-9]*\).*/\1/p')" -lt "$NODE_MIN_MAJOR" ]]; then
  msg_error "Node ${NODE_VERSION} is too old; the build needs ${NODE_MIN_MAJOR}+. Use DEBIAN_RELEASE=13 or newer."
  exit 1
fi
msg_ok "Base packages installed (Node ${NODE_VERSION}, $(ct_exec 'caddy version | cut -d" " -f1'))."

# ----------------------------------------------------- persistent journald ---

# The common failure in an unprivileged LXC is journald exiting with
# status=243/CREDENTIALS, handled by nesting=1 above. What remains here covers
# masked units, a tripped start limit, and memory-only storage (Storage=auto
# only persists once /var/log/journal exists). Errors are captured rather than
# discarded: when this fails they are the only clue.
msg_info "Enabling persistent logging..."
JOURNAL_ERR="$(ct_exec "
  systemctl unmask systemd-journald.service systemd-journald.socket
  systemctl reset-failed systemd-journald.service
  install -d -g systemd-journal -m 2755 /var/log/journal
  systemctl start systemd-journald.socket
  systemctl restart systemd-journald.service
  journalctl --flush
" 2>&1)" || true

if ct_exec "systemctl is-active --quiet systemd-journald"; then
  msg_ok "journald active; logs persist in /var/log/journal."
else
  msg_warn "journald would not start, so journalctl will stay empty. The site still works."
  if [[ -n "$JOURNAL_ERR" ]]; then
    printf '%s\n' "$JOURNAL_ERR" | sed 's/^/      /' >&2
  fi
  if ct_exec "systemctl show systemd-journald -p ExecMainStatus --value" | grep -q '^243$'; then
    msg_warn "Exit 243 = CREDENTIALS: the container still lacks nesting. Run:"
    msg_warn "  pct set ${CTID} --features nesting=1 && pct reboot ${CTID}"
  fi
fi

# -------------------------------------------------------------------- code ---

# The repo is public, so it's cloned over HTTPS.
if ct_exec "test -d ${APP_DIR}/.git"; then
  msg_info "Pulling the latest code..."
  # Separate statements, not an '&&' chain: a failing 'a && b' compound does
  # not trip 'set -e', so a chain would carry on after a git error and rebuild
  # stale code while reporting success.
  #
  # reset --hard rather than pull, so a divergent tree can never block an
  # update. The remote is re-pointed in case REPO_URL/REPO_BRANCH changed.
  ct_exec "cd ${APP_DIR}
    git remote set-url origin ${REPO_URL}
    git fetch --quiet origin ${REPO_BRANCH}
    git checkout --quiet --force -B ${REPO_BRANCH} FETCH_HEAD"
else
  msg_info "Cloning the repository..."
  ct_exec "rm -rf ${APP_DIR}
    git clone --quiet --branch ${REPO_BRANCH} ${REPO_URL} ${APP_DIR}"
fi
# Assigned first, not inlined into msg_ok: a command substitution used as a
# function argument does not trip `set -e`.
HEAD_SHA="$(ct_exec "cd ${APP_DIR}; git rev-parse --short HEAD")"
msg_ok "Code at ${HEAD_SHA} (${REPO_BRANCH})."

# ------------------------------------------------------------------ config ---

if ! ct_exec "test -f ${ENV_FILE}"; then
  echo
  echo -e "${YW}────────────────────────────────────────────────────────────────${CL}"
  echo -e "${YW} Build settings (all optional — press Enter to skip)${CL}"
  echo -e "${YW}────────────────────────────────────────────────────────────────${CL}"
  echo
  echo "  These are baked into the public JavaScript bundle, so none are secret."
  echo "  Change them later in ${ENV_FILE}, then run 'update'."
  echo
  read -rp "  Esri API key (basemap for the travel time map): " VITE_ESRI_API_KEY
  read -rp "  Fathom tracking code: " VITE_FATHOM_TRACKING_CODE
  read -rp "  Fathom custom domain: " VITE_FATHOM_CUSTOM_DOMAIN
  echo

  # Permissions are set on an empty file BEFORE the content is written, and the
  # content goes over stdin rather than the command line.
  pct exec "$CTID" -- bash -euo pipefail -c "
    install -m 640 -o root -g root /dev/null ${ENV_FILE}
    cat > ${ENV_FILE}" <<EOF
# Written by deploy/proxmox-install.sh. See README.md for all options.
#
# Read at build time by deploy/release.sh, and baked into the bundle: run
# 'update' after changing anything here.

# Esri basemap for the travel time map. Without it the map has no basemap.
VITE_ESRI_API_KEY=${VITE_ESRI_API_KEY}

# Fathom analytics. Leave the tracking code empty to disable.
VITE_FATHOM_TRACKING_CODE=${VITE_FATHOM_TRACKING_CODE}
VITE_FATHOM_CUSTOM_DOMAIN=${VITE_FATHOM_CUSTOM_DOMAIN}

# Send TfGM API requests through a proxy instead of directly to
# https://apiary.tfgm.com/ (e.g. if TfGM stop allowing cross-origin requests).
# VITE_TFGM_GRAPHQL_ENDPOINT=
EOF
  msg_ok "Wrote ${ENV_FILE}."
else
  msg_ok "Keeping the existing ${ENV_FILE}."
fi

# ------------------------------------------------------------ update helper ---

# The real script lives in /usr/sbin because `pct exec` runs without a login
# shell and its minimal PATH excludes /usr/local/bin. `update` is a short
# alias for it, symlinked into /usr/bin for the same reason.
#
# It only pulls, then hands over to deploy/release.sh from the freshly pulled
# code, so the deploy steps themselves update along with everything else.
UPDATE_BIN="/usr/sbin/${APP}-update"

ct_exec "cat > ${UPDATE_BIN} <<'EOF'
#!/usr/bin/env bash
#
# Pull the latest code, then build and release it. Written by
# deploy/proxmox-install.sh; re-run that to change the repo or branch.
set -Eeuo pipefail

cd ${APP_DIR}
git fetch --quiet origin ${REPO_BRANCH}
git checkout --quiet --force -B ${REPO_BRANCH} FETCH_HEAD

exec bash ${APP_DIR}/deploy/release.sh
EOF
chmod 755 ${UPDATE_BIN}
ln -sf ${UPDATE_BIN} /usr/bin/update"
msg_ok "Update helper installed ('update' inside the container)."

# --------------------------------------------------------- build & release ---

msg_info "Building and releasing (a couple of minutes on first run)..."
# Output is captured rather than silenced: on success it is noise, but on
# failure it is the only explanation.
RELEASE_STATUS=0
trap - ERR
RELEASE_OUTPUT="$(ct_exec "bash ${APP_DIR}/deploy/release.sh" 2>&1)" || RELEASE_STATUS=$?
trap 'msg_error "Failed at line $LINENO. The container was left as-is for inspection."' ERR
if [[ "$RELEASE_STATUS" -ne 0 ]]; then
  printf '%s\n' "$RELEASE_OUTPUT" | tail -n 40 | sed 's/^/      /' >&2
  msg_error "Build/release failed (exit ${RELEASE_STATUS}); output above. The previous release, if any, is still live."
  exit 1
fi
msg_ok "$(printf '%s\n' "$RELEASE_OUTPUT" | tail -n1)"

ct_exec "systemctl enable -q --now caddy"

# -------------------------------------------------------------- smoke test ---

msg_info "Smoke testing..."

# Reported, not fatal: a failure here leaves a container worth inspecting.
trap - ERR
SMOKE_FAILED=0

check() {
  local description="$1" command="$2"
  if ct_exec "$command" >/dev/null 2>&1; then
    msg_ok "$description"
  else
    msg_error "$description — FAILED"
    SMOKE_FAILED=1
  fi
}

check "Home page served" \
  "curl -fsS --max-time 10 http://127.0.0.1/ | grep -q 'id=\"root\"'"
check "Stop pages fall back to the app (single page app routing)" \
  "curl -fsS --max-time 10 http://127.0.0.1/cornbrook | grep -q 'id=\"root\"'"
check "Pages are revalidated (Cache-Control: no-cache)" \
  "curl -fsS -o /dev/null -D - --max-time 10 http://127.0.0.1/cornbrook | grep -qi '^cache-control: no-cache'"
check "Service worker served and revalidated" \
  "curl -fsS -o /dev/null -D - --max-time 10 http://127.0.0.1/sw.js | grep -qi '^cache-control: no-cache'"
check "Hashed assets cached long-term" \
  "asset=\$(ls ${SITE_DIR}/current/www/assets | head -n1)
   curl -fsS -o /dev/null -D - --max-time 10 \"http://127.0.0.1/assets/\${asset}\" | grep -qi 'immutable'"
check "Missing assets 404 (not the app)" \
  "test \"\$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/assets/does-not-exist.js)\" = 404"

trap 'msg_error "Failed at line $LINENO. The container was left as-is for inspection."' ERR

# ----------------------------------------------------------------- summary ---

CT_IP="$(ct_exec "hostname -I | awk '{print \$1}'" | tr -d '\r')"

echo
if [[ "$SMOKE_FAILED" -eq 1 ]]; then
  msg_warn "${APP} is deployed, but some checks failed — see above."
else
  msg_ok "${APP} is deployed."
fi

cat <<EOF

  Container   ${CTID} (${CT_HOSTNAME}) at ${CT_IP}
  Web         http://${CT_IP}/
  Code        ${APP_DIR} @ ${HEAD_SHA} (${REPO_BRANCH})
  Releases    ${SITE_DIR}/releases (live: ${SITE_DIR}/current)
  Config      ${ENV_FILE}

  Shell in         Proxmox "Console" button, or pct enter ${CTID}
  Update           pct exec ${CTID} -- update
  Caddy logs       pct exec ${CTID} -- journalctl -u caddy -f

  Re-running this script updates an existing container in place.

  Point the Cloudflare tunnel's public hostname at http://${CT_IP}:80
  (the tunnel is managed separately). See README.md for Cloudflare settings.

EOF
