#!/bin/bash
set -euo pipefail

IFACE="${1:?Usage: wifi-ap-activate.sh <interface>}"

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
. "$SCRIPT_DIR/common.sh"

# Load AP address settings written by setup-wifi-ap.sh
. "${ONBOARDING_RUNTIME_DIR}/wifi-ap.env"

ip addr add "${WIFI_AP_ADDRESS}/${WIFI_AP_NETMASK}" dev "$IFACE"

# Add the interface to the onboarding firewalld zone (best-effort)
firewall-cmd --zone=fc-onboarding-ap --add-interface="$IFACE" 2>/dev/null || true
