# Research: Cockpit System Onboarding Plugin

**Date**: 2025-10-27
**Feature**: System Onboarding Plugin
**Purpose**: Resolve technical unknowns and establish implementation patterns

## 1. Unit Testing Framework for React + TypeScript (Cockpit)

### Decision: Jest + React Testing Library
**Status**: Recommended pattern for Cockpit modules

**Rationale**:
- Jest is the de facto standard for React testing
- React Testing Library encourages testing user behavior over implementation details
- TypeScript support is mature and well-documented
- Can be integrated with existing Cockpit build system

**Implementation Approach**:
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "ts-jest": "^29.1.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

**Jest Configuration** (`jest.config.js`):
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '\\.(css|scss)$': 'identity-obj-proxy',
    '^cockpit$': '<rootDir>/test/__mocks__/cockpit.ts'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true
      }
    }]
  }
};
```

**Mock Cockpit API** (`test/__mocks__/cockpit.ts`):
- Mock `cockpit.dbus()` for DBUS calls
- Mock `cockpit.spawn()` for command execution
- Mock `cockpit.file()` for file operations
- Mock `cockpit.gettext()` for internationalization

**Alternatives Considered**:
- Vitest: Modern and fast, but less ecosystem maturity
- Rejected because Jest has better TypeScript support and more examples in Cockpit community

---

## 2. WiFi Access Point Setup

### Decision: hostapd + dnsmasq + nftables/iptables
**Status**: Standard Linux WiFi AP stack

**Component Breakdown**:

**hostapd** (WiFi access point daemon):
- Handles IEEE 802.11 authentication and association
- Configuration file: `/etc/hostapd/hostapd.conf` (or runtime generated in `/run`)
- Requires WiFi interface in AP mode

**dnsmasq** (DHCP + DNS server):
- Provides DHCP for connected clients
- Built-in DNS for captive portal redirection
- Lightweight and well-suited for embedded systems

**Captive Portal Implementation**:
- Use dnsmasq's `address=/#/192.168.4.1` to redirect all DNS queries to AP IP
- Configure nftables/iptables to redirect HTTP/HTTPS to Cockpit port (9090)
- Serve redirect page via Cockpit or simple HTTP server

**Example hostapd configuration**:
```ini
interface=wlan0
driver=nl80211
ssid=setup-${HOSTNAME}-${RANDOM_SUFFIX}
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=onboarding
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
```

**Example dnsmasq configuration**:
```ini
interface=wlan0
dhcp-range=192.168.4.100,192.168.4.200,255.255.255.0,12h
dhcp-option=3,192.168.4.1
dhcp-option=6,192.168.4.1
address=/#/192.168.4.1
```

**Systemd Unit Strategy**:
- Service runs as `oneshot` on first boot
- Checks for WiFi hardware availability
- Generates random SSID suffix
- Configures interface IP address
- Starts hostapd and dnsmasq
- Sets up firewall rules for captive portal

**Dependency Handling**:
- RPM spec: `Recommends: hostapd dnsmasq` (not `Requires`)
- Runtime check: `systemctl is-active --quiet hostapd.service` before enabling AP
- User-friendly error if packages missing

**Alternatives Considered**:
- NetworkManager AP mode: More complex, requires additional DBUS calls
- Rejected because hostapd is more lightweight and easier to configure programmatically

---

## 3. LED Control Patterns and GPIO Interaction

### Decision: Configurable External LED Control Tool
**Status**: User-provided implementation, plugin calls via subprocess

**Rationale**:
- LED hardware varies by platform (GPIO pins, I2C, SPI, USB-controlled)
- Blink patterns are user preference (speed, color, sequence)
- Plugin should not hardcode GPIO manipulation

**LED Control Tool Interface**:

**Command-line API**:
```bash
led-control <state>

States:
  ready            # Slow blink (ready for onboarding)
  in-progress      # Pulsing (wizard in progress)
  applying         # Fast blink (applying configuration)
  success          # Solid on (onboarding complete)
  error            # Rapid blink or red color (error occurred)
  off              # Turn off LED
```

