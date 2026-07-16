#!/bin/bash
# Configure well-known Ethernet IP for initial system access
# Part of flightctl-onboarding first-boot setup

set -e

# shellcheck source=common.sh
. /usr/libexec/flightctl-onboarding/common.sh

RUNTIME_DIR="$ONBOARDING_RUNTIME_DIR"

# Check if either config file exists
if [ ! -f "$ONBOARDING_USER_CONFIG" ] && [ ! -f "$ONBOARDING_DEFAULT_CONFIG" ]; then
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
STATIC_IP=$(load_config '.network.ethernet.staticIp' '192.168.100.1')
SUBNET_PREFIX=$(load_config '.network.ethernet.subnetPrefix' '24')
DHCP_RANGE_SIZE=$(load_config '.network.ethernet.dhcpRangeSize' '40')

compute_dhcp_range "$STATIC_IP" "$SUBNET_PREFIX" "$DHCP_RANGE_SIZE"

if [ -z "$ETHERNET_INTERFACE" ]; then
    if ! ETHERNET_INTERFACE=$(detect_interface ethernet); then
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
CONNECTION_NAME="$ONBOARDING_SETUP_CONNECTION"

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
    ipv4.addresses "$STATIC_IP/$SUBNET_PREFIX" \
    ipv6.method disabled \
    connection.autoconnect yes \
    connection.autoconnect-priority 100

# Activate the connection
nmcli connection up "$CONNECTION_NAME" || true

echo "Configured $ETHERNET_INTERFACE with IP $STATIC_IP"

# Optionally start a DHCP server so directly-connected laptops auto-get an IP
if command -v dnsmasq >/dev/null 2>&1; then
    mkdir -p "$RUNTIME_DIR"

    DNSMASQ_CONF="$RUNTIME_DIR/dnsmasq-${ETHERNET_INTERFACE}.conf"
    cat > "$DNSMASQ_CONF" <<EOF
interface=${ETHERNET_INTERFACE}
bind-interfaces
except-interface=lo
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},${DHCP_NETMASK},1h
dhcp-option=3,${STATIC_IP}
dhcp-option=6,${STATIC_IP}
no-resolv
no-hosts
dhcp-leasefile=/tmp/dnsmasq-${ETHERNET_INTERFACE}.leases
pid-file=/tmp/dnsmasq-${ETHERNET_INTERFACE}.pid
EOF
    echo "Generated dnsmasq DHCP config for $ETHERNET_INTERFACE"

    systemctl enable "flightctl-onboarding-dnsmasq@${ETHERNET_INTERFACE}.service" 2>/dev/null || true
    systemctl start "flightctl-onboarding-dnsmasq@${ETHERNET_INTERFACE}.service"
    echo "DHCP server started on $ETHERNET_INTERFACE (range ${DHCP_RANGE_START}-${DHCP_RANGE_END})"
else
    echo "dnsmasq is not installed, skipping DHCP server setup"
    echo "Technicians will need to manually configure a static IP to reach this device"
fi

echo "System accessible at: http://$STATIC_IP:9090"
