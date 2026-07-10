#!/bin/bash
# Shared constants and functions for cockpit-system-onboarding scripts
# Source this file: . /usr/libexec/cockpit-system-onboarding/common.sh

ONBOARDING_USER_CONFIG="/etc/cockpit/system-onboarding/config.json"
ONBOARDING_DEFAULT_CONFIG="/usr/share/cockpit/system-onboarding/config.json"
ONBOARDING_MARKER_DIR="/var/lib/cockpit-system-onboarding"
ONBOARDING_SCRIPTS_DIR="/usr/libexec/cockpit-system-onboarding"
ONBOARDING_RUNTIME_DIR="/run/cockpit-system-onboarding"
ONBOARDING_SETUP_CONNECTION="Cockpit-Onboarding-Ethernet"

# Load a configuration value with fallback hierarchy:
#   1. User override (/etc/cockpit/system-onboarding/config.json)
#   2. Package default (/usr/share/cockpit/system-onboarding/config.json)
#   3. Built-in default (second argument)
# Usage: load_config '.key.path' 'default_value'
load_config() {
    local key="$1"
    local default="$2"

    if [ -f "$ONBOARDING_USER_CONFIG" ]; then
        value=$(jq -r "$key" "$ONBOARDING_USER_CONFIG" 2>/dev/null)
        if [ -n "$value" ] && [ "$value" != "null" ]; then
            echo "$value"
            return
        fi
    fi

    if [ -f "$ONBOARDING_DEFAULT_CONFIG" ]; then
        value=$(jq -r "$key" "$ONBOARDING_DEFAULT_CONFIG" 2>/dev/null)
        if [ -n "$value" ] && [ "$value" != "null" ]; then
            echo "$value"
            return
        fi
    fi

    echo "$default"
}

# Disarm the connectivity watchdog so it cannot fire while the caller
# writes a failure status or performs a rollback.
disarm_watchdog() {
    systemctl stop cockpit-system-onboarding-watchdog.timer 2>/dev/null || true
    systemctl stop cockpit-system-onboarding-watchdog.service 2>/dev/null || true
    rm -f "${ONBOARDING_MARKER_DIR}/.watchdog-active" 2>/dev/null || true
}

prefix_to_netmask() {
    local prefix=$1
    local mask=$((0xFFFFFFFF << (32 - prefix) & 0xFFFFFFFF))
    printf "%d.%d.%d.%d\n" \
        $(( (mask >> 24) & 0xFF )) \
        $(( (mask >> 16) & 0xFF )) \
        $(( (mask >> 8)  & 0xFF )) \
        $(( mask         & 0xFF ))
}

compute_dhcp_range() {
    local base_ip=$1
    local prefix=$2
    local range_size=$3

    IFS='.' read -r a b c d <<< "$base_ip"
    local base_num=$(( (a << 24) + (b << 16) + (c << 8) + d ))
    local start_num=$(( base_num + 9 ))
    local end_num=$(( start_num + range_size - 1 ))

    DHCP_RANGE_START=$(printf "%d.%d.%d.%d" \
        $(( (start_num >> 24) & 0xFF )) \
        $(( (start_num >> 16) & 0xFF )) \
        $(( (start_num >> 8)  & 0xFF )) \
        $(( start_num         & 0xFF )))
    DHCP_RANGE_END=$(printf "%d.%d.%d.%d" \
        $(( (end_num >> 24) & 0xFF )) \
        $(( (end_num >> 16) & 0xFF )) \
        $(( (end_num >> 8)  & 0xFF )) \
        $(( end_num         & 0xFF )))
    DHCP_NETMASK=$(prefix_to_netmask "$prefix")
}