**Exit codes**:
- 0: Success
- 1: LED hardware unavailable (graceful degradation)
- 2+: Configuration error

**Configuration in `/etc/cockpit/system-onboarding/config.json`**:
```json
{
  "led": {
    "enabled": true,
    "tool": "/usr/local/bin/led-control",
    "states": {
      "ready": "ready",
      "in-progress": "in-progress",
      "applying": "applying",
      "success": "success",
      "error": "error",
      "off": "off"
    }
  }
}
```

**Example GPIO Implementation** (reference for users):
```bash
#!/bin/bash
# /usr/local/bin/led-control
# Example LED control for GPIO pin 17 (BCM numbering)

GPIO_PIN=17
GPIO_PATH="/sys/class/gpio/gpio${GPIO_PIN}"

setup_gpio() {
    if [ ! -d "$GPIO_PATH" ]; then
        echo "$GPIO_PIN" > /sys/class/gpio/export
        echo "out" > "$GPIO_PATH/direction"
    fi
}

case "$1" in
    ready)
        setup_gpio
        # Slow blink (500ms on, 500ms off)
        while true; do
            echo 1 > "$GPIO_PATH/value"
            sleep 0.5
            echo 0 > "$GPIO_PATH/value"
            sleep 0.5
        done &
        ;;
    success)
        setup_gpio
        echo 1 > "$GPIO_PATH/value"
        ;;
    error)
        setup_gpio
        # Fast blink (100ms on, 100ms off)
        while true; do
            echo 1 > "$GPIO_PATH/value"
            sleep 0.1
            echo 0 > "$GPIO_PATH/value"
            sleep 0.1
        done &
        ;;
    off)
        setup_gpio
        echo 0 > "$GPIO_PATH/value"
        killall -q led-control
        ;;
esac
```

**Plugin Integration** (TypeScript):
```typescript
class LedController {
  async setLedState(state: 'ready' | 'in-progress' | 'applying' | 'success' | 'error' | 'off'): Promise<void> {
    const config = await loadConfig();
    if (!config.led?.enabled) return;

    try {
      const proc = cockpit.spawn([config.led.tool, config.led.states[state] || state]);
      await proc;
    } catch (error) {
      console.warn(`LED control failed (${state}):`, error);
      // Graceful degradation - don't fail onboarding if LED fails
    }
  }
}
```

**Alternatives Considered**:
- Hardcode GPIO control in plugin: Rejected due to platform diversity
- Use systemd-based LED triggers: Rejected because user patterns vary

---

## 4. Systemd Unit Configuration for First-Boot Services

### Decision: systemd oneshot service with After=multi-user.target
**Status**: Standard pattern for first-boot initialization

**Unit File**: `/usr/lib/systemd/system/cockpit-system-onboarding-setup.service`

```ini
[Unit]
Description=Cockpit System Onboarding Setup
Documentation=https://github.com/cockpit-project/cockpit-system-onboarding
After=multi-user.target network.target
ConditionPathExists=!/var/lib/cockpit-system-onboarding/.onboarding-complete
ConditionPathExists=/etc/cockpit/system-onboarding/config.json

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/usr/libexec/cockpit-system-onboarding/check-dependencies.sh
ExecStart=/usr/libexec/cockpit-system-onboarding/create-onboarding-user.sh
ExecStart=/usr/libexec/cockpit-system-onboarding/setup-network.sh
ExecStart=/usr/libexec/cockpit-system-onboarding/setup-led.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Conditional WiFi AP Service**: `/usr/lib/systemd/system/cockpit-system-onboarding-wifi-ap.service`

```ini
[Unit]
Description=Cockpit System Onboarding WiFi Access Point
Documentation=https://github.com/cockpit-project/cockpit-system-onboarding
After=cockpit-system-onboarding-setup.service
Requires=cockpit-system-onboarding-setup.service
ConditionPathExists=!/var/lib/cockpit-system-onboarding/.onboarding-complete

