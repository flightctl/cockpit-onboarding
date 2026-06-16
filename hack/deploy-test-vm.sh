#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

VM_NAME="cockpit-onboarding-test"
VM_RAM=4096
VM_VCPUS=2
VM_DISK_SIZE=20
FEDORA_VERSION=43
FEDORA_BUILD="${FEDORA_VERSION}-1.6"
CACHE_DIR="${HOME}/.cache/cockpit-onboarding-test"
LIBVIRT_DIR="/var/lib/libvirt/images"
IMAGE_NAME="Fedora-Cloud-Base-Generic-${FEDORA_BUILD}.x86_64.qcow2"
IMAGE_URL="https://dl.fedoraproject.org/pub/fedora/linux/releases/${FEDORA_VERSION}/Cloud/x86_64/images/${IMAGE_NAME}"

find_ssh_pubkey() {
    for key in "${HOME}/.ssh/id_ed25519.pub" "${HOME}/.ssh/id_rsa.pub"; do
        if [[ -f "${key}" ]]; then
            echo "${key}"
            return
        fi
    done
    echo "ERROR: No SSH public key found at ~/.ssh/id_ed25519.pub or ~/.ssh/id_rsa.pub" >&2
    exit 1
}

download_image() {
    mkdir -p "${CACHE_DIR}"
    if [[ -f "${CACHE_DIR}/${IMAGE_NAME}" ]]; then
        echo "Using cached Fedora cloud image: ${CACHE_DIR}/${IMAGE_NAME}"
        return
    fi
    echo "Downloading Fedora ${FEDORA_VERSION} cloud image..."
    curl -L -o "${CACHE_DIR}/${IMAGE_NAME}" "${IMAGE_URL}"
    echo "Download complete."
}

create_cloud_init_iso() {
    local ssh_pubkey
    ssh_pubkey="$(cat "$(find_ssh_pubkey)")"
    local ci_dir="${CACHE_DIR}/cloud-init"
    mkdir -p "${ci_dir}"

    cat > "${ci_dir}/meta-data" <<EOF
instance-id: ${VM_NAME}
local-hostname: ${VM_NAME}
EOF

    cat > "${ci_dir}/user-data" <<EOF
#cloud-config
users:
  - name: fedora
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - ${ssh_pubkey}
  - name: root
    ssh_authorized_keys:
      - ${ssh_pubkey}
ssh_pwauth: false
EOF

    if command -v xorrisofs &>/dev/null; then
        xorrisofs -output "${CACHE_DIR}/cloud-init.iso" \
            -volid cidata -joliet -rock -partition_cyl_align on \
            "${ci_dir}"
    elif command -v genisoimage &>/dev/null; then
        genisoimage -output "${CACHE_DIR}/cloud-init.iso" \
            -volid cidata -joliet -rock \
            "${ci_dir}"
    else
        echo "ERROR: xorrisofs or genisoimage is required to create cloud-init ISO" >&2
        exit 1
    fi
}

create_vm_disk() {
    sudo rm -f "${LIBVIRT_DIR}/${VM_NAME}-disk.qcow2"
    sudo cp "${CACHE_DIR}/${IMAGE_NAME}" "${LIBVIRT_DIR}/${VM_NAME}-base.qcow2"
    sudo qemu-img create -f qcow2 -b "${LIBVIRT_DIR}/${VM_NAME}-base.qcow2" -F qcow2 \
        "${LIBVIRT_DIR}/${VM_NAME}-disk.qcow2" "${VM_DISK_SIZE}G"
    sudo cp "${CACHE_DIR}/cloud-init.iso" "${LIBVIRT_DIR}/${VM_NAME}-cloud-init.iso"
}

create_vm() {
    echo "Creating VM ${VM_NAME}..."
    virt-install \
        --name "${VM_NAME}" \
        --memory "${VM_RAM}" \
        --vcpus "${VM_VCPUS}" \
        --disk "path=${LIBVIRT_DIR}/${VM_NAME}-disk.qcow2,format=qcow2" \
        --disk "path=${LIBVIRT_DIR}/${VM_NAME}-cloud-init.iso,device=cdrom" \
        --os-variant "fedora${FEDORA_VERSION}" \
        --network network=default \
        --network network=default \
        --graphics none \
        --console pty,target_type=serial \
        --import \
        --noautoconsole \
        --wait 0
    echo "VM ${VM_NAME} created."
}

