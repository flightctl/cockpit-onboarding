#!/bin/bash
# apply-and-enroll.sh - Activate network profile and run enrollment in a
# systemd-run transient unit that survives cockpit-bridge exit.
#
# Used for single-NIC scenarios where activating the new NM profile severs
# the browser connection. Cockpit sets PR_SET_PDEATHSIG(SIGTERM) on direct
# children, so a regular cockpit.spawn() subprocess would die. Running under
# systemd-run isolates this script from that signal.
#
# Usage: apply-and-enroll.sh <params-json-file>
#
# Params JSON format:
# {
#   "connectionId": "flightctl-onboarding-eth0",
#   "enrollmentScripts": [
#     { "scriptPath": "/path/to/script.sh", "paramsFile": "/tmp/.enrollment-xxx.json" }
#   ],
#   "hostname": "mydevice",
#   "connectivityTestHost": "www.google.com"
# }
set -euo pipefail

LOG_FILE="/var/log/cockpit-system-onboarding-apply.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"; }

# Allowed directories for enrollment scripts — must match sudoers entries
ALLOWED_SCRIPT_DIRS=(
    "/usr/share/cockpit/system-onboarding/system-onboarding.d"
    "/etc/cockpit/system-onboarding.d"
)

validate_script_path() {
    local script_path="$1"

    if [ ! -f "$script_path" ]; then
        log "ERROR: Enrollment script does not exist: $script_path"
        return 1
    fi

    local resolved
    resolved=$(realpath "$script_path")

    local allowed=false
    for dir in "${ALLOWED_SCRIPT_DIRS[@]}"; do
        local resolved_dir
        resolved_dir=$(realpath "$dir" 2>/dev/null) || continue
        if [[ "$resolved" == "${resolved_dir}/"* ]]; then
            allowed=true
            break
        fi
    done

    if [ "$allowed" != "true" ]; then
        log "ERROR: Enrollment script is not in an allowed directory: $resolved"
        log "Allowed directories: ${ALLOWED_SCRIPT_DIRS[*]}"
        return 1
    fi

    local owner
    owner=$(stat -c '%u' "$resolved")
    if [ "$owner" != "0" ]; then
        log "ERROR: Enrollment script is not owned by root: $resolved (owner uid=$owner)"
        return 1
    fi

    return 0
}

PARAMS_FILE="$1"
CONNECTION_ID=$(jq -r '.connectionId' "$PARAMS_FILE")
INTERFACE_NAME=$(jq -r '.interfaceName // empty' "$PARAMS_FILE")
EFFECTIVE_IFACE=$(jq -r '.effectiveIfaceName // .interfaceName // empty' "$PARAMS_FILE")
HOSTNAME=$(jq -r '.hostname // empty' "$PARAMS_FILE")
CONNECTIVITY_TEST_HOST=$(jq -r '.connectivityTestHost // "www.google.com"' "$PARAMS_FILE")

rollback() {
    log "Rolling back: deleting onboarding NM profiles..."
    nmcli connection delete "$CONNECTION_ID" 2>/dev/null || true
    if [ "$EFFECTIVE_IFACE" != "$INTERFACE_NAME" ] && [ -n "$INTERFACE_NAME" ]; then
        nmcli connection delete "${CONNECTION_ID/$EFFECTIVE_IFACE/$INTERFACE_NAME}" 2>/dev/null || true
    fi
    systemctl stop cockpit-system-onboarding-watchdog.timer 2>/dev/null || true
    systemctl stop cockpit-system-onboarding-watchdog.service 2>/dev/null || true
    rm -f /var/lib/cockpit-system-onboarding/.watchdog-active 2>/dev/null || true
    log "Rollback complete -- NetworkManager will restore previous connection"
}
trap rollback ERR

# Step 1: Activate the new NM profile
log "Activating connection: $CONNECTION_ID"
nmcli connection up "$CONNECTION_ID"

