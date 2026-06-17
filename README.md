# Cockpit System Onboarding

[![License](https://img.shields.io/badge/License-LGPL%202.1-blue.svg)](https://opensource.org/licenses/LGPL-2.1)

A [Cockpit](https://cockpit-project.org/) module that provides a guided setup wizard for headless Linux devices.

## Overview

Headless devices — servers, edge nodes, embedded systems — often lack displays, keyboards, and pre-configured network access. Before they can onboard into management services like [Flight Control](https://flightctl.io/), they need network connectivity and credentials. The Cockpit System Onboarding plugin bridges that gap.

Cockpit System Onboarding runs inside [Cockpit](https://cockpit-project.org/) on the device. You connect to it from a web browser on a remote machine and are presented with a step-by-step wizard that walks you through initial device setup. By default, the service disables itself once onboarding completes and is then inert.

### Features

- **Hostname configuration** — set the system hostname
- **Network interface selection** — choose the onboarding network interface
- **Network addressing** — configure IPv4/IPv6 addresses and DNS
- **Network services** — set NTP server and network proxy
- **Enrollment** — enroll into [Flight Control](https://github.com/flightctl/flightctl) via pluggable scripts
- **WiFi AP provisioning** — optionally expose a temporary WiFi access point for initial connectivity
- **Self-disabling** — once onboarding completes, the wizard and its services become inert

## Installing

### Building the RPM

```sh
make rpm
```

This produces `cockpit-system-onboarding-*.noarch.rpm` in the repository root. Install it on the target device:

```sh
sudo dnf install -y ./cockpit-system-onboarding-*.rpm
sudo systemctl enable --now cockpit-system-onboarding-setup.service
```

If provisioning over WiFi, install the additional dependencies:

```sh
sudo dnf install -y hostapd dnsmasq
```

Access the wizard at `https://<device-ip>:9090` in your browser. Log in as user `onboarding` without password.

### From source

See [DEVELOPERS.md](DEVELOPERS.md) for build instructions and development setup.

## How It Works

On first boot the setup service creates a temporary `onboarding` user, optionally starts a WiFi access point, and enables the Cockpit web console. The operator connects to Cockpit, steps through the wizard pages (hostname, network, enrollment), and clicks "Apply". Once complete, the cleanup script removes the temporary user, tears down the WiFi AP, and marks onboarding as finished — the service will not run again.

Enrollment is handled by drop-in shell scripts in `/usr/share/cockpit/system-onboarding/system-onboarding.d/`. The package ships an example script for Flight Control; add your own to support other management platforms.

## Testing WiFi Interfaces

The `mac80211_hwsim` kernel module creates virtual WiFi radios that NetworkManager recognizes as proper `wifi` devices. This requires several userspace packages that are not included in minimal/cloud images:

```sh
sudo dnf install -y kernel-modules-internal kernel-modules-extra \
    NetworkManager-wifi wpa_supplicant iw wireless-regdb hostapd
sudo systemctl restart NetworkManager
sudo modprobe mac80211_hwsim radios=2
```

After loading, `nmcli -t -f DEVICE,TYPE device` should show `wlan0:wifi` and `wlan1:wifi`. The onboarding setup service will detect these and start a WiFi AP on the first one.

> [!NOTE]
> The `kernel-modules-internal` package must match the running kernel version. If installing on a fresh cloud image, run `sudo dnf update -y` and reboot before installing the module packages.

### Enabling internet connectivity through virtual WiFi

The virtual radios can only communicate with each other — they have no access to real RF hardware. Unicast IP traffic between interfaces on the same host is intercepted by the kernel's local routing table before reaching the wireless stack. To make AP-to-client connectivity work, the AP's phy must be placed in a **separate network namespace**:

```sh
# Move the AP phy into its own namespace
ip netns add wifi_ap
iw phy phy1 set netns name wifi_ap

# Configure inside the namespace
ip netns exec wifi_ap ip link set lo up
ip netns exec wifi_ap ip link set wlan1 up
ip netns exec wifi_ap ip addr add 10.43.0.1/24 dev wlan1
ip netns exec wifi_ap hostapd -B /path/to/hostapd.conf

# Bridge namespace to host via veth pair for NAT
ip link add veth-host type veth peer name veth-ap
ip link set veth-ap netns wifi_ap
ip addr add 10.43.1.1/30 dev veth-host && ip link set veth-host up
ip netns exec wifi_ap ip addr add 10.43.1.2/30 dev veth-ap
ip netns exec wifi_ap ip link set veth-ap up
ip netns exec wifi_ap ip route add default via 10.43.1.1

# NAT chain: WiFi clients -> namespace veth -> host -> internet
ip netns exec wifi_ap iptables -t nat -A POSTROUTING -s 10.43.0.0/24 -o veth-ap -j MASQUERADE
iptables -t nat -A POSTROUTING -s 10.43.1.0/30 -o enp1s0 -j MASQUERADE
```

The `make deploy-test-vm` target sets this up automatically. It creates a namespaced infrastructure AP (SSID: `test-infra-wifi`) with full NAT so that clients connected to it can reach the internet.

### USB WiFi passthrough

To test with a physical WiFi adapter instead of virtual radios, plug a USB WiFi dongle into the host and pass it through to the VM using libvirt USB passthrough:

```sh
# Find the adapter's vendor:product ID on the host
lsusb | grep -i wireless   # e.g. "0bda:c811 Realtek Semiconductor Corp. 802.11ac NIC"

# Attach to the VM (this detaches it from the host)
virsh attach-device cockpit-onboarding-test --live /dev/stdin <<EOF
<hostdev mode='subsystem' type='usb' managed='yes'>
  <source>
    <vendor id='0x0bda'/>
    <product id='0xc811'/>
  </source>
</hostdev>
EOF

# If the adapter doesn't appear as a WiFi interface, reload its driver
# inside the VM so it picks up the installed firmware
ssh fedora@<vm-ip> 'sudo dmesg | tail -20'          # check for firmware errors
ssh fedora@<vm-ip> 'sudo modprobe -r rtw88_8821cu && sudo modprobe rtw88_8821cu'
```

The adapter will appear as a new WiFi interface (e.g. `wlp3s0u1`) alongside the virtual radios. `linux-firmware` is pre-installed in the test VM, which provides firmware for most common USB WiFi chipsets.

To detach the adapter and return it to the host:

```sh
virsh detach-device cockpit-onboarding-test --live /dev/stdin <<EOF
<hostdev mode='subsystem' type='usb' managed='yes'>
  <source>
    <vendor id='0x0bda'/>
    <product id='0xc811'/>
  </source>
</hostdev>
EOF
```

## Testing VLAN Interfaces

The wizard supports creating VLAN-tagged network profiles. To verify this end-to-end, the test scripts set up an isolated VLAN trunk between the host and the VM.

### Architecture

```
  Host                                          VM
  ────                                          ──
  br-vlantest (bridge, vlan_filtering=1)  ←→  enp8s0 (raw trunk)
    └─ br-vlantest.100 (VLAN 100)               └─ enp8s0.100 (VLAN 100)
       10.100.0.1/24                                10.100.0.2/24
```

The host bridge carries tagged VLAN 100 frames. The VM sees a raw trunk port (`enp8s0`) and must create the VLAN subinterface — exactly what the wizard does.

For internet access from the VLAN subnet, the setup script runs:
- A standalone **nftables** table (`vlan_nat`) to masquerade 10.100.0.0/24 traffic. Raw `iptables` rules don't survive firewalld zone changes on Fedora, so a separate nftables table is used instead.
- **firewalld direct rules** to allow forwarding through `br-vlantest.100`
- **dnsmasq** on 10.100.0.1 as a DNS forwarder, since external DNS servers (e.g. 8.8.8.8) are typically unreachable directly over the VLAN

### Setup and teardown

```sh
# Prerequisites: test VM running, dnsmasq installed on host
sudo dnf install -y dnsmasq

# Create VLAN bridge, attach NIC, configure NAT, start DNS forwarder
hack/test-vlan-setup.sh

# Teardown (stops dnsmasq, removes NAT, detaches NIC, deletes bridge)
hack/test-vlan-teardown.sh
```

### Wizard configuration

In the wizard, select the new NIC (`enp8s0`), enable VLAN, and configure:

| Field   | Value         |
|---------|---------------|
| VLAN ID | 100           |
| IPv4    | Static        |
| Address | 10.100.0.2    |
| Netmask | 255.255.255.0 |
| Gateway | 10.100.0.1    |
| DNS     | 10.100.0.1    |

**Negative tests:** Using VLAN 101 (not trunked) or no VLAN (no DHCP on the raw bridge) should both fail at the connectivity test.

### Resetting between tests

```sh
hack/test-vm-reset.sh [vm-ip]
```

Removes all onboarding profiles, cleans up VLAN subinterfaces, clears completion markers, and restarts Cockpit.

## Captive Portal Detection

The WiFi AP includes a captive portal handler on port 80 that works with the wildcard DNS (`address=/#/<AP_IP>`) to trigger the native sign-in prompt on client devices. Each OS uses a different detection mechanism:

| OS | Probe URL | Expected behavior |
|----|-----------|-------------------|
| Windows | `http://www.msftconnecttest.com/connecttest.txt` | Wildcard DNS redirects lookup to AP; 302 response triggers captive portal popup |
| Apple (iOS/macOS) | `http://captive.apple.com/hotspot-detect.html` | 302 redirect to device-info page triggers Captive Network Assistant sheet |
| Android | `http://connectivitycheck.gstatic.com/generate_204` | 302 response triggers sign-in notification |
| Linux (GNOME/NM) | `http://fedoraproject.org/static/hotspot.txt` (Fedora) | NM checks for `OK` response; wildcard DNS must intercept the lookup |

### VPN and competing DNS

Captive portal detection depends on the AP's wildcard DNS intercepting the connectivity check URL. When a VPN or another network interface forces DNS through a different server, the check URL resolves to its real IP address, bypassing the AP's wildcard DNS entirely. The client either reaches the real server (reporting full connectivity) or fails to connect (reporting no internet) — neither triggers the captive portal prompt.

Disconnecting the VPN before connecting to the AP resolves this.

## Security Considerations

### Proxy credential handling

When a proxy with authentication is configured, credentials are stored in two places:

- **Systemd drop-in** (`/etc/systemd/system.conf.d/50-cockpit-onboarding-proxy.conf`) — contains the full proxy URL including credentials. This file is mode `0600` (root-only) and is the authoritative source for systemd services (including `flightctl-agent`).

- **`/etc/environment`** — contains the proxy URL **without credentials**. This file must be world-readable (mode `0644`) because `pam_env.so` reads it during login for all users. To prevent credential leakage to non-root users, only the host and port are written here. Interactive tools that need authenticated proxy access must run as root or obtain credentials through other means.

This separation is intentional: the full credentialed URL is only stored in root-owned, root-readable files. The world-readable `/etc/environment` provides proxy discovery (where the proxy is) without exposing authentication details.

## License

LGPL 2.1 — see [LICENSE](LICENSE).
