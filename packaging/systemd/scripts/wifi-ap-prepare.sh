#!/bin/bash
set -euo pipefail

IFACE="${1:?Usage: wifi-ap-prepare.sh <interface>}"

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
. "$SCRIPT_DIR/common.sh"

# Release the interface from NetworkManager (best-effort)
nmcli device disconnect "$IFACE" 2>/dev/null || true
nmcli device set "$IFACE" managed no 2>/dev/null || true

# NM brings the interface down asynchronously after releasing it;
# wait for that to settle before bringing it back up for hostapd.
sleep 2
ip link set "$IFACE" up
for i in $(seq 10); do
    [ "$(cat "/sys/class/net/${IFACE}/operstate")" != "down" ] && break
    sleep 0.5
done

if [ "$(cat "/sys/class/net/${IFACE}/operstate")" = "down" ]; then
    echo "WARNING: $IFACE did not come up"
fi

# Copy hostapd config to /run/hostapd/ for correct SELinux labeling.
# hostapd runs in hostapd_t domain (via hostapd_exec_t transition) which can
# only read hostapd_var_run_t files. /var/run/hostapd(/.*)? has that label;
# /run/flightctl-onboarding/ files get generic var_run_t and are denied.
mkdir -p /run/hostapd
cp "${ONBOARDING_RUNTIME_DIR}/hostapd-${IFACE}.conf" /run/hostapd/
restorecon "/run/hostapd/hostapd-${IFACE}.conf"
