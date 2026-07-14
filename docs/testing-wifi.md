# Testing WiFi Interfaces

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

## Enabling internet connectivity through virtual WiFi

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

## USB WiFi passthrough

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
