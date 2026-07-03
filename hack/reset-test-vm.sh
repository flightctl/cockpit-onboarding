#!/usr/bin/env bash
# Revert cockpit-onboarding-test to the post-deploy "fresh" disk snapshot.
#
# Usage: make reset-test-vm
set -euo pipefail

VM_NAME="cockpit-onboarding-test"
SNAPSHOT_NAME="fresh"

if ! virsh dominfo "${VM_NAME}" &>/dev/null; then
    echo "ERROR: VM '${VM_NAME}' not found. Run 'make deploy-test-vm' first." >&2
    exit 1
fi

if ! virsh snapshot-info "${VM_NAME}" "${SNAPSHOT_NAME}" &>/dev/null; then
    echo "ERROR: Snapshot '${SNAPSHOT_NAME}' not found. Run 'make deploy-test-vm' to create it." >&2
    exit 1
fi

echo "=== Reverting ${VM_NAME} to '${SNAPSHOT_NAME}' snapshot ==="

if virsh domstate "${VM_NAME}" 2>/dev/null | grep -q running; then
    echo "Shutting down VM..."
    virsh destroy "${VM_NAME}"
fi

virsh snapshot-revert "${VM_NAME}" "${SNAPSHOT_NAME}"
virsh start "${VM_NAME}"

echo "Waiting for VM to obtain an IP address..."
vm_ip=""
attempts=0
while [ -z "$vm_ip" ] && [ "$attempts" -lt 60 ]; do
    vm_ip=$(virsh domifaddr "${VM_NAME}" 2>/dev/null \
        | awk '/ipv4/ {split($4,a,"/"); print a[1]}' | head -1) || true
    if [ -z "$vm_ip" ]; then
        sleep 2
        attempts=$((attempts + 1))
    fi
done
if [ -z "$vm_ip" ]; then
    echo "ERROR: Timed out waiting for VM IP address" >&2
    exit 1
fi

echo "Waiting for SSH on ${vm_ip}..."
attempts=0
while [ "$attempts" -lt 60 ]; do
    if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            -o ConnectTimeout=5 -o BatchMode=yes \
            "fedora@${vm_ip}" true 2>/dev/null; then
        break
    fi
    sleep 2
    attempts=$((attempts + 1))
done
if [ "$attempts" -ge 60 ]; then
    echo "ERROR: Timed out waiting for SSH on ${vm_ip}" >&2
    exit 1
fi

echo ""
echo "Reset complete."
echo "  Cockpit: https://${vm_ip}:9090"
echo "  SSH:     ssh fedora@${vm_ip}"
