#!/usr/bin/env bash
set -euo pipefail

VM_NAME="cockpit-onboarding-test"
CACHE_DIR="${HOME}/.cache/cockpit-onboarding-test"
LIBVIRT_DIR="/var/lib/libvirt/images"

destroy_vm() {
    if virsh domstate "${VM_NAME}" 2>/dev/null | grep -q "running"; then
        echo "Destroying VM ${VM_NAME}..."
        virsh destroy "${VM_NAME}"
    fi
}

undefine_vm() {
    if virsh dominfo "${VM_NAME}" &>/dev/null; then
        echo "Undefining VM ${VM_NAME}..."
        virsh undefine "${VM_NAME}" --remove-all-storage
    else
        echo "VM ${VM_NAME} is not defined."
    fi
}

cleanup_cache() {
    echo "Removing libvirt disk images..."
    sudo rm -f "${LIBVIRT_DIR}/${VM_NAME}-disk.qcow2"
    sudo rm -f "${LIBVIRT_DIR}/${VM_NAME}-base.qcow2"
    sudo rm -f "${LIBVIRT_DIR}/${VM_NAME}-cloud-init.iso"
    if [[ -d "${CACHE_DIR}" ]]; then
        echo "Removing cached cloud-init files..."
        rm -f "${CACHE_DIR}/cloud-init.iso"
        rm -rf "${CACHE_DIR}/cloud-init"
    fi
}

main() {
    destroy_vm
    undefine_vm
    cleanup_cache
    echo "Cleanup complete."
}

main
