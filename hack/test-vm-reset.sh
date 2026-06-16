#!/usr/bin/env bash
# Reset the test VM to a clean onboarding state.
# Removes onboarding profiles, VLAN interfaces, completion markers,
# and restarts cockpit so the wizard is accessible again.
#
# Usage: hack/test-vm-reset.sh [vm-ip]
set -euo pipefail

VM_NAME="cockpit-onboarding-test"

if [ -n "${1:-}" ]; then
    VM_IP="$1"
else
    VM_IP=$(sudo virsh domifaddr "$VM_NAME" 2>/dev/null \
        | awk '/ipv4/ {split($4,a,"/"); print a[1]}' | head -1)
    if [ -z "$VM_IP" ]; then
        echo "ERROR: Could not detect VM IP. Pass it as an argument: $0 <vm-ip>"
        exit 1
    fi
fi

echo "=== Resetting VM at $VM_IP ==="

ssh "fedora@${VM_IP}" bash -s <<'REMOTE'
set -euo pipefail

echo "Removing onboarding NM profiles..."
nmcli -t -f NAME connection show 2>/dev/null \
    | grep '^flightctl-onboarding-' \
    | while read -r conn; do
        sudo nmcli connection delete "$conn" 2>/dev/null && echo "  Deleted: $conn"
    done

echo "Removing VLAN subinterfaces..."
ip -br link 2>/dev/null | awk '{print $1}' | grep '\.' | while read -r iface; do
    iface="${iface%@*}"
    case "$iface" in
        enp*.*|eth*.*)
            sudo ip link delete "$iface" 2>/dev/null && echo "  Removed: $iface"
            ;;
    esac
done

echo "Clearing onboarding markers..."
sudo rm -f /var/lib/cockpit-system-onboarding/.onboarding-complete
sudo rm -f /var/lib/cockpit-system-onboarding/.onboarding-attempted
sudo rm -f /var/lib/cockpit-system-onboarding/.watchdog-active
sudo rm -f /var/lib/cockpit-system-onboarding/.watchdog-status

echo "Updating sudoers..."
sudo cp /usr/share/cockpit/system-onboarding/sudoers.conf /etc/sudoers.d/cockpit-system-onboarding
sudo chmod 440 /etc/sudoers.d/cockpit-system-onboarding

echo "Restarting cockpit..."
sudo systemctl restart cockpit.socket 2>/dev/null || true

echo "VM reset complete"
REMOTE

echo ""
echo "Wizard available at http://${VM_IP}:9090"