[Service]
Type=forking
ExecStartPre=/usr/libexec/cockpit-system-onboarding/check-wifi-deps.sh
ExecStart=/usr/libexec/cockpit-system-onboarding/setup-wifi-ap.sh start
ExecStop=/usr/libexec/cockpit-system-onboarding/setup-wifi-ap.sh stop
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

**Script: `/usr/libexec/cockpit-system-onboarding/create-onboarding-user.sh`**:
```bash
#!/bin/bash
set -e

# Create onboarding user with no password (pam_succeed_if allows login)
if ! id onboarding >/dev/null 2>&1; then
    useradd -m -s /bin/bash -c "System Onboarding User" onboarding
    passwd -d onboarding  # Remove password
fi

# Install sudoers file
cp /usr/share/cockpit/system-onboarding/sudoers.conf /etc/sudoers.d/cockpit-system-onboarding
chmod 0440 /etc/sudoers.d/cockpit-system-onboarding

# Configure Cockpit to allow passwordless login for onboarding user
mkdir -p /etc/cockpit
cat > /etc/cockpit/cockpit.conf <<EOF
[WebService]
AllowUnencrypted = true
LoginTo = false
EOF

# Install module overrides if configured
if grep -q '"hideModules": true' /etc/cockpit/system-onboarding/config.json 2>/dev/null; then
    mkdir -p ~onboarding/.config/cockpit
    cp /usr/share/cockpit/system-onboarding/overrides/*.json ~onboarding/.config/cockpit/
    chown -R onboarding:onboarding ~onboarding/.config
fi
```

**Cleanup After Onboarding**:
- Marker file: `/var/lib/cockpit-system-onboarding/.onboarding-complete`
- If config specifies `runOnce: true`:
  - Delete onboarding user: `userdel -r onboarding`
  - Remove sudoers file: `rm /etc/sudoers.d/cockpit-system-onboarding`
  - Disable service: `systemctl disable cockpit-system-onboarding-setup.service`
- If config specifies `keepCockpit: true`:
  - Keep onboarding user but require password change on next login
  - Use `chage -d 0 onboarding` to force password change

**Alternatives Considered**:
- cloud-init: Rejected because it's not universally available
- Custom init script: Rejected in favor of systemd standard

---

## 5. Sudoers Configuration for Minimal Privilege Escalation

### Decision: Granular sudoers rules for specific commands
**Status**: Principle of least privilege

**File**: `/etc/sudoers.d/cockpit-system-onboarding`

```sudoers
# Cockpit System Onboarding - Minimal sudo privileges for onboarding user
# IMPORTANT: This file grants passwordless sudo for specific system configuration commands
# Remove this file after onboarding is complete if plugin is configured to run once

onboarding ALL=(ALL) NOPASSWD: /usr/bin/hostnamectl set-hostname *
onboarding ALL=(ALL) NOPASSWD: /usr/bin/nmcli *
onboarding ALL=(ALL) NOPASSWD: /usr/bin/timedatectl *
onboarding ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart NetworkManager
onboarding ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart chronyd
onboarding ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart systemd-timesyncd
onboarding ALL=(ALL) NOPASSWD: /usr/bin/ip link set * up
onboarding ALL=(ALL) NOPASSWD: /usr/bin/ip link set * down
onboarding ALL=(ALL) NOPASSWD: /usr/bin/ip addr add * dev *
onboarding ALL=(ALL) NOPASSWD: /usr/libexec/cockpit-system-onboarding/cleanup-onboarding.sh

# Enrollment scripts (user-provided)
onboarding ALL=(ALL) NOPASSWD: /home/onboarding/.config/cockpit/system-onboarding.d/*.sh
onboarding ALL=(ALL) NOPASSWD: /etc/cockpit/system-onboarding.d/*.sh
```

**Security Considerations**:
- Wildcards (*) are necessary for dynamic values (hostnames, interface names)
- Network configuration commands (`nmcli`, `ip`) have broad permissions but are necessary
- Enrollment scripts are trusted (user-provided)
- File should be mode 0440 (read-only for root and sudo group)

**Cockpit's Privilege Escalation**:
- Cockpit uses PolicyKit (polkit) for privilege escalation, not sudo
- However, DBUS calls with `{ superuser: 'try' }` option trigger polkit authentication
- The sudoers file is primarily for enrollment scripts and CLI-based fallbacks

