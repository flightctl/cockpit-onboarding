#!/bin/bash
#
# Mask greenboot-healthcheck.service so onboarding is not rolled back.
# Installed to: /usr/libexec/cockpit-system-onboarding/mask-greenboot.sh
#
# During onboarding the flightctl-agent is gated (not running), which causes
# greenboot health checks to fail and eventually triggers an OS rollback.
# This script masks the health check service early in boot so the device
# survives the onboarding window.  The mask is removed only on successful
# onboarding completion (cleanup-onboarding.sh) or RPM uninstall.
#
set -euo pipefail

LOGFILE="/var/log/cockpit-system-onboarding-mask-greenboot.log"
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "${LOGFILE}"
}

log "=== mask-greenboot.sh starting ==="

readonly SERVICE_NAME="greenboot-healthcheck.service"
readonly UNIT_FILE="/usr/lib/systemd/system/${SERVICE_NAME}"
readonly MASK_LINK="/etc/systemd/system/${SERVICE_NAME}"

greenboot_present() {
    log "Checking if greenboot health check is present..."

    if [ -f "${UNIT_FILE}" ]; then
        log "  Found via unit file: ${UNIT_FILE}"
        return 0
    fi
    log "  Unit file not found at ${UNIT_FILE}"

    if find /usr/lib/systemd -name "${SERVICE_NAME}" -quit 2>/dev/null | grep -q .; then
        log "  Found via find in /usr/lib/systemd"
        return 0
    fi
    log "  Not found via find in /usr/lib/systemd"

    if systemctl list-unit-files "${SERVICE_NAME}" 2>/dev/null | grep -q "^${SERVICE_NAME}"; then
        log "  Found via systemctl list-unit-files"
        return 0
    fi
    log "  Not found via systemctl list-unit-files"

    log "Greenboot health check not detected by any method"
    return 1
}

mask_already_applied() {
    if [ -L "${MASK_LINK}" ] && [ "$(readlink "${MASK_LINK}")" = "/dev/null" ]; then
        log "Mask already applied: ${MASK_LINK} -> /dev/null"
        return 0
    fi
    log "Mask not yet applied (link does not exist or points elsewhere)"
    return 1
}

if ! greenboot_present; then
    log "Greenboot health check not present, exiting"
    exit 0
fi

if mask_already_applied; then
    log "Mask already applied, exiting"
    exit 0
fi

log "Applying mask..."
mkdir -p /etc/systemd/system
ln -sf /dev/null "${MASK_LINK}"
log "Created symlink: ${MASK_LINK} -> /dev/null"

systemctl daemon-reload 2>/dev/null || true
log "Ran systemctl daemon-reload"

systemctl mask --now "${SERVICE_NAME}" 2>/dev/null || true
log "Ran systemctl mask --now ${SERVICE_NAME}"

log "=== mask-greenboot.sh completed successfully ==="
