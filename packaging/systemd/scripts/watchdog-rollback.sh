#!/bin/bash
# Connectivity watchdog rollback script
# Runs after a timeout to check whether onboarding completed successfully.
# If the device is stuck with a bad network config, rolls back and re-enters setup mode.

set -euo pipefail

# shellcheck source=common.sh
. /usr/libexec/cockpit-system-onboarding/common.sh

MARKER_FILE="${ONBOARDING_MARKER_DIR}/.onboarding-complete"
WATCHDOG_STATE_FILE="${ONBOARDING_MARKER_DIR}/.watchdog-active"
STATUS_FILE="${ONBOARDING_MARKER_DIR}/.watchdog-status"
SERVICE_NAME="cockpit-system-onboarding-setup.service"

DIAG_CARRIER_DETECTED="false"
DIAG_CARRIER_INTERFACES=""
DIAG_DNS_RESOLVED="false"
DIAG_PING_SUCCEEDED="false"
DIAG_TESTED_HOST=""
DIAG_ACTIVE_CONNECTIONS=""

log() {
    echo "watchdog: $*"
}

collect_diagnostics() {
    local test_host="$1"
    DIAG_TESTED_HOST="$test_host"

    local carrier_ifaces=""
    for iface in /sys/class/net/*/carrier; do
        if [ -f "$iface" ] && [ "$(cat "$iface" 2>/dev/null)" = "1" ]; then
            local ifname
            ifname=$(echo "$iface" | cut -d/ -f5)
            if [ "$ifname" != "lo" ]; then
                DIAG_CARRIER_DETECTED="true"
                carrier_ifaces="${carrier_ifaces:+${carrier_ifaces}, }${ifname}"
            fi
        fi
    done
    DIAG_CARRIER_INTERFACES="$carrier_ifaces"

    if getent hosts "$test_host" >/dev/null 2>&1; then
        DIAG_DNS_RESOLVED="true"
    fi

    if timeout 10 ping -c 1 -W 5 "$test_host" >/dev/null 2>&1; then
        DIAG_PING_SUCCEEDED="true"
    fi

    DIAG_ACTIVE_CONNECTIONS=$(nmcli -t -f NAME connection show --active 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
}

is_network_ok() {
    [ "$DIAG_CARRIER_DETECTED" = "true" ] && [ "$DIAG_DNS_RESOLVED" = "true" ]
}

write_status() {
    local status="$1"
    local message="$2"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    jq -n \
        --arg status "$status" \
        --arg message "$message" \
        --arg timestamp "$timestamp" \
        --argjson carrierDetected "$DIAG_CARRIER_DETECTED" \
        --arg carrierInterfaces "$DIAG_CARRIER_INTERFACES" \
        --argjson dnsResolved "$DIAG_DNS_RESOLVED" \
        --argjson pingSucceeded "$DIAG_PING_SUCCEEDED" \
        --arg testedHost "$DIAG_TESTED_HOST" \
        --arg activeConnections "$DIAG_ACTIVE_CONNECTIONS" \
        '{
            status: $status,
            message: $message,
            timestamp: $timestamp,
            details: {
                carrierDetected: $carrierDetected,
                carrierInterfaces: $carrierInterfaces,
                dnsResolved: $dnsResolved,
                pingSucceeded: $pingSucceeded,
                testedHost: $testedHost,
                activeConnections: $activeConnections
            }
        }' > "$STATUS_FILE"

    chown onboarding:onboarding "$STATUS_FILE"
    chmod 0600 "$STATUS_FILE"
}

rollback_network() {
    log "Rolling back network configuration"

    local rollback_performed=false

    # Check if the original setup used WiFi AP mode
    local wifi_ap_unit
    wifi_ap_unit=$(systemctl list-units --plain --no-legend 'cockpit-system-onboarding-wifi-ap@*.service' 2>/dev/null | awk '{print $1}' | head -n 1)
    if [ -n "$wifi_ap_unit" ]; then
        log "WiFi AP service found ($wifi_ap_unit), re-enabling"
        systemctl enable "$wifi_ap_unit" 2>/dev/null || true
        systemctl start "$wifi_ap_unit" 2>/dev/null || true
        rollback_performed=true
    else
        # Check for setup service — it may have already been stopped
        local setup_iface
        setup_iface=$(systemctl list-units --plain --no-legend 'cockpit-system-onboarding-wifi-ap@*.service' --all 2>/dev/null | awk '{print $1}' | head -n 1 | sed 's/.*@//;s/\.service//')
        if [ -n "$setup_iface" ]; then
            log "Found inactive WiFi AP for $setup_iface, restarting setup"
            systemctl start "cockpit-system-onboarding-wifi-ap@${setup_iface}.service" 2>/dev/null || true
            rollback_performed=true
        fi
    fi

    if [ "$rollback_performed" = "false" ]; then
        if ! nmcli connection show "$ONBOARDING_SETUP_CONNECTION" >/dev/null 2>&1; then
            local first_ethernet
            first_ethernet=$(nmcli -t -f DEVICE,TYPE device | grep ':ethernet$' | head -n 1 | cut -d: -f1)
            if [ -n "$first_ethernet" ]; then
                nmcli connection add \
                    type ethernet \
                    con-name "$ONBOARDING_SETUP_CONNECTION" \
                    ifname "$first_ethernet" \
                    ipv4.method auto \
                    ipv6.method auto \
                    connection.autoconnect yes \
                    connection.autoconnect-priority 100 2>/dev/null || true
                nmcli connection up "$ONBOARDING_SETUP_CONNECTION" 2>/dev/null || true
                rollback_performed=true
                log "Restored onboarding Ethernet connection on $first_ethernet"
            fi
        else
            nmcli connection up "$ONBOARDING_SETUP_CONNECTION" 2>/dev/null || true
            rollback_performed=true
            log "Reactivated existing onboarding Ethernet connection"
        fi
    fi

    if [ "$rollback_performed" = "true" ]; then
        systemctl restart NetworkManager 2>/dev/null || true
    fi
}

reenter_setup_mode() {
    log "Re-entering setup mode"

    rm -f "$MARKER_FILE"

    if systemctl list-unit-files "$SERVICE_NAME" >/dev/null 2>&1; then
        systemctl enable "$SERVICE_NAME" 2>/dev/null || true
        systemctl start "$SERVICE_NAME" 2>/dev/null || true
        log "Setup service re-enabled and started"
    fi
}

cleanup_watchdog() {
    disarm_watchdog
}

kill_running_apply_units() {
    # Unit name pattern matches run-apply-enroll.sh: "flightctl-onboarding-apply-<timestamp>"
    for unit in $(systemctl list-units --type=service --state=running --plain --no-legend 'flightctl-onboarding-apply-*' | awk '{print $1}'); do
        log "Stopping running apply unit: $unit"
        systemctl stop "$unit" 2>/dev/null || true
    done
}

# Main logic
log "Watchdog triggered, checking onboarding state"

if [ ! -f "$WATCHDOG_STATE_FILE" ]; then
    log "Watchdog state file not found, watchdog was not armed — exiting"
    exit 0
fi

CONNECTIVITY_TEST_HOST=$(cat "$WATCHDOG_STATE_FILE" 2>/dev/null || echo "")
if [ -z "$CONNECTIVITY_TEST_HOST" ] || [ "$CONNECTIVITY_TEST_HOST" = "armed" ]; then
    log "No connectivity test host configured, cannot verify network — keeping current configuration"
    write_status "no_host" "No connectivity test host was configured for watchdog verification"
    cleanup_watchdog
    exit 0
fi

if [ -f "$MARKER_FILE" ]; then
    log "Onboarding completed successfully, nothing to do"
    collect_diagnostics "$CONNECTIVITY_TEST_HOST"
    write_status "success" "Onboarding completed before watchdog fired"
    cleanup_watchdog
    exit 0
fi

kill_running_apply_units

collect_diagnostics "$CONNECTIVITY_TEST_HOST"

if is_network_ok; then
    log "Network connectivity is working but enrollment did not complete"
    log "Keeping network configuration, enrollment can be retried"
    write_status "app_failure" "Network is working but enrollment did not complete"
    cleanup_watchdog
    exit 0
fi

log "Network connectivity check failed — performing rollback"
if [ "$DIAG_CARRIER_DETECTED" = "false" ]; then
    write_status "network_failure" "No network carrier detected on any interface"
elif [ "$DIAG_DNS_RESOLVED" = "false" ]; then
    write_status "network_failure" "DNS resolution failed for ${CONNECTIVITY_TEST_HOST}"
else
    write_status "network_failure" "Network connectivity check failed"
fi

rollback_network
reenter_setup_mode
cleanup_watchdog

log "Rollback complete, device should be accessible for re-onboarding"