**Alternative Approach (PolicyKit)**:
```xml
<!-- /etc/polkit-1/rules.d/50-cockpit-system-onboarding.rules -->
polkit.addRule(function(action, subject) {
    if (subject.user == "onboarding" &&
        (action.id == "org.freedesktop.hostname1.set-static-hostname" ||
         action.id == "org.freedesktop.timedate1.set-ntp" ||
         action.id == "org.freedesktop.NetworkManager.network-control")) {
        return polkit.Result.YES;
    }
});
```

**Decision**: Use both sudoers (for scripts) and PolicyKit (for DBUS calls) as Cockpit naturally uses PolicyKit

---

## 6. Cockpit Configuration File Loading Patterns

### Decision: JSON config with fallback hierarchy
**Status**: Standard Cockpit pattern

**Configuration Hierarchy**:
1. User override: `/etc/cockpit/system-onboarding/config.json` (highest priority)
2. Default: `/usr/share/cockpit/system-onboarding/config.json` (fallback)

**Configuration Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "runOnce": { "type": "boolean", "default": true },
    "keepCockpit": { "type": "boolean", "default": false },
    "hideModules": { "type": "boolean", "default": true },
    "autoReboot": { "type": "boolean", "default": false },
    "network": {
      "type": "object",
      "properties": {
        "wifiAp": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": false },
            "ssidPrefix": { "type": "string", "default": "setup-" },
            "interface": { "type": "string" },
            "password": { "type": "string", "minLength": 8 }
          }
        },
        "ethernet": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "interface": { "type": "string" },
            "staticIp": { "type": "string", "format": "ipv4", "default": "192.168.100.1" }
          }
        }
      }
    },
    "enrollmentServices": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "description": { "type": "string" },
          "endpoint": {
            "type": "object",
            "properties": {
              "url": { "type": "string", "format": "uri" },
              "allowUserOverride": { "type": "boolean", "default": false }
            },
            "required": ["url"]
          },
          "credentialsSchema": {
            "type": "object",
            "description": "react-jsonschema-form compatible schema",
            "properties": {
              "type": { "const": "object" },
              "properties": {
                "type": "object",
                "description": "Define credential fields - supports username/password and token patterns"
              },
              "required": {
                "type": "array",
                "items": { "type": "string" }
              }
            },
            "examples": [
              {
                "type": "object",
                "properties": {
                  "username": { "type": "string", "title": "Username" },
                  "password": { "type": "string", "title": "Password", "format": "password" }
                },
                "required": ["username", "password"]
              },
              {
                "type": "object",
                "properties": {
                  "token": { "type": "string", "title": "API Token", "format": "password" }
                },
                "required": ["token"]
              },
              {
                "type": "object",
                "properties": {
                  "organizationId": { "type": "string", "title": "Organization ID" },
                  "activationKey": { "type": "string", "title": "Activation Key", "format": "password" }
                },
                "required": ["organizationId", "activationKey"]
              }
            ]
          },
          "scriptPath": { "type": "string" }
        },
        "required": ["id", "name", "endpoint", "credentialsSchema", "scriptPath"]
      }
    },
    "led": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": false },
        "tool": { "type": "string" },
        "states": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        }
      }
    }
  },
  "required": ["version"]
}
```

**Example Configuration** (`/usr/share/cockpit/system-onboarding/config.json`):
```json
{
  "version": "1.0",
  "runOnce": true,
  "hideModules": true,
  "autoReboot": false,
  "enrollmentServices": [
    {
      "id": "flightctl",
      "name": "Flight Control",
      "description": "Enroll this device into Flight Control fleet management",
      "endpoint": {
        "url": "https://flightctl.example.com",
        "allowUserOverride": true
      },
      "credentialsSchema": {
        "type": "object",
        "properties": {
          "username": { "type": "string", "title": "Username" },
          "password": { "type": "string", "title": "Password", "format": "password" }
        },
        "required": ["username", "password"]
      },
      "scriptPath": "/etc/cockpit/system-onboarding.d/flightctl-enroll.sh"
    }
  ]
}
```

**Loading Implementation** (TypeScript):
```typescript
interface EnrollmentService {
  id: string;
  name: string;
  description?: string;
  endpoint: {
    url: string;
    allowUserOverride?: boolean;
  };
  credentialsSchema: any; // JSON Schema (react-jsonschema-form compatible)
  scriptPath: string;
}