wait_for_vm_ip() {
    echo "Waiting for VM to obtain an IP address..." >&2
    local attempts=0
    local max_attempts=60
    local vm_ip=""
    while [[ -z "${vm_ip}" && ${attempts} -lt ${max_attempts} ]]; do
        vm_ip=$(virsh domifaddr "${VM_NAME}" 2>/dev/null | awk '/ipv4/ {split($4,a,"/"); print a[1]}' | head -1) || true
        if [[ -z "${vm_ip}" ]]; then
            sleep 2
            attempts=$((attempts + 1))
        fi
    done
    if [[ -z "${vm_ip}" ]]; then
        echo "ERROR: Timed out waiting for VM IP address" >&2
        exit 1
    fi
    echo "${vm_ip}"
}

wait_for_ssh() {
    local vm_ip="$1"
    echo "Waiting for SSH to become ready on ${vm_ip}..."
    local attempts=0
    local max_attempts=60
    while [[ ${attempts} -lt ${max_attempts} ]]; do
        if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
                -o ConnectTimeout=5 -o BatchMode=yes \
                "fedora@${vm_ip}" true 2>/dev/null; then
            echo "SSH is ready."
            return
        fi
        sleep 2
        attempts=$((attempts + 1))
    done
    echo "ERROR: Timed out waiting for SSH" >&2
    exit 1
}

run_ssh() {
    local vm_ip="$1"
    shift
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        "fedora@${vm_ip}" "$@"
}

provision_vm() {
    local vm_ip="$1"

    echo "Updating system packages to align kernel and modules..."
    run_ssh "${vm_ip}" "sudo dnf update -y"

    echo "Rebooting VM to boot into updated kernel..."
    run_ssh "${vm_ip}" "sudo reboot" || true
    sleep 5
    wait_for_ssh "${vm_ip}"

    echo "Installing required packages..."
    run_ssh "${vm_ip}" "sudo dnf install -y cockpit cockpit-ws cockpit-bridge jq chrony"

    echo "Preparing development rsync target..."
    run_ssh "${vm_ip}" "sudo mkdir -p /usr/local/share/cockpit && sudo chown fedora:fedora /usr/local/share/cockpit"

    echo "Enabling chronyd for NTP..."
    run_ssh "${vm_ip}" "sudo systemctl enable --now chronyd"

    echo "Installing WiFi simulation packages..."
    run_ssh "${vm_ip}" "sudo dnf install -y kernel-modules-internal kernel-modules-extra NetworkManager-wifi wpa_supplicant iw wireless-regdb hostapd linux-firmware"

    echo "Restarting NetworkManager to load WiFi plugin..."
    run_ssh "${vm_ip}" "sudo systemctl restart NetworkManager"

    echo "Loading mac80211_hwsim module with 3 radios..."
    run_ssh "${vm_ip}" "sudo modprobe mac80211_hwsim radios=3" || echo "WARN: Failed to load mac80211_hwsim"

    local wifi_count
    wifi_count=$(run_ssh "${vm_ip}" "nmcli -t -f TYPE device | grep -c wifi || echo 0")
    if [[ "${wifi_count}" -lt 3 ]]; then
        echo "WARN: Expected 3 WiFi interfaces but found ${wifi_count}"
    else
        echo "WiFi simulation ready: ${wifi_count} interfaces detected by NetworkManager"
    fi

    echo "Configuring mac80211_hwsim to load on boot..."
    run_ssh "${vm_ip}" "echo mac80211_hwsim | sudo tee /etc/modules-load.d/mac80211_hwsim.conf > /dev/null"
    run_ssh "${vm_ip}" "echo 'options mac80211_hwsim radios=3' | sudo tee /etc/modprobe.d/mac80211_hwsim.conf > /dev/null"

    echo "Installing RPM build dependencies..."
    run_ssh "${vm_ip}" "sudo dnf install -y make rpm-build nodejs npm gettext libappstream-glib"

    echo "Building and installing cockpit-system-onboarding RPM..."
    local tarball
    tarball=$(ls "${PROJECT_DIR}"/cockpit-system-onboarding-*.tar.xz 2>/dev/null | head -1)
    local node_cache
    node_cache=$(ls "${PROJECT_DIR}"/cockpit-system-onboarding-node-*.tar.xz 2>/dev/null | head -1)
    local specfile="${PROJECT_DIR}/cockpit-system-onboarding.spec"

    if [[ -z "${tarball}" || -z "${node_cache}" || ! -f "${specfile}" ]]; then
        echo "Building RPM tarball and spec from source..."
        make -C "${PROJECT_DIR}" rpm
    fi

    local rpm_file
    rpm_file=$(ls "${PROJECT_DIR}"/cockpit-system-onboarding-*.noarch.rpm 2>/dev/null | head -1)
    if [[ -z "${rpm_file}" ]]; then
        echo "ERROR: RPM build failed - no .rpm file found" >&2
        exit 1
    fi

    echo "Copying RPM to VM..."
    scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        "${rpm_file}" "fedora@${vm_ip}:/tmp/"

    local rpm_basename
    rpm_basename=$(basename "${rpm_file}")
    echo "Installing RPM on VM..."
    run_ssh "${vm_ip}" "sudo dnf install -y /tmp/${rpm_basename}"

    echo "Enabling and starting cockpit and onboarding setup..."
    run_ssh "${vm_ip}" "sudo systemctl enable --now cockpit.socket"
    run_ssh "${vm_ip}" "sudo systemctl enable --now cockpit-system-onboarding-setup.service"

    # Wait for the onboarding setup service to claim its WiFi interface
    echo "Waiting for onboarding AP to start..."
    local ap_attempts=0
    while [[ ${ap_attempts} -lt 15 ]]; do
        if run_ssh "${vm_ip}" "systemctl is-active cockpit-system-onboarding-wifi-ap@*.service 2>/dev/null | grep -q active" 2>/dev/null; then
            echo "Onboarding AP is running"
            break
        fi
        sleep 2
        ap_attempts=$((ap_attempts + 1))
    done

    setup_infra_wifi "${vm_ip}"
}

