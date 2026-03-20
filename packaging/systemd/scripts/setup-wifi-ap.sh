#!/bin/bash
# Configure WiFi Access Point for initial system access
# Part of cockpit-system-onboarding first-boot setup

set -e

USER_CONFIG="/etc/cockpit/system-onboarding/config.json"
DEFAULT_CONFIG="/usr/share/cockpit/system-onboarding/config.json"
RUNTIME_DIR="/run/cockpit-system-onboarding"
DEFAULT_AP_ADDRESS="10.42.0.1"
DEFAULT_AP_NETMASK="24"

# Load configuration with fallback hierarchy
load_config() {
    local key="$1"
    local default="$2"

    # Try user override first
    if [ -f "$USER_CONFIG" ]; then
        value=$(jq -r "$key" "$USER_CONFIG" 2>/dev/null)
        if [ -n "$value" ] && [ "$value" != "null" ]; then
            echo "$value"
            return
        fi
    fi

    # Fall back to default config
    if [ -f "$DEFAULT_CONFIG" ]; then
        value=$(jq -r "$key" "$DEFAULT_CONFIG" 2>/dev/null)
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
    echo "Skipping WiFi AP setup"
    exit 0
fi

# Check if WiFi AP is enabled
WIFI_AP_ENABLED=$(load_config '.network.wifiAp.enabled' 'false')
if [ "$WIFI_AP_ENABLED" != "true" ]; then
    echo "WiFi AP is disabled in configuration"
    exit 0
fi

# Check for hostapd
if ! command -v hostapd >/dev/null 2>&1; then
    echo "WARNING: hostapd is not installed, cannot create WiFi AP"
    echo "Install with: dnf install hostapd"
    exit 0
fi

# Get configuration values
SSID_PREFIX=$(load_config '.network.wifiAp.ssidPrefix' 'cockpit-')
PASSWORD=$(load_config '.network.wifiAp.password' '')

# Auto-detect first WiFi interface
WIFI_INTERFACE=$(nmcli -t -f DEVICE,TYPE device | grep ':wifi$' | head -n 1 | cut -d: -f1)

if [ -z "$WIFI_INTERFACE" ]; then
    echo "No WiFi interface found"
    echo "Skipping WiFi AP setup"
    exit 0
fi

echo "Using WiFi interface: $WIFI_INTERFACE"

# Generate SSID from prefix + short hostname suffix
HOSTNAME_SUFFIX=$(hostname -s | tail -c 7)
SSID="${SSID_PREFIX}${HOSTNAME_SUFFIX}"
echo "WiFi AP SSID: $SSID"

# Create runtime directory
mkdir -p "$RUNTIME_DIR"

# Generate hostapd configuration
HOSTAPD_CONF="$RUNTIME_DIR/hostapd-${WIFI_INTERFACE}.conf"
cat > "$HOSTAPD_CONF" <<EOF
interface=${WIFI_INTERFACE}
driver=nl80211
ssid=${SSID}
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
ieee80211n=1
EOF

# Add WPA2 security if password is set, otherwise open network
if [ -n "$PASSWORD" ]; then
    cat >> "$HOSTAPD_CONF" <<EOF
auth_algs=1
wpa=2
wpa_passphrase=${PASSWORD}
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF
    echo "WiFi AP configured with WPA2 security"
else
    cat >> "$HOSTAPD_CONF" <<EOF
auth_algs=1
EOF
    echo "WiFi AP configured as open network (no password)"
fi

# Generate dnsmasq configuration for DHCP on the AP network
DNSMASQ_CONF="$RUNTIME_DIR/dnsmasq-${WIFI_INTERFACE}.conf"
cat > "$DNSMASQ_CONF" <<EOF
interface=${WIFI_INTERFACE}
bind-interfaces
dhcp-range=10.42.0.10,10.42.0.50,255.255.255.0,1h
dhcp-option=3,${DEFAULT_AP_ADDRESS}
dhcp-option=6,${DEFAULT_AP_ADDRESS}
no-resolv
no-hosts
address=/#/${DEFAULT_AP_ADDRESS}
EOF
echo "Generated dnsmasq DHCP config"

# Generate environment file for the systemd service
cat > "$RUNTIME_DIR/wifi-ap.env" <<EOF
WIFI_AP_ADDRESS=${DEFAULT_AP_ADDRESS}
WIFI_AP_NETMASK=${DEFAULT_AP_NETMASK}
EOF

# Enable and start the WiFi AP service for this interface
systemctl enable "cockpit-system-onboarding-wifi-ap@${WIFI_INTERFACE}.service" 2>/dev/null || true
systemctl start "cockpit-system-onboarding-wifi-ap@${WIFI_INTERFACE}.service"

echo "WiFi AP started on $WIFI_INTERFACE"
echo "AP accessible at: http://${DEFAULT_AP_ADDRESS}:9090"