interface SystemOnboardingConfig {
  version: string;
  runOnce?: boolean;
  keepCockpit?: boolean;
  hideModules?: boolean;
  autoReboot?: boolean;
  network?: {
    wifiAp?: {
      enabled?: boolean;
      ssidPrefix?: string;
      interface?: string;
      password?: string;
    };
    ethernet?: {
      enabled?: boolean;
      interface?: string;
      staticIp?: string;
    };
  };
  enrollmentServices?: EnrollmentService[];
  led?: {
    enabled?: boolean;
    tool?: string;
    states?: Record<string, string>;
  };
}

async function loadConfig(): Promise<SystemOnboardingConfig> {
  const defaultPath = '/usr/share/cockpit/system-onboarding/config.json';
  const userPath = '/etc/cockpit/system-onboarding/config.json';

  let defaultConfig: Partial<SystemOnboardingConfig> = { version: '1.0' };
  let userConfig: Partial<SystemOnboardingConfig> = {};

  try {
    const defaultFile = cockpit.file(defaultPath, { syntax: JSON });
    defaultConfig = await defaultFile.read();
  } catch (error) {
    console.warn('Default config not found, using built-in defaults:', error);
  }

  try {
    const userFile = cockpit.file(userPath, { syntax: JSON });
    userConfig = await userFile.read();
  } catch (error) {
    console.info('User config not found, using defaults:', error);
  }

  // Merge with user config taking precedence
  return { ...defaultConfig, ...userConfig } as SystemOnboardingConfig;
}
```

**Enrollment Script Interface**:

Enrollment scripts receive credentials and endpoint URL via environment variables:

```bash
#!/bin/bash
# Example: /etc/cockpit/system-onboarding.d/flightctl-enroll.sh

# Environment variables provided by plugin:
# - ENROLLMENT_ENDPOINT: Service endpoint URL (from config or user override)
# - ENROLLMENT_CREDENTIALS_JSON: JSON string with credential fields
# - ENROLLMENT_SERVICE_ID: Service identifier from config

set -e

# Parse credentials from JSON
USERNAME=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.username')
PASSWORD=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.password')

# Use endpoint from environment
echo "Enrolling into Flight Control at $ENROLLMENT_ENDPOINT..."

# Perform enrollment
flightctl login --server "$ENROLLMENT_ENDPOINT" --username "$USERNAME" --password "$PASSWORD"
flightctl enroll

