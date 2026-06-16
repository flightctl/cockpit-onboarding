#!/usr/bin/env bash
# Tear down the VLAN test environment created by test-vlan-setup.sh.
# Requires: sudo
set -euo pipefail

VM_NAME="cockpit-onboarding-test"
BRIDGE="br-vlantest"
VLAN_ID=100

echo "=== Stopping DNS forwarder ==="
if [ -f /run/dnsmasq-vlantest.pid ]; then
    sudo kill "$(cat /run/dnsmasq-vlantest.pid)" 2>/dev/null || true
    sudo rm -f /run/dnsmasq-vlantest.pid
    echo "dnsmasq stopped"
else
    echo "No dnsmasq pid file found, skipping"
fi

echo "=== Detaching NIC from VM ==="
if sudo virsh dominfo "$VM_NAME" >/dev/null 2>&1; then
    MAC=$(sudo virsh domiflist "$VM_NAME" | grep "$BRIDGE" | awk '{print $5}')
    if [ -n "$MAC" ]; then
        sudo virsh detach-interface "$VM_NAME" bridge --mac "$MAC" --live || true
        echo "Detached interface $MAC from $VM_NAME"
    else
        echo "No interface on $BRIDGE found in $VM_NAME"
    fi
else
    echo "VM '$VM_NAME' not found, skipping detach"
fi

echo "=== Removing nftables NAT ==="
sudo nft delete table ip vlan_nat 2>/dev/null || true
echo "nftables vlan_nat table removed"

echo "=== Removing firewalld forwarding rules ==="
sudo firewall-cmd --direct --remove-rule ipv4 filter FORWARD 0 -i "${BRIDGE}.${VLAN_ID}" -j ACCEPT 2>/dev/null || true
sudo firewall-cmd --direct --remove-rule ipv4 filter FORWARD 0 -o "${BRIDGE}.${VLAN_ID}" -j ACCEPT 2>/dev/null || true

echo "=== Removing VLAN subinterface ==="
if ip link show "${BRIDGE}.${VLAN_ID}" >/dev/null 2>&1; then
    sudo ip link del "${BRIDGE}.${VLAN_ID}"
    echo "Removed ${BRIDGE}.${VLAN_ID}"
fi

echo "=== Removing bridge ==="
if ip link show "$BRIDGE" >/dev/null 2>&1; then
    sudo ip link set "$BRIDGE" down
    sudo ip link del "$BRIDGE"
    echo "Removed $BRIDGE"
fi

echo "VLAN test environment cleaned up"
