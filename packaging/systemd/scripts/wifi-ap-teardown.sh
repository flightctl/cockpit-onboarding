#!/bin/bash
set -euo pipefail

IFACE="${1:?Usage: wifi-ap-teardown.sh <interface>}"

# Remove the interface from the onboarding firewalld zone (best-effort)
firewall-cmd --zone=fc-onboarding-ap --remove-interface="$IFACE" 2>/dev/null || true

ip addr flush dev "$IFACE"
ip link set "$IFACE" down

# Re-enable IPv6 on the interface (setup-wifi-ap.sh disabled it via sysctl)
sysctl -w "net.ipv6.conf.${IFACE}.disable_ipv6=0" 2>/dev/null || true

# Return the interface to NetworkManager management (best-effort)
nmcli device set "$IFACE" managed yes 2>/dev/null || true