# Step 2: Wait for link carrier, then connectivity
# In ethernet single-NIC scenarios the operator must physically move the cable
# from the configuration laptop to the production switch. Wait up to 5 minutes
# for carrier, then 30 retries at 2s intervals (~60 seconds) for connectivity.
# Carrier is checked on the physical interface, not the VLAN subinterface.
CARRIER_FILE="/sys/class/net/${INTERFACE_NAME}/carrier"
CARRIER_TIMEOUT=300
CONNECTIVITY_TIMEOUT=30

if [ -n "$INTERFACE_NAME" ] && [ -f "$CARRIER_FILE" ]; then
    log "Waiting for link carrier on $INTERFACE_NAME (up to ${CARRIER_TIMEOUT}s)..."
    elapsed=0
    while [ "$elapsed" -lt "$CARRIER_TIMEOUT" ]; do
        if [ "$(cat "$CARRIER_FILE" 2>/dev/null)" = "1" ]; then
            log "Link carrier detected on $INTERFACE_NAME after ${elapsed}s"
            break
        fi
        if [ "$elapsed" -eq "$CARRIER_TIMEOUT" ]; then
            break
        fi
        sleep 5
        elapsed=$((elapsed + 5))
    done
    if [ "$(cat "$CARRIER_FILE" 2>/dev/null)" != "1" ]; then
        log "ERROR: No link carrier on $INTERFACE_NAME after ${CARRIER_TIMEOUT}s"
        exit 1
    fi
else
    log "No carrier file for $INTERFACE_NAME, skipping carrier wait"
fi

log "Waiting for network connectivity (up to ${CONNECTIVITY_TIMEOUT} retries)..."
for i in $(seq 1 $CONNECTIVITY_TIMEOUT); do
    if getent hosts "${CONNECTIVITY_TEST_HOST}" >/dev/null 2>&1; then
        log "Network connectivity confirmed"
        break
    fi
    if [ "$i" -eq "$CONNECTIVITY_TIMEOUT" ]; then
        log "ERROR: Network connectivity not available after $CONNECTIVITY_TIMEOUT attempts"
        exit 1
    fi
    sleep 2
done

# Step 3: Run enrollment scripts
SCRIPT_COUNT=$(jq '.enrollmentScripts | length' "$PARAMS_FILE")
if [ "$SCRIPT_COUNT" -gt 0 ]; then
    while IFS= read -r script_entry; do
        SCRIPT_PATH=$(echo "$script_entry" | jq -r '.scriptPath')
        SCRIPT_PARAMS=$(echo "$script_entry" | jq -r '.paramsFile')
        if ! validate_script_path "$SCRIPT_PATH"; then
            rm -f "$SCRIPT_PARAMS"
            exit 1
        fi
        log "Running enrollment script: $SCRIPT_PATH"
        if ! "$SCRIPT_PATH" "$SCRIPT_PARAMS"; then
            log "ERROR: Enrollment script failed: $SCRIPT_PATH"
            rm -f "$SCRIPT_PARAMS"
            exit 1
        fi
        rm -f "$SCRIPT_PARAMS"
        log "Enrollment script completed: $SCRIPT_PATH"
    done < <(jq -c '.enrollmentScripts[]' "$PARAMS_FILE")
else
    log "No enrollment scripts to run"
fi

# Step 4: Write the onboarding completion marker
FINALIZE_SCRIPT="/usr/libexec/cockpit-system-onboarding/finalize-onboarding.sh"
if [ -x "$FINALIZE_SCRIPT" ]; then
    log "Running finalize..."
    "$FINALIZE_SCRIPT" "$HOSTNAME"
    log "Finalize completed"
else
    log "WARNING: Finalize script not found at $FINALIZE_SCRIPT"
fi

# Step 5: Run cleanup (removes onboarding user, stops WiFi AP, starts agent)
CLEANUP_SCRIPT="/usr/libexec/cockpit-system-onboarding/cleanup-onboarding.sh"
if [ -x "$CLEANUP_SCRIPT" ]; then
    log "Running cleanup..."
    "$CLEANUP_SCRIPT"
    log "Cleanup completed"
else
    log "WARNING: Cleanup script not found at $CLEANUP_SCRIPT"
fi

log "Onboarding completed successfully"

# Clean up params file
rm -f "$PARAMS_FILE"
