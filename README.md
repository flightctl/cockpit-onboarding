# Cockpit System Onboarding

[![License](https://img.shields.io/badge/License-LGPL%202.1-blue.svg)](https://opensource.org/licenses/LGPL-2.1)

A [Cockpit](https://cockpit-project.org/) module that provides a guided setup wizard for headless Linux devices.

> [!NOTE]
> This is an experimental project. Use at your own risk — no maintenance or support is guaranteed.

## Overview

Headless devices — servers, edge nodes, embedded systems — often lack displays, keyboards, and pre-configured network access. Before they can onboard into management services like [Red Hat Insights](https://www.redhat.com/en/technologies/management/insights) or [Flight Control](https://flightctl.io/), they need network connectivity and credentials. The Cockpit System Onboarding plugin bridges that gap.

Cockpit System Onboarding runs inside [Cockpit](https://cockpit-project.org/) on the device. You connect to it from a web browser on a remote machine and are presented with a step-by-step wizard that walks you through initial device setup. By default, the service disables itself once onboarding completes and is then inert.

### Features

- **Hostname configuration** — set the system hostname
- **Network interface selection** — choose the onboarding network interface
- **Network addressing** — configure IPv4/IPv6 addresses and DNS
- **Network services** — set NTP server and network proxy
- **Enrollment** — enroll into [Red Hat Insights](https://www.redhat.com/en/technologies/management/insights) or [Flight Control](https://github.com/flightctl/flightctl) via pluggable scripts
- **WiFi AP provisioning** — optionally expose a temporary WiFi access point for initial connectivity
- **Self-disabling** — once onboarding completes, the wizard and its services become inert

## Installing

### On RPM-based distributions

1. Install the latest RPM directly from [GitHub Releases](https://github.com/fzdarsky/cockpit-system-onboarding/releases):

    ```sh
    VERSION=$(curl -s https://api.github.com/repos/fzdarsky/cockpit-system-onboarding/releases/latest | jq -r .tag_name)
    sudo dnf install -y "https://github.com/fzdarsky/cockpit-system-onboarding/releases/download/${VERSION}/cockpit-system-onboarding-${VERSION#v}-1.$(uname -m).rpm"
    ```

2. Enable the onboarding setup service:

    ```sh
    sudo systemctl enable --now cockpit-system-onboarding-setup.service
    ```

3. If provisioning over WiFi, install the additional dependencies:

    ```sh
    sudo dnf install -y hostapd dnsmasq
    ```

4. Access the wizard at `https://<device-ip>:9090` in your browser. Log in as user `onboarding` without password.

### From source

See [DEVELOPERS.md](DEVELOPERS.md) for build instructions and development setup.

## How It Works

On first boot the setup service creates a temporary `onboarding` user, optionally starts a WiFi access point, and enables the Cockpit web console. The operator connects to Cockpit, steps through the wizard pages (hostname, network, enrollment), and clicks "Apply". Once complete, the cleanup script removes the temporary user, tears down the WiFi AP, and marks onboarding as finished — the service will not run again.

Enrollment is handled by drop-in shell scripts in `/usr/share/cockpit/system-onboarding/system-onboarding.d/`. The package ships example scripts for Flight Control and Red Hat Insights; add your own to support other management platforms.

## License

LGPL 2.1 — see [LICENSE](LICENSE).