echo "✓ Enrollment successful"
```

**Alternatives Considered**:
- YAML config: Rejected because JSON is standard in Cockpit ecosystem
- INI config: Rejected because nested structures are awkward

---

## 7. NetworkManager WiFi Configuration via DBUS

### Decision: Use NetworkManager DBUS API directly
**Status**: Aligns with Constitution Principle VI (DBUS Over CLI)

**WiFi Scanning** (before creating AP):
```typescript
async function scanWifiNetworks(nmClient: any, devicePath: string): Promise<Array<{
  ssid: string;
  strength: number;
  security: string;
}>> {
  const deviceProxy = nmClient.proxy('org.freedesktop.NetworkManager.Device.Wireless', devicePath);
  await deviceProxy.wait();

  // Request scan
  await deviceProxy.RequestScan({});

  // Wait for scan to complete
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get access points
  const apPaths = deviceProxy.AccessPoints || [];
  const aps = [];

  for (const apPath of apPaths) {
    const apProxy = nmClient.proxy('org.freedesktop.NetworkManager.AccessPoint', apPath);
    await apProxy.wait();

    const ssid = new TextDecoder().decode(new Uint8Array(apProxy.Ssid || []));
    const strength = apProxy.Strength || 0;
    const flags = apProxy.Flags || 0;
    const wpaFlags = apProxy.WpaFlags || 0;
    const rsnFlags = apProxy.RsnFlags || 0;

    let security = 'none';
    if (wpaFlags !== 0 || rsnFlags !== 0) {
      security = 'wpa';
    } else if (flags !== 0) {
      security = 'wep';
    }

    aps.push({ ssid, strength, security });
  }

  return aps;
}
```

**WiFi Connection Creation**:
```typescript
async function createWifiConnection(
  nmClient: any,
  devicePath: string,
  ssid: string,
  password: string,
  vlanId?: number
): Promise<void> {
  const settings = {
    connection: {
      id: `Cockpit-WiFi-${ssid}`,
      type: '802-11-wireless',
      autoconnect: true,
      uuid: generateUUID()
    },
    '802-11-wireless': {
      ssid: new TextEncoder().encode(ssid),
      mode: 'infrastructure'
    },
    '802-11-wireless-security': password ? {
      'key-mgmt': 'wpa-psk',
      psk: password
    } : undefined,
    ipv4: {
      method: 'auto'
    },
    ipv6: {
      method: 'auto'
    }
  };

  // Add VLAN if specified
  if (vlanId) {
    settings.vlan = {
      id: vlanId,
      parent: devicePath
    };
  }

  // Create and activate connection
  const nmProxy = nmClient.proxy('org.freedesktop.NetworkManager', '/org/freedesktop/NetworkManager');
  await nmProxy.AddAndActivateConnection(settings, devicePath, '/');
}
```

**Alternatives Considered**:
- nmcli commands: Rejected per Constitution Principle VI (DBUS Over CLI)
- Manual wpa_supplicant configuration: Rejected because NetworkManager is required dependency

---

## 8. VLAN Configuration via NetworkManager

### Decision: Create VLAN connection as child of base interface
**Status**: Standard NetworkManager pattern

**VLAN Connection Settings**:
```typescript
async function createVlanConnection(
  nmClient: any,
  parentInterface: string,
  vlanId: number,
  ipConfig: { method: 'auto' | 'manual', address?: string, prefix?: number, gateway?: string }
): Promise<void> {
  const settings = {
    connection: {
      id: `${parentInterface}.${vlanId}`,
      type: 'vlan',
      autoconnect: true,
      uuid: generateUUID()
    },
    vlan: {
      id: vlanId,
      parent: parentInterface
    },
    ipv4: ipConfig.method === 'manual' ? {
      method: 'manual',
      addresses: [[ipConfig.address, ipConfig.prefix, ipConfig.gateway]]
    } : {
      method: 'auto'
    },
    ipv6: {
      method: 'auto'
    }
  };

  const nmProxy = nmClient.proxy('org.freedesktop.NetworkManager', '/org/freedesktop/NetworkManager');
  await nmProxy.AddAndActivateConnection(settings, getDevicePath(parentInterface), '/');
}
```

**VLAN ID Validation**:
- Range: 1-4094 (0 and 4095 are reserved)
- User input validation in wizard step

**Alternatives Considered**:
- ip link add commands: Rejected per Constitution Principle VI

---

## Summary of Research Findings

**No NEEDS CLARIFICATION remaining** - All technical unknowns have been resolved with clear implementation decisions:

1. **Unit Testing**: Jest + React Testing Library with Cockpit API mocks
2. **WiFi AP**: hostapd + dnsmasq with conditional dependency
3. **LED Control**: External configurable tool interface
4. **Systemd Units**: First-boot oneshot services with conditional execution
5. **Sudoers**: Granular command permissions + PolicyKit for DBUS
6. **Config Loading**: JSON with fallback hierarchy (user override + default)
   - **Enrollment Services**: Support endpoint URL with user override option
   - **Credentials Schema**: Support username/password, token, and custom patterns via react-jsonschema-form
7. **WiFi Config**: NetworkManager DBUS API for scanning and connection
8. **VLAN Config**: NetworkManager VLAN connection type

All decisions align with project constitution and Cockpit best practices.
