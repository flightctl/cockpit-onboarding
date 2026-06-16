#!/usr/bin/env bash
# Set up an isolated VLAN-capable bridge and attach a NIC to the test VM
# so the onboarding wizard's VLAN feature can be verified end-to-end.
#
# Prerequisites: test VM running (`make deploy-test-vm`), dnsmasq installed
# Requires: sudo (bridge, libvirt, nftables, and dnsmasq operations)
set -euo pipefail

VM_NAME="cockpit-onboarding-test"
BRIDGE="br-vlantest"
VLAN_ID=100
HOST_IP="10.100.0.1"
VM_IP="10.100.0.2"
NETMASK="24"

if ! sudo virsh dominfo "$VM_NAME" >/dev/null 2>&1; then
    echo "ERROR: VM '$VM_NAME' not found. Run 'make deploy-test-vm' first."
    exit 1
fi

if ! sudo virsh domstate "$VM_NAME" | grep -q running; then
    echo "ERROR: VM '$VM_NAME' is not running."
    exit 1
fi

if ip link show "$BRIDGE" >/dev/null 2>&1; then
    echo "Bridge '$BRIDGE' already exists — run hack/test-vlan-teardown.sh first."
    exit 1
fi

echo "=== Creating VLAN test bridge ==="
sudo ip link add "$BRIDGE" type bridge
sudo ip link set "$BRIDGE" type bridge vlan_filtering 1
sudo ip link set "$BRIDGE" up

echo "=== Creating host-side VLAN $VLAN_ID subinterface ==="
sudo bridge vlan add vid "$VLAN_ID" dev "$BRIDGE" self
sudo ip link add link "$BRIDGE" name "${BRIDGE}.${VLAN_ID}" type vlan id "$VLAN_ID"
sudo ip addr add "${HOST_IP}/${NETMASK}" dev "${BRIDGE}.${VLAN_ID}"
sudo ip link set "${BRIDGE}.${VLAN_ID}" up

echo "=== Attaching NIC to VM ==="
sudo virsh attach-interface "$VM_NAME" bridge "$BRIDGE" --model virtio --live

sleep 2

VNET=$(sudo virsh domiflist "$VM_NAME" | grep "$BRIDGE" | awk '{print $1}')
if [ -z "$VNET" ]; then
    echo "ERROR: Could not find vnet device for bridge $BRIDGE"
    exit 1
fi

echo "=== Configuring trunk VLAN $VLAN_ID on $VNET ==="
sudo bridge vlan add vid "$VLAN_ID" dev "$VNET" trunk

echo "=== Enabling IP forwarding ==="
sudo sysctl -q net.ipv4.ip_forward=1

echo "=== Adding firewalld forwarding rules ==="
sudo firewall-cmd --direct --add-rule ipv4 filter FORWARD 0 -i "${BRIDGE}.${VLAN_ID}" -j ACCEPT 2>/dev/null || true
sudo firewall-cmd --direct --add-rule ipv4 filter FORWARD 0 -o "${BRIDGE}.${VLAN_ID}" -j ACCEPT 2>/dev/null || true

echo "=== Adding nftables NAT ==="
sudo nft add table ip vlan_nat 2>/dev/null || true
sudo nft add chain ip vlan_nat postrouting '{ type nat hook postrouting priority 100 ; }' 2>/dev/null || true
sudo nft add rule ip vlan_nat postrouting ip saddr 10.100.0.0/24 masquerade

echo "=== Starting DNS forwarder on ${HOST_IP} ==="
sudo dnsmasq \
    --interface="${BRIDGE}.${VLAN_ID}" \
    --bind-interfaces \
    --no-dhcp-interface="${BRIDGE}.${VLAN_ID}" \
    --listen-address="${HOST_IP}" \
    --pid-file=/run/dnsmasq-vlantest.pid

VM_IP_ADDR=$(sudo virsh domifaddr "$VM_NAME" 2>/dev/null \
    | awk '/ipv4/ {split($4,a,"/"); print a[1]}' | head -1)

echo ""
echo "=========================================="
echo " VLAN Test Environment Ready"
echo "=========================================="
echo ""
echo "Host bridge:  $BRIDGE (VLAN $VLAN_ID)"
echo "Host IP:      ${HOST_IP}/${NETMASK} (on ${BRIDGE}.${VLAN_ID})"
echo "DNS server:   ${HOST_IP} (dnsmasq forwarder)"
echo "VM vnet:      $VNET (trunk VLAN $VLAN_ID)"
echo ""
echo "--- Wizard Configuration ---"
echo ""
echo "1. Open the wizard at http://${VM_IP_ADDR:-<vm-ip>}:9090"
echo "   Select the new NIC (enp8s0), enable VLAN, set ID to $VLAN_ID"
echo "   Set static IPv4: ${VM_IP}/${NETMASK}, gateway ${HOST_IP}"
echo "   Set DNS to ${HOST_IP}"
echo ""
echo "2. After applying, verify from the VM:"
echo "   ip link show              # <iface>.$VLAN_ID should exist"
echo "   nmcli connection show     # profile should have vlan.id=$VLAN_ID"
echo "   ping -c 3 ${HOST_IP}     # host should respond over VLAN"
echo ""
echo "3. Teardown when done:"
echo "   hack/test-vlan-teardown.sh"