setup_infra_wifi() {
    local vm_ip="$1"

    echo "Setting up infrastructure WiFi AP with NAT (namespaced)..."

    # Install iptables if not present (needed for NAT)
    run_ssh "${vm_ip}" "sudo dnf install -y iptables-nft 2>/dev/null || true"

    # Enable IP forwarding persistently
    run_ssh "${vm_ip}" "echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-infra-ap-forward.conf > /dev/null && sudo sysctl -p /etc/sysctl.d/99-infra-ap-forward.conf"

    # The AP phy must be in a separate network namespace from the client.
    # Without this, the kernel's local routing table intercepts unicast
    # traffic between co-located interfaces and ARP/ping never works.

    # Write the setup script — discovers interface and phy dynamically at boot
    run_ssh "${vm_ip}" "sudo tee /usr/local/bin/test-infra-wifi-setup.sh > /dev/null && sudo chmod +x /usr/local/bin/test-infra-wifi-setup.sh" <<'SETUP_EOF'
#!/bin/bash
set -euo pipefail

NS="wifi_ap"
SUBNET="10.43.0"
VETH_SUBNET="10.43.1"

# Clean up any leftover state from a previous run
ip link delete veth-host 2>/dev/null || true
ip netns delete "${NS}" 2>/dev/null || true

# Find the first managed WiFi interface (onboarding claims one and marks it unmanaged)
IFACE=$(nmcli -t -f DEVICE,TYPE,STATE device | grep ':wifi:' | grep -v ':unmanaged' | grep -v 'p2p' | head -n 1 | cut -d: -f1)
if [[ -z "${IFACE}" ]]; then
    echo "ERROR: No available WiFi interface for infrastructure AP" >&2
    exit 1
fi

PHY=$(cat /sys/class/net/${IFACE}/phy80211/name)
echo "Using ${IFACE} (${PHY}) for infrastructure AP"
echo "${IFACE}" > /run/test-infra-wifi-iface

nmcli device disconnect "${IFACE}" 2>/dev/null || true
nmcli device set "${IFACE}" managed no 2>/dev/null || true
sleep 1

# Move the phy into a dedicated namespace
ip netns add "${NS}"
iw phy "${PHY}" set netns name "${NS}"

ip netns exec "${NS}" ip link set lo up
ip netns exec "${NS}" ip link set "${IFACE}" up
ip netns exec "${NS}" ip addr add ${SUBNET}.1/24 dev "${IFACE}"

# Generate hostapd config and start it inside the namespace
cat > /run/test-infra-wifi-hostapd.conf <<HAPD
interface=${IFACE}
driver=nl80211
ssid=test-infra-wifi
hw_mode=g
channel=1
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ieee80211n=1
HAPD

ip netns exec "${NS}" hostapd -B /run/test-infra-wifi-hostapd.conf -P /run/test-infra-wifi-hostapd.pid
sleep 1

ip netns exec "${NS}" dnsmasq \
    --listen-address=${SUBNET}.1 \
    --bind-interfaces \
    --no-resolv \
    --no-hosts \
    --dhcp-range=${SUBNET}.10,${SUBNET}.50,255.255.255.0,1h \
    --dhcp-option=3,${SUBNET}.1 \
    --dhcp-option=6,${SUBNET}.1 \
    --server=8.8.8.8 \
    --server=8.8.4.4 \
    --pid-file=/run/test-infra-wifi-dnsmasq.pid

# Bridge namespace to host via a veth pair so NAT can reach enp1s0
ip link add veth-host type veth peer name veth-ap
ip link set veth-ap netns "${NS}"

ip addr add ${VETH_SUBNET}.1/30 dev veth-host
ip link set veth-host up

ip netns exec "${NS}" ip addr add ${VETH_SUBNET}.2/30 dev veth-ap
ip netns exec "${NS}" ip link set veth-ap up
ip netns exec "${NS}" ip route add default via ${VETH_SUBNET}.1
ip netns exec "${NS}" sysctl -w net.ipv4.ip_forward=1

# NAT inside namespace: WiFi clients -> veth
ip netns exec "${NS}" iptables -t nat -A POSTROUTING -s ${SUBNET}.0/24 -o veth-ap -j MASQUERADE
ip netns exec "${NS}" iptables -A FORWARD -i "${IFACE}" -o veth-ap -j ACCEPT
ip netns exec "${NS}" iptables -A FORWARD -i veth-ap -o "${IFACE}" -m state --state RELATED,ESTABLISHED -j ACCEPT

# NAT on host: veth subnet -> enp1s0
iptables -t nat -A POSTROUTING -s ${VETH_SUBNET}.0/30 -o enp1s0 -j MASQUERADE
iptables -A FORWARD -i veth-host -o enp1s0 -j ACCEPT
iptables -A FORWARD -i enp1s0 -o veth-host -m state --state RELATED,ESTABLISHED -j ACCEPT

echo "Infrastructure AP started: SSID=test-infra-wifi on ${IFACE} in namespace ${NS}"
SETUP_EOF

    # Write the teardown script
    run_ssh "${vm_ip}" "sudo tee /usr/local/bin/test-infra-wifi-teardown.sh > /dev/null && sudo chmod +x /usr/local/bin/test-infra-wifi-teardown.sh" <<'TEARDOWN_EOF'
#!/bin/bash

NS="wifi_ap"
VETH_SUBNET="10.43.1"
IFACE=$(cat /run/test-infra-wifi-iface 2>/dev/null || echo "")

iptables -t nat -D POSTROUTING -s ${VETH_SUBNET}.0/30 -o enp1s0 -j MASQUERADE 2>/dev/null || true
iptables -D FORWARD -i veth-host -o enp1s0 -j ACCEPT 2>/dev/null || true
iptables -D FORWARD -i enp1s0 -o veth-host -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true

ip link delete veth-host 2>/dev/null || true

ip netns pids "${NS}" 2>/dev/null | xargs -r kill 2>/dev/null || true
sleep 1
ip netns delete "${NS}" 2>/dev/null || true

rm -f /run/test-infra-wifi-hostapd.conf /run/test-infra-wifi-hostapd.pid \
      /run/test-infra-wifi-dnsmasq.pid /run/test-infra-wifi-iface

if [[ -n "${IFACE}" ]]; then
    sleep 1
    nmcli device set "${IFACE}" managed yes 2>/dev/null || true
fi

echo "Infrastructure AP stopped"
TEARDOWN_EOF

    # Create systemd service that delegates to the setup/teardown scripts
    run_ssh "${vm_ip}" "sudo tee /etc/systemd/system/test-infra-wifi-ap.service > /dev/null" <<'UNIT_EOF'
[Unit]
Description=Test Infrastructure WiFi AP with NAT (namespaced)
After=network-online.target cockpit-system-onboarding-setup.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/test-infra-wifi-setup.sh
ExecStop=/usr/local/bin/test-infra-wifi-teardown.sh

[Install]
WantedBy=multi-user.target
UNIT_EOF

    run_ssh "${vm_ip}" "sudo systemctl daemon-reload && sudo systemctl enable --now test-infra-wifi-ap.service"

    local infra_status
    infra_status=$(run_ssh "${vm_ip}" "systemctl is-active test-infra-wifi-ap.service")
    if [[ "${infra_status}" == "active" ]]; then
        echo "Infrastructure AP running (SSID: test-infra-wifi, subnet: 10.43.0.0/24, namespaced)"
    else
        echo "WARN: Infrastructure AP failed to start"
        run_ssh "${vm_ip}" "journalctl -u test-infra-wifi-ap.service --no-pager -n 30"
    fi

    local free_iface
    free_iface=$(run_ssh "${vm_ip}" "nmcli -t -f DEVICE,TYPE,STATE device | grep ':wifi:' | grep -v ':unmanaged' | grep -v 'p2p' | head -n 1 | cut -d: -f1")
    echo "Free WiFi interface available for testing: ${free_iface:-none}"
}

