#!/bin/bash
# Verify required packages are installed
# Part of cockpit-system-onboarding first-boot setup

set -e

MISSING_DEPS=()

# Check for required commands/packages
check_command() {
    local cmd="$1"
    local package="$2"

    if ! command -v "$cmd" >/dev/null 2>&1; then
        MISSING_DEPS+=("$package")
        return 1
    fi
    return 0
}

check_systemd_service() {
    local service="$1"
    local package="$2"

    if ! systemctl list-unit-files "$service" >/dev/null 2>&1; then
        MISSING_DEPS+=("$package")
        return 1
    fi
    return 0
}

echo "Checking dependencies..."

# Required dependencies
check_command "nmcli" "NetworkManager" || true
check_command "jq" "jq" || true

# Check for Cockpit
if ! command -v cockpit-bridge >/dev/null 2>&1; then
    MISSING_DEPS+=("cockpit-bridge")
fi

# Optional dependencies (warnings only)
OPTIONAL_MISSING=()

if ! check_command "hostapd" "hostapd"; then
    OPTIONAL_MISSING+=("hostapd")
fi

if ! check_command "dnsmasq" "dnsmasq"; then
    OPTIONAL_MISSING+=("dnsmasq")
fi

# Report results
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo "ERROR: Required packages are missing:"
    printf '  - %s\n' "${MISSING_DEPS[@]}"
    echo ""
    echo "Please install the missing packages:"
    echo "  dnf install ${MISSING_DEPS[*]}"
    echo "  or"
    echo "  apt install ${MISSING_DEPS[*]}"
    exit 1
fi

if [ ${#OPTIONAL_MISSING[@]} -gt 0 ]; then
    echo "WARNING: Optional packages are missing (WiFi AP feature will not work):"
    printf '  - %s\n' "${OPTIONAL_MISSING[@]}"
    echo ""
    echo "To enable WiFi AP support, install:"
    echo "  dnf install ${OPTIONAL_MISSING[*]}"
    echo "  or"
    echo "  apt install ${OPTIONAL_MISSING[*]}"
fi

echo "All required dependencies are satisfied"
exit 0
