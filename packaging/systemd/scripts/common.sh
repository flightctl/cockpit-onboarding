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
