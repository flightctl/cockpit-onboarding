# Flightctl Onboarding

[![License](https://img.shields.io/badge/License-LGPL%202.1-blue.svg)](https://opensource.org/licenses/LGPL-2.1)

A [Cockpit](https://cockpit-project.org/) module that provides a guided setup wizard for headless Linux devices.

## Overview

Headless devices — servers, edge nodes, embedded systems — often lack displays, keyboards, and pre-configured network access. Before they can onboard into management services like [Flight Control](https://flightctl.io/), they need network connectivity and credentials. The Flightctl Onboarding plugin bridges that gap.

Flightctl Onboarding runs inside [Cockpit](https://cockpit-project.org/) on the device. You connect to it from a web browser on a remote machine and are presented with a step-by-step wizard that walks you through initial device setup. By default, the service disables itself once onboarding completes and is then inert.

### Features

- **Hostname configuration** — set the system hostname
- **Device labels** — assign key/value labels for Flight Control fleet management
- **Network interface selection** — choose ethernet or WiFi, with VLAN support
- **Network addressing** — configure IPv4/IPv6 addresses, DNS, with inline validation and duplicate IP detection
- **Network services** — set NTP servers and HTTP proxy (with credential support)
- **Enrollment** — enroll into [Flight Control](https://github.com/flightctl/flightctl) with token or username/password authentication
- **WiFi AP provisioning** — optionally expose a temporary WiFi access point with captive portal for initial connectivity
- **Self-disabling** — once onboarding completes, the wizard and its services become inert

## Installing

### Building the RPM

```sh
make rpm
```

When building the RPM, you can specify the brand name shown in the enrollment UI:

```sh
BRAND_NAME="My Brand" NODE_ENV=production make rpm
```

The default brand name is `Flight Control`. The value is baked into the shipped `config.json` as `brandName` and used for enrollment service labels. Runtime overrides via `/etc/cockpit/system-onboarding/config.json` can still change the brand name if needed.

This produces `flightctl-onboarding-*.noarch.rpm` in the repository root. Install it on the target device:

```sh
sudo dnf install -y ./flightctl-onboarding-*.rpm
sudo systemctl enable --now flightctl-onboarding-setup.service
```

If provisioning over WiFi, install the additional dependencies:

```sh
sudo dnf install -y hostapd dnsmasq
```

### From source

See [DEVELOPERS.md](DEVELOPERS.md) for build instructions and development setup.

## Connecting to the Device

There are three ways to reach the onboarding wizard, depending on your setup.

### WiFi access point

If `hostapd` and `dnsmasq` are installed and WiFi is enabled in the config, the device creates a temporary WiFi access point on first boot.

- **SSID**: `flightctl-<suffix>` where `<suffix>` is the last 8 characters of the device's DMI serial number (or last 6 hex digits of the WiFi MAC address if serial is unavailable)
- **Password**: configured via `network.wifiAp.password` in `config.json` (default: `onboarding`). Set to empty string for an open network.
- **Captive portal**: after connecting, most devices will automatically open a sign-in page that redirects to the wizard. If the captive portal prompt does not appear, open `http://10.42.0.1:9090` manually.

Log in as user `onboarding` (no password by default, or the password set in `onboardingUser.password`).

### Ethernet (static IP)

If Ethernet is enabled in the config, the device creates a temporary NetworkManager connection with a static IP on the first available Ethernet interface.

1. Connect your laptop directly to the device's Ethernet port (or through a switch on the same L2 segment)
2. Configure your laptop with a static IP on the same subnet — e.g. `192.168.100.2/24` if using the default
3. Open `http://192.168.100.1:9090` in your browser (the device's default static IP)
4. Log in as user `onboarding`

If `dnsmasq` is installed, the device also runs a DHCP server on the setup interface, so you can skip step 2 and use DHCP instead.

The static IP, subnet prefix, and DHCP range are all configurable — see [Configuration](#configuration) below.

### Local console

If you have a keyboard and monitor connected to the device, open `http://localhost:9090` in a browser and log in as `onboarding`.

## How It Works

On first boot the setup service creates a temporary `onboarding` user, optionally starts a WiFi access point, and enables the Cockpit web console. The operator connects to Cockpit, steps through the wizard pages (network, network services, enrollment, device labels, review), and clicks "Apply".

The wizard supports two operational flows depending on network topology — see [AGENTS.md](AGENTS.md) for a detailed description of each:

- **Inline (multi-NIC)**: the operator connects via one interface and configures a different one. All apply steps run in the browser session. On success, the operator clicks "Finish" to trigger cleanup.
- **Single-NIC (background delegation)**: the operator connects and configures the same interface. The wizard delegates network activation, enrollment, and cleanup to a `systemd-run` transient unit that survives the browser disconnect.

Once complete, the cleanup script removes the temporary user, tears down the WiFi AP, and marks onboarding as finished — the service will not run again.

Enrollment is handled by drop-in shell scripts in `/usr/share/cockpit/system-onboarding/system-onboarding.d/`. The package ships a script for Flight Control; add your own to support other management platforms.

## Configuration

The plugin reads configuration from JSON files at two paths:

| Priority | Path | Purpose |
|----------|------|---------|
| 1 (highest) | `/etc/cockpit/system-onboarding/config.json` | Operator override — survives package upgrades |
| 2 | `/usr/share/cockpit/system-onboarding/config.json` | Package default — shipped with the RPM |

The override file does not need to contain all keys — only the values you want to change. Unset keys fall back to the package default.

### Configuration reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `version` | string | `"1.0"` | Config schema version |
| `brandName` | string | `"Flight Control"` | Brand name shown in the enrollment UI and used for service labels |
| `runOnce` | bool | `true` | Disable the onboarding service after completion |
| `keepCockpit` | bool | `false` | Keep Cockpit running post-onboarding (expires the onboarding user's password instead of deleting the user) |
| `hideModules` | bool | `true` | Hide other Cockpit modules during onboarding |
| `autoReboot` | bool | `false` | Reboot the device after onboarding completes |
| `network.wifiAp.enabled` | bool | `true` | Enable WiFi AP provisioning |
| `network.wifiAp.ssidPrefix` | string | `"flightctl-"` | SSID prefix; suffix is auto-generated from DMI serial or MAC |
| `network.wifiAp.interface` | string | `""` | WiFi interface for the AP; empty = auto-detect |
| `network.wifiAp.password` | string | `"onboarding"` | WPA2 password; empty = open network |
| `network.wifiAp.address` | string | `"10.42.0.1"` | AP IP address |
| `network.wifiAp.subnetPrefix` | int | `24` | AP subnet prefix length |
| `network.wifiAp.dhcpRangeSize` | int | `40` | Number of DHCP leases to offer |
| `network.wifiAp.channel` | int | `6` | WiFi channel |
| `network.ethernet.enabled` | bool | `true` | Enable Ethernet setup interface |
| `network.ethernet.interface` | string | `""` | Ethernet interface for onboarding; empty = auto-detect |
| `network.ethernet.staticIp` | string | `"192.168.100.1"` | Static IP for the onboarding Ethernet interface |
| `network.ethernet.subnetPrefix` | int | `24` | Ethernet subnet prefix length |
| `network.ethernet.dhcpRangeSize` | int | `40` | Number of DHCP leases (requires dnsmasq) |
| `flightctl.defaultEndpoint` | string | `""` | Pre-populated Flight Control server URL in the enrollment form |
| `connectivityTest.host` | string | `"cockpit-project.org"` | Host used for DNS/ping connectivity checks after network apply |
| `connectivityTest.required` | bool | `true` | Block enrollment until connectivity check passes |
| `connectivityTest.carrierTimeoutSeconds` | int | `300` | Seconds to wait for link carrier before giving up |
| `connectivityTest.connectivityRetries` | int | `30` | Number of connectivity check retries after carrier is up |
| `defaults.hostname` | string | `""` | Pre-populated hostname in the wizard |
| `defaults.proxy.enabled` | bool | `false` | Enable proxy by default in the wizard |
| `defaults.proxy.protocol` | string | `"http"` | Default proxy protocol (`http`, `https`, or `socks5`) |
| `defaults.proxy.applyForHttps` | bool | `false` | Also use the proxy for HTTPS traffic |
| `defaults.proxy.hostname` | string | `""` | Default proxy hostname |
| `defaults.proxy.port` | int | — | Default proxy port |
| `defaults.proxy.username` | string | `""` | Default proxy username |
| `defaults.proxy.password` | string | `""` | Default proxy password |
| `defaults.proxy.noProxy` | string | `""` | Comma-separated list of hosts to bypass the proxy |
| `defaults.labels.deviceLabels` | array | `[]` | Pre-populated device labels (`[{key, value}]`) |
| `defaults.labels.systemInfoMappings` | array | `[]` | Pre-populated system-info label mappings (`[{key, value}]`) |
| `defaults.alias.mode` | string | — | Default alias mode for the device |
| `defaults.alias.customValue` | string | `""` | Custom alias value when mode is custom |
| `onboardingUser.password` | string | `""` | Password for the `onboarding` Cockpit user; empty = passwordless login |
| `led.enabled` | bool | `false` | Enable LED state signaling during onboarding phases |
| `led.tool` | string | — | Path to the LED control tool; required when `led.enabled` is `true` |
| `led.states` | object | `{ready, in-progress, applying, success, error, off}` | Maps onboarding phases to LED state names passed to the tool |

### Example override

To change the setup Ethernet IP and pre-populate the Flight Control endpoint, create `/etc/cockpit/system-onboarding/config.json`:

```json
{
  "network": {
    "ethernet": {
      "staticIp": "10.0.0.1"
    }
  },
  "flightctl": {
    "defaultEndpoint": "https://api.flightctl.example.com:7443"
  }
}
```

## Captive Portal Detection

The WiFi AP includes a captive portal handler on port 80 that works with wildcard DNS (`address=/#/<AP_IP>`) to trigger the native sign-in prompt on client devices. Each OS uses a different detection mechanism:

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

- **Systemd drop-in** (`/etc/systemd/system.conf.d/50-flightctl-onboarding-proxy.conf`) — contains the full proxy URL including credentials. This file is mode `0600` (root-only) and is the authoritative source for systemd services (including `flightctl-agent`).

- **`/etc/environment`** — contains the proxy URL **without credentials**. This file must be world-readable (mode `0644`) because `pam_env.so` reads it during login for all users. To prevent credential leakage to non-root users, only the host and port are written here. Interactive tools that need authenticated proxy access must run as root or obtain credentials through other means.

This separation is intentional: the full credentialed URL is only stored in root-owned, root-readable files. The world-readable `/etc/environment` provides proxy discovery (where the proxy is) without exposing authentication details.

## Testing

For detailed test environment setup guides, see:

- [Testing WiFi Interfaces](docs/testing-wifi.md) — virtual radios, network namespaces, USB passthrough
- [Testing VLAN Interfaces](docs/testing-vlan.md) — VLAN trunk setup, wizard configuration, reset scripts

## Further Reading

Flight Control documentation (the management platform this plugin enrolls devices into):

- [Introduction & Concepts](https://github.com/flightctl/flightctl/blob/main/docs/user/introduction.md) — core concepts: devices, fleets, agents, labels
- [Enrolling Devices](https://github.com/flightctl/flightctl/blob/main/docs/user/using/managing-devices.md) — the enrollment workflow this plugin facilitates
- [Installing the Agent](https://github.com/flightctl/flightctl/blob/main/docs/user/installing/installing-agent.md) — agent `config.yaml` format and parameters
- [Agent Architecture](https://github.com/flightctl/flightctl/blob/main/docs/user/references/agent-architecture.md) — agent lifecycle states and enrollment flow
- [Certificate Architecture](https://github.com/flightctl/flightctl/blob/main/docs/user/references/certificate-architecture.md) — certificate chain of trust and file locations
- [Building OS Images](https://github.com/flightctl/flightctl/blob/main/docs/user/building/building-images.md) — early vs. late binding enrollment; embedding the agent in bootc images

## License

LGPL 2.1 — see [LICENSE](LICENSE).
