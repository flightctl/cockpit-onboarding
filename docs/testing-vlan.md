# Testing VLAN Interfaces

The wizard supports creating VLAN-tagged network profiles. To verify this end-to-end, the test scripts set up an isolated VLAN trunk between the host and the VM.

## Architecture

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

## Setup and teardown

```sh
# Prerequisites: test VM running, dnsmasq installed on host
sudo dnf install -y dnsmasq

# Create VLAN bridge, attach NIC, configure NAT, start DNS forwarder
hack/test-vlan-setup.sh

# Teardown (stops dnsmasq, removes NAT, detaches NIC, deletes bridge)
hack/test-vlan-teardown.sh
```

## Wizard configuration

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

## Resetting between tests

```sh
hack/test-vm-reset.sh [vm-ip]
```

Removes all onboarding profiles, cleans up VLAN subinterfaces, clears completion markers, and restarts Cockpit.
