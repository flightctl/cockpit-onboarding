# Browser Integration Tests

This project uses the [Cockpit test framework](https://github.com/cockpit-project/cockpit/tree/main/test) for browser integration tests. Tests run inside QEMU/KVM virtual machines managed by the `bots/` tooling (checked out via `make bots`).

## Prerequisites

Host packages (Fedora):

```sh
sudo dnf install qemu-kvm libvirt python3-libvirt python3-gssapi \
    python3-pil python3-aiohttp chromium-browser chromedriver
```

Node dependencies (run from repo root):

```sh
npm ci
```

## VM Images

Tests run against QEMU VMs built with `bots/image-customize`. Each image is a qcow2 under `test/images/`.

| Make target          | Image file                          | What it provides                                                                                   |
|----------------------|-------------------------------------|----------------------------------------------------------------------------------------------------|
| `make vm`            | `test/images/centos-9-stream`       | Base CentOS 9 Stream VM with Cockpit and the onboarding RPM installed. Used by `make check`.       |
| `make vm-agent`      | `test/images/$(TEST_OS)`            | Agent/onboarding VM with the pre-built RPM, flightctl agent/CLI from COPR, and on Fedora mac80211_hwsim (3 simulated radios), WiFi stack (hostapd, dnsmasq, wpa_supplicant), and chronyd. Used by `make check-integration`. |
| `make vm-services`   | `test/images/fedora-43-services`    | Fedora 43 VM with flightctl-services (API, DB, KV, PAM issuer) pre-pulled via podman. Provides a self-contained Flight Control backend for enrollment e2e tests. |
| `make vm-network-services` | `test/images/fedora-43-network-services` | Fedora 43 VM with Squid HTTP proxy and chrony NTP server. Used by network-services e2e tests. |

Build images before running tests — they are cached and only rebuilt when install scripts change.

## Running Tests

All commands below are run from the repo root. Always set `PYTHONUNBUFFERED=1` for real-time output.

### Quick start — nondestructive tests only

Nondestructive tests share a single VM and don't modify its state, so they're fast and safe to iterate on.

```sh
# Build the Fedora VM (one-time, ~5 min)
make vm-agent

# Run all nondestructive tests from a single file
PYTHONUNBUFFERED=1 TEST_OS=fedora-43 test/common/run-tests --nondestructive --test-glob 'check-network'

# Run a single test class
PYTHONUNBUFFERED=1 TEST_OS=fedora-43 test/common/run-tests --nondestructive --test-glob 'check-network' TestIPConfiguration

# Run a single test method
PYTHONUNBUFFERED=1 TEST_OS=fedora-43 test/common/run-tests --nondestructive --test-glob 'check-network' TestIPConfiguration.testIPv6Toggle
```

Individual tests are fast — each nondestructive test typically completes in 6–10 seconds, and a full file like `check-network` (14 tests) finishes in ~2 minutes. If a single test is taking minutes, there is likely an issue (VM boot hang, missing image, network timeout) that should be investigated rather than waited out.

### Full Fedora test suite (matches CI)

This is what the `Fedora integration tests` CI job runs. Requires all three Fedora VM images.

```sh
make vm-agent vm-services vm-network-services
PYTHONUNBUFFERED=1 make check-fedora
```

### CentOS test suite

Uses the base CentOS VM. Does not include WiFi or e2e tests.

```sh
make check
```

### Verbose and parallel options

```sh
# Verbose output
PYTHONUNBUFFERED=1 TEST_OS=fedora-43 RUN_TESTS_OPTIONS="-v" make check-fedora

# Run 2 tests in parallel (CI uses -j 2)
PYTHONUNBUFFERED=1 TEST_OS=fedora-43 RUN_TESTS_OPTIONS="-v -j 2" make check-fedora
```

## Test Files

Each `test/check-*` file contains one or more test classes. The table below shows which are nondestructive (safe to run in `--nondestructive` mode) and which require specific VM images.

| File                        | Test class                        | Nondestructive | VM image needed        | Notes                                        |
|-----------------------------|-----------------------------------|:--------------:|------------------------|----------------------------------------------|
| `check-network`             | `TestNetworkInterface`            | yes            | fedora-43              | Interface list, selection, VLAN              |
| `check-network`             | `TestSingleNic`                   | no             | fedora-43              | Single-NIC mode (adds/removes virtual NICs)  |
| `check-network`             | `TestIPConfiguration`             | yes            | fedora-43              | IPv4/IPv6 method switching, DNS, gateway     |
| `check-network`             | `TestWifi`                        | no             | fedora-43              | WiFi scan, connect, password (mac80211_hwsim)|
| `check-network`             | `TestDhcpHostname`                | no             | fedora-43              | DHCP option 12 hostname pre-population       |
| `check-review`              | `TestReview`                      | yes            | fedora-43              | Review page display and edit navigation      |
| `check-review`              | `TestReviewSingleNic`             | no             | fedora-43              | Review page in single-NIC mode               |
| `check-network-services`    | `TestNtp`                         | yes            | fedora-43              | NTP UI configuration                         |
| `check-network-services`    | `TestProxy`                       | yes            | fedora-43              | Proxy UI configuration                       |
| `check-enrollment`          | `TestEnrollment`                  | yes            | fedora-43              | Enrollment step UI                           |
| `check-labels`              | `TestHostname` / `TestAlias` / `TestCustomLabels` | yes | fedora-43       | Labels/hostname step UI                      |
| `check-apply`               | `TestApplyConfiguration`          | no             | fedora-43              | Full wizard apply (multi-NIC)                |
| `check-apply`               | `TestApplySingleNic` / `TestApplySingleNicRollback` | no | fedora-43     | Apply in single-NIC mode, rollback           |
| `check-watchdog`            | `TestWatchdog`                    | no             | fedora-43              | Watchdog timer configuration                 |
| `check-enrollment-e2e`      | `TestEnrollmentE2E` / `TestEnrollmentE2ESingleNic` | no | fedora-43 + fedora-43-services | Full enrollment against flightctl backend |
| `check-network-services-e2e`| `TestNtpE2E` / `TestProxyE2E`    | no             | fedora-43 + fedora-43-network-services | NTP/proxy applied and verified in NM  |
| `check-network-services-e2e`| `TestEnrollmentThroughProxyE2E`   | no             | fedora-43 + fedora-43-network-services + fedora-43-services | Enrollment through proxy |

## Test Architecture

- **`test/common/`** — Cockpit's shared test library (`testlib.py`, `run-tests`, etc.), checked out from upstream via `make bots`.
- **`test/wizard_navigation.py`** — Shared helpers for navigating the onboarding wizard (step advancement, button clicks, interface selection).
- **`test/vm.install`** — Base VM setup (Cockpit socket, firewall).
- **`test/vm-agent.install`** — Agent/onboarding VM: pre-built RPM, flightctl agent, and on Fedora mac80211_hwsim + infra AP scripts.
- **`test/vm-flightctl-services.install`** — Services VM: flightctl-services via COPR, DNS, PAM user, container pre-pull.
- **`test/vm-network-services.install`** — Network services VM: Squid proxy and chrony NTP server.
- **`test/browser/`** — CI entry point scripts for Testing Farm (TMT).

## Troubleshooting

- **"no chromium binary found"** — Install chromium: `sudo dnf install chromium-browser chromedriver`
- **VM boot hangs** — Check KVM access: `ls -la /dev/kvm`. Your user needs to be in the `kvm` group or the device needs mode 0666.
- **"image not found"** — Run the appropriate `make vm-*` target to build the image first.
- **Stale VM image** — Delete `test/images/<image-name>*` and rebuild to pick up install script changes.
- **No output during test run** — Always set `PYTHONUNBUFFERED=1` in your environment.
