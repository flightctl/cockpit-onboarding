#!/bin/bash
# Configure well-known Ethernet IP for initial system access
# Part of cockpit-system-onboarding first-boot setup

set -e

USER_CONFIG="/etc/cockpit/system-onboarding/config.json"
DEFAULT_CONFIG="/usr/share/cockpit/system-onboarding/config.json"
DEFAULT_IP="192.168.100.1"
DEFAULT_PREFIX="24"

# Load configuration with fallback hierarchy
load_config() {
    local key="$1"
    local default="$2"

    # Try user override first
    if [ -f "$USER_CONFIG" ]; then
        value=$(jq -r "$key // empty" "$USER_CONFIG" 2>/dev/null)
        if [ -n "$value" ] && [ "$value" != "null" ]; then
            echo "$value"
            return
        fi
    fi

    # Fall back to default config
    if [ -f "$DEFAULT_CONFIG" ]; then
        value=$(jq -r "$key // empty" "$DEFAULT_CONFIG" 2>/dev/null)
        if [ -n "$value" ] && [ "$value" != "null" ]; then
            echo "$value"
            return
        fi
    fi

    # Use built-in default
    echo "$default"
}

# Check if either config file exists
if [ ! -f "$USER_CONFIG" ] && [ ! -f "$DEFAULT_CONFIG" ]; then
    echo "No configuration file found"
    echo "Skipping network setup"
    exit 0
fi

# Check if Ethernet network setup is enabled
ETHERNET_ENABLED=$(load_config '.network.ethernet.enabled' 'true')
if [ "$ETHERNET_ENABLED" != "true" ]; then
    echo "Ethernet setup is disabled in configuration"
    exit 0
fi

# Get configuration values
ETHERNET_INTERFACE=$(load_config '.network.ethernet.interface' '')
STATIC_IP=$(load_config '.network.ethernet.staticIp' "$DEFAULT_IP")

# If no interface specified, try to find first Ethernet interface
if [ -z "$ETHERNET_INTERFACE" ]; then
    # Find first wired Ethernet interface (not loopback, not wireless)
    ETHERNET_INTERFACE=$(nmcli -t -f DEVICE,TYPE device | grep ':ethernet$' | head -n 1 | cut -d: -f1)

    if [ -z "$ETHERNET_INTERFACE" ]; then
        echo "No Ethernet interface found and none specified in configuration"
        exit 0
    fi
    echo "Auto-detected Ethernet interface: $ETHERNET_INTERFACE"
fi

# Check if interface exists
if ! nmcli device show "$ETHERNET_INTERFACE" >/dev/null 2>&1; then
    echo "Interface $ETHERNET_INTERFACE not found"
    exit 1
fi

# Create NetworkManager connection for onboarding access
CONNECTION_NAME="Cockpit-Onboarding-Ethernet"

# Delete existing onboarding connection if it exists
if nmcli connection show "$CONNECTION_NAME" >/dev/null 2>&1; then
    nmcli connection delete "$CONNECTION_NAME" || true
fi

# Create new connection with static IP
nmcli connection add \
    type ethernet \
    con-name "$CONNECTION_NAME" \
    ifname "$ETHERNET_INTERFACE" \
    ipv4.method manual \
    ipv4.addresses "$STATIC_IP/$DEFAULT_PREFIX" \
    ipv6.method disabled \
    connection.autoconnect yes \
    connection.autoconnect-priority 100

# Activate the connection
nmcli connection up "$CONNECTION_NAME" || true

echo "Configured $ETHERNET_INTERFACE with IP $STATIC_IP"
echo "System accessible at: http://$STATIC_IP:9090"
