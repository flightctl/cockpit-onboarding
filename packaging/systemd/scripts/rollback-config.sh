#!/bin/bash
# rollback-config.sh - Revert configuration changes applied during onboarding
#
# Takes a JSON params file describing what to undo. Only keys present in the
# JSON are rolled back; missing keys are skipped. Idempotent — removing
# nonexistent files is a no-op.
#
# Progress protocol — see flightctl-enroll.sh for prefix format (STEP/OK/ERROR/INFO).
#
# Params JSON format:
#   {
#     "hostname": { "original": "localhost" },
#     "network":  { "connectionId": "flightctl-onboarding-eth0" },
#     "ntp": true,
#     "proxy": true,
#     "labels": true
#   }
set -uo pipefail

PARAMS_FILE="${1:?Usage: rollback-config.sh <params-json-file>}"
EXIT_CODE=0
PROXY_MARKER="# flightctl-onboarding proxy"

if [ ! -f "$PARAMS_FILE" ]; then
    echo "ERROR: Params file not found: $PARAMS_FILE"
    exit 1
fi

# Network rollback
if jq -e '.network' "$PARAMS_FILE" >/dev/null 2>&1; then
    CONNECTION_ID=$(jq -r '.network.connectionId' "$PARAMS_FILE") || true
    if [ -n "$CONNECTION_ID" ]; then
        echo "STEP: Rolling back network configuration"
        if nmcli connection delete "$CONNECTION_ID" 2>/dev/null; then
            echo "OK: Deleted network profile $CONNECTION_ID"
        else
            echo "OK: Network profile already removed"
        fi
    fi
fi

# Hostname rollback
if jq -e '.hostname' "$PARAMS_FILE" >/dev/null 2>&1; then
    ORIGINAL=$(jq -r '.hostname.original' "$PARAMS_FILE") || true
    if [ -n "$ORIGINAL" ]; then
        echo "STEP: Restoring hostname"
        if hostname_err=$(hostnamectl set-hostname "$ORIGINAL" 2>&1); then
            echo "OK: Hostname restored to $ORIGINAL"
        else
            echo "ERROR: Failed to restore hostname to $ORIGINAL"
            echo "$hostname_err"
            EXIT_CODE=1
        fi
    fi
fi

# NTP rollback
if jq -e '.ntp' "$PARAMS_FILE" >/dev/null 2>&1; then
    echo "STEP: Removing NTP configuration"
    rm -f /etc/systemd/timesyncd.conf.d/50-cockpit.conf 2>/dev/null || true
    rm -f /etc/chrony/sources.d/cockpit.sources 2>/dev/null || true
    echo "OK: NTP configuration removed"
fi

# Proxy rollback
if jq -e '.proxy' "$PARAMS_FILE" >/dev/null 2>&1; then
    echo "STEP: Removing proxy configuration"
    rm -f /etc/systemd/system.conf.d/50-flightctl-onboarding-proxy.conf 2>/dev/null || true
    if [ -f /etc/environment ]; then
        sed -i "/${PROXY_MARKER}/,+3d" /etc/environment 2>/dev/null || true
    fi
    systemctl daemon-reexec 2>/dev/null || true
    echo "OK: Proxy configuration removed"
fi

# Labels rollback
if jq -e '.labels' "$PARAMS_FILE" >/dev/null 2>&1; then
    echo "STEP: Removing labels configuration"
    rm -f /etc/flightctl/conf.d/50-cockpit-labels.yaml 2>/dev/null || true
    echo "OK: Labels configuration removed"
fi

rm -f "$PARAMS_FILE" 2>/dev/null || true
exit $EXIT_CODE