check_existing_vm() {
    if virsh dominfo "${VM_NAME}" &>/dev/null; then
        echo "ERROR: VM ${VM_NAME} already exists. Run 'make clean-test-vm' first." >&2
        exit 1
    fi
}

main() {
    check_existing_vm
    find_ssh_pubkey > /dev/null
    download_image
    create_cloud_init_iso
    create_vm_disk
    create_vm

    local vm_ip
    vm_ip=$(wait_for_vm_ip)
    wait_for_ssh "${vm_ip}"
    provision_vm "${vm_ip}"

    # Gather WiFi interface info for summary
    local onboarding_iface infra_iface free_iface onboarding_ssid
    infra_iface=$(run_ssh "${vm_ip}" "cat /run/test-infra-wifi-iface 2>/dev/null" 2>/dev/null || true)
    onboarding_iface=$(run_ssh "${vm_ip}" "ls /run/cockpit-system-onboarding/hostapd-*.conf 2>/dev/null | head -1 | sed 's|.*/hostapd-||;s|\.conf||'" 2>/dev/null || true)
    onboarding_ssid=$(run_ssh "${vm_ip}" "grep '^ssid=' /run/cockpit-system-onboarding/hostapd-*.conf 2>/dev/null | head -1 | cut -d= -f2" 2>/dev/null || true)
    free_iface=$(run_ssh "${vm_ip}" "nmcli -t -f DEVICE,TYPE,STATE device | grep ':wifi:' | grep -v ':unmanaged' | grep -v 'p2p' | head -n 1 | cut -d: -f1" 2>/dev/null || true)

    echo ""
    echo "========================================="
    echo "  VM is ready!"
    echo "========================================="
    echo "  Name:    ${VM_NAME}"
    echo "  IP:      ${vm_ip}"
    echo "  SSH:     ssh fedora@${vm_ip}"
    echo "  Cockpit: https://${vm_ip}:9090"
    echo ""
    echo "  Development:"
    echo "    RSYNC=fedora@${vm_ip} make watch"
    echo ""
    echo "  WiFi Interfaces:"
    echo "    ${onboarding_iface:-wlan0}  Onboarding AP (SSID: ${onboarding_ssid:-cockpit-*})"
    echo "    ${infra_iface:-wlan1}  Infra AP with NAT (SSID: test-infra-wifi, 10.43.0.0/24)"
    echo "    ${free_iface:-wlan2}  Free client interface"
    echo ""
    echo "  USB WiFi Passthrough:"
    echo "    To test with a physical WiFi adapter, plug a USB WiFi dongle"
    echo "    into the host and attach it to the VM:"
    echo ""
    echo "      # Find the adapter's vendor:product ID"
    echo "      lsusb | grep -i wireless  # or grep for the chipset (realtek, etc.)"
    echo ""
    echo "      # Attach to the VM (detaches from host)"
    echo "      virsh attach-device ${VM_NAME} --live /dev/stdin <<EOF"
    echo "      <hostdev mode='subsystem' type='usb' managed='yes'>"
    echo "        <source>"
    echo "          <vendor id='0xVENDOR'/>"
    echo "          <product id='0xPRODUCT'/>"
    echo "        </source>"
    echo "      </hostdev>"
    echo "      EOF"
    echo ""
    echo "      # Reload the driver inside the VM to pick up firmware"
    echo "      ssh fedora@${vm_ip} 'sudo modprobe -r <driver> && sudo modprobe <driver>'"
    echo ""
    echo "  Clean up with: make clean-test-vm"
    echo "========================================="
}

main
