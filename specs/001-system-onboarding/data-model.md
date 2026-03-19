# Data Model: Cockpit System Onboarding Plugin

**Date**: 2025-10-27
**Feature**: System Onboarding Plugin
**Purpose**: Define all entities, their fields, relationships, and validation rules

## Entity Relationship Overview

```
┌─────────────────────────┐
│ SystemOnboardingConfig  │ (stored in JSON file)
│ - version               │
│ - runOnce               │
│ - hideModules           │
│ - enrollmentServices[]  │─┐
│ - network               │ │
│ - led                   │ │
└─────────────────────────┘ │
                            │
         ┌──────────────────┘
         │
         ▼
┌─────────────────────────┐
│ EnrollmentService       │
│ - id                    │
│ - name                  │
│ - endpoint              │
│ - credentialsSchema     │
│ - scriptPath            │
└─────────────────────────┘
         │
         │ used by
         ▼
┌─────────────────────────┐
│ OnboardingSession       │ (runtime state in React context)
│ - hostname              │
│ - networkInterface      │─┐
│ - networkAddress        │ │
│ - networkServices       │ │
│ - enrollment            │ │
│ - wizardStep            │ │
└─────────────────────────┘ │
                            │
         ┌──────────────────┘
         │
         ▼
┌─────────────────────────┐
│ NetworkInterface        │ (from NetworkManager DBUS)
│ - name                  │
│ - type                  │
│ - macAddress            │
│ - state                 │
│ - availableWifiNetworks │
└─────────────────────────┘
         │
         │ contains
         ▼
┌─────────────────────────┐
│ WifiNetwork             │ (from NetworkManager scan)
│ - ssid                  │
│ - strength              │
│ - security              │
└─────────────────────────┘
```

---

## Entity Definitions

### 1. SystemOnboardingConfig

**Purpose**: Persistent configuration defining onboarding behavior and available enrollment services

**Storage**: JSON file
- Default: `/usr/share/cockpit/system-onboarding/config.json`
- User override: `/etc/cockpit/system-onboarding/config.json`

**Fields**:

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `version` | string | ✅ | - | Configuration schema version | Must be "1.0" |
| `runOnce` | boolean | ❌ | `true` | Disable plugin after successful completion | - |
| `keepCockpit` | boolean | ❌ | `false` | Keep Cockpit enabled after onboarding | - |
| `hideModules` | boolean | ❌ | `true` | Hide other Cockpit modules during onboarding | - |
| `autoReboot` | boolean | ❌ | `false` | Automatically reboot after applying configuration | - |
| `network` | NetworkConfig | ❌ | `{}` | Network setup configuration | See NetworkConfig |
| `enrollmentServices` | EnrollmentService[] | ❌ | `[]` | Available enrollment services | See EnrollmentService |
| `led` | LedConfig | ❌ | `{}` | LED indicator configuration | See LedConfig |

**Relationships**:
- **Contains**: `enrollmentServices[]` (array of EnrollmentService)
- **Contains**: `network` (NetworkConfig object)
- **Contains**: `led` (LedConfig object)

**State Transitions**: Immutable (read-only at runtime)

---

### 2. NetworkConfig

**Purpose**: Define network interfaces available for initial access (WiFi AP, Ethernet)

**Fields**:

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `wifiAp` | WifiApConfig | ❌ | `{ enabled: false }` | WiFi access point settings | See WifiApConfig |
| `ethernet` | EthernetConfig | ❌ | `{ enabled: true }` | Ethernet interface settings | See EthernetConfig |

**Sub-Entity: WifiApConfig**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `enabled` | boolean | ❌ | `false` | Enable WiFi AP on first boot | - |
| `ssidPrefix` | string | ❌ | `"setup-"` | SSID prefix (suffix is hostname + random) | Length 1-20 |
| `interface` | string | ❌ | - | WiFi interface name (e.g., "wlan0") | Must exist on system |
| `password` | string | ❌ | `"onboarding"` | WiFi WPA passphrase | Length >= 8 |

**Sub-Entity: EthernetConfig**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `enabled` | boolean | ❌ | `true` | Enable Ethernet setup on first boot | - |
| `interface` | string | ❌ | - | Ethernet interface name (e.g., "eth0") | Must exist on system |
| `staticIp` | string | ❌ | `"192.168.100.1"` | Well-known IP address | Valid IPv4 address |

---

### 3. EnrollmentService

**Purpose**: Define a management service for device enrollment (e.g., Flight Control, Red Hat Insights)

**Storage**: Part of SystemOnboardingConfig JSON

**Fields**:

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `id` | string | ✅ | - | Unique service identifier (slug) | Lowercase, alphanumeric + hyphens |
| `name` | string | ✅ | - | Display name for service | Length 1-100 |
| `description` | string | ❌ | - | User-facing description | Length 0-500 |
| `endpoint` | EndpointConfig | ✅ | - | Service endpoint configuration | See EndpointConfig |
| `credentialsSchema` | JSONSchema | ✅ | - | react-jsonschema-form schema for credentials | Valid JSON Schema Draft 7 |
| `scriptPath` | string | ✅ | - | Absolute path to enrollment script | Must be executable file |

**Sub-Entity: EndpointConfig**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `url` | string | ✅ | - | Default service endpoint URL | Valid URI (http/https) |
| `allowUserOverride` | boolean | ❌ | `false` | Allow user to specify custom endpoint at runtime | - |

**Relationships**:
- **Used by**: OnboardingSession (enrollment credentials stored in session)

**Validation Rules**:
- `credentialsSchema` must be valid JSON Schema Draft 7
- `credentialsSchema.type` must be "object"
- `scriptPath` must point to executable file (checked at runtime)
- `endpoint.url` must be valid URI

**Examples**:

```json
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
```

---

### 4. LedConfig

**Purpose**: Configure LED indicator tool and state mappings

**Storage**: Part of SystemOnboardingConfig JSON

**Fields**:

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `enabled` | boolean | ❌ | `false` | Enable LED indicator control | - |
| `tool` | string | ❌ | - | Absolute path to LED control executable | Must be executable |
| `states` | Record<LedState, string> | ❌ | Default mappings | Map LED states to tool arguments | See LedState |

**LedState Enum**:
- `ready`: Slow blink (ready for onboarding)
- `in-progress`: Pulsing (wizard in progress)
- `applying`: Fast blink (applying configuration)
- `success`: Solid on (onboarding complete)
- `error`: Rapid blink (error occurred)
- `off`: Turn off LED

**Default State Mappings**:
```json
{
  "ready": "ready",
  "in-progress": "in-progress",
  "applying": "applying",
  "success": "success",
  "error": "error",
  "off": "off"
}
```

---

### 5. OnboardingSession

**Purpose**: Track user's progress through the wizard and store configuration values

**Storage**: React context (in-memory runtime state)

**Fields**:

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `hostname` | HostnameState | ✅ | `{ value: "" }` | Hostname configuration | See HostnameState |
| `networkInterface` | NetworkInterfaceState | ✅ | `{ selectedInterface: null }` | Network interface selection | See NetworkInterfaceState |
| `networkAddress` | NetworkAddressState | ✅ | IPv4/IPv6 defaults | IP address configuration | See NetworkAddressState |
| `networkServices` | NetworkServicesState | ✅ | Defaults | NTP, proxy configuration | See NetworkServicesState |
| `enrollment` | EnrollmentState | ❌ | `{}` | Enrollment service selections and credentials | See EnrollmentState |
| `wizardStep` | number | ✅ | `1` | Current wizard step (1-indexed) | 1 <= step <= totalSteps |

**Sub-Entity: HostnameState**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `value` | string | ✅ | - | User-entered hostname | RFC 1123 hostname format |

**Validation** (RFC 1123):
- Total length: 1-253 characters
- Label length: 1-63 characters per dot-separated label
- Characters: alphanumeric and hyphens only
- Start/end: must be alphanumeric
- Labels cannot be all numeric in FQDN

**Sub-Entity: NetworkInterfaceState**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `selectedInterface` | string \| null | ❌ | `null` | Name of selected interface | Must be valid interface name |
| `interfaceType` | "ethernet" \| "wifi" \| null | ❌ | `null` | Type of selected interface | - |
| `wifiSsid` | string \| null | ❌ | `null` | Selected WiFi network SSID | Required if interfaceType="wifi" |
| `wifiPassword` | string \| null | ❌ | `null` | WiFi password | Required for secured networks |
| `wifiSecurity` | "none" \| "wep" \| "wpa" \| null | ❌ | `null` | WiFi security type | - |
| `vlanId` | number \| null | ❌ | `null` | Optional VLAN ID | 1-4094 or null |

**Sub-Entity: NetworkAddressState**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `ipv4` | IPv4Config | ✅ | `{ method: "auto" }` | IPv4 configuration | See IPv4Config |
| `ipv6` | IPv6Config | ✅ | `{ method: "auto" }` | IPv6 configuration | See IPv6Config |

**Sub-Sub-Entity: IPv4Config**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `method` | "auto" \| "static" \| "disabled" | ✅ | `"auto"` | IP assignment method | - |
| `address` | string \| null | ❌ | `null` | Static IPv4 address | Valid IPv4 if method="static" |
| `subnetMask` | string \| null | ❌ | `null` | Subnet mask | Valid IPv4 if method="static" |
| `gateway` | string \| null | ❌ | `null` | Default gateway | Valid IPv4 or empty |
| `autoDns` | boolean | ✅ | `true` | Use DHCP-assigned DNS | - |
| `primaryDns` | string \| null | ❌ | `null` | Primary DNS server | Valid IPv4 if autoDns=false |
| `secondaryDns` | string \| null | ❌ | `null` | Secondary DNS server | Valid IPv4 or empty |

**Sub-Sub-Entity: IPv6Config**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `method` | "auto" \| "static" \| "disabled" | ✅ | `"auto"` | IP assignment method | - |
| `address` | string \| null | ❌ | `null` | Static IPv6 address with prefix (e.g., "2001:db8::1/64") | Valid IPv6 CIDR if method="static" |
| `gateway` | string \| null | ❌ | `null` | Default gateway | Valid IPv6 or empty |
| `autoDns` | boolean | ✅ | `true` | Use DHCP-assigned DNS | - |
| `primaryDns` | string \| null | ❌ | `null` | Primary DNS server | Valid IPv6 if autoDns=false |
| `secondaryDns` | string \| null | ❌ | `null` | Secondary DNS server | Valid IPv6 or empty |

**Sub-Entity: NetworkServicesState**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `ntp` | NtpConfig | ✅ | `{ autoConfig: true }` | NTP configuration | See NtpConfig |
| `proxy` | ProxyConfig | ✅ | `{ enabled: false }` | HTTP proxy configuration | See ProxyConfig |

**Sub-Sub-Entity: NtpConfig**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `autoConfig` | boolean | ✅ | `true` | Use network-assigned NTP servers | - |
| `servers` | string[] | ❌ | `[]` | Custom NTP server addresses | Valid hostnames or IPs |

**Sub-Sub-Entity: ProxyConfig**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `enabled` | boolean | ✅ | `false` | Enable HTTP proxy | - |
| `hostname` | string \| null | ❌ | `null` | Proxy server hostname | Valid hostname or IP if enabled=true |
| `port` | number \| null | ❌ | `null` | Proxy server port | 1-65535 if enabled=true |
| `username` | string \| null | ❌ | `null` | Proxy authentication username | Optional |
| `password` | string \| null | ❌ | `null` | Proxy authentication password | Optional |

**Sub-Entity: EnrollmentState**

| Field | Type | Required | Default | Description | Validation |
|-------|------|----------|---------|-------------|------------|
| `selectedServices` | string[] | ❌ | `[]` | Array of service IDs user wants to enroll in | Must be valid service IDs |
| `credentials` | Record<serviceId, any> | ❌ | `{}` | Map of service ID to credential object | Must match credentialsSchema |
| `endpoints` | Record<serviceId, string> | ❌ | `{}` | Map of service ID to user-overridden endpoint URL | Valid URI if allowUserOverride=true |

**State Transitions**:
1. **Initial**: All fields at default values
2. **In Progress**: User filling out wizard steps
3. **Ready for Apply**: All required fields validated
4. **Applying**: Configuration being applied to system
5. **Complete**: Onboarding finished successfully
6. **Error**: Onboarding failed (can retry or edit)

**Validation Rules**:
- All wizard steps must pass validation before proceeding
- NetworkInterface selection required before NetworkAddress step
- Enrollment credentials must validate against service's credentialsSchema
- User can navigate backward and modify any previous step

---

### 6. NetworkInterface

**Purpose**: Represent a network interface available on the system (from NetworkManager)

**Source**: NetworkManager DBUS API (`org.freedesktop.NetworkManager.Device`)

**Fields** (read-only from system):

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `name` | string | Interface name (e.g., "eth0", "wlan0") | Device.Interface property |
| `type` | "ethernet" \| "wifi" \| "other" | Interface type | Device.DeviceType property |
| `macAddress` | string | MAC address | Device.HwAddress property |
| `state` | number | NetworkManager device state | Device.State property (NM_DEVICE_STATE) |
| `ipv4Address` | string \| null | Current IPv4 address | IP4Config.AddressData |
| `ipv6Address` | string \| null | Current IPv6 address | IP6Config.AddressData |
| `connection` | Connection \| null | Active connection object | Device.ActiveConnection |

**NetworkManager Device States** (numeric):
- `0`: Unknown
- `10`: Unmanaged
- `20`: Unavailable
- `30`: Disconnected
- `40`: Prepare
- `50`: Config
- `60`: Need auth
- `70`: IP config
- `80`: IP check
- `90`: Secondaries
- `100`: Activated
- `110`: Deactivating
- `120`: Failed

**Relationships**:
- **Selected in**: OnboardingSession.networkInterface
- **Contains** (if WiFi): Array of WifiNetwork (from scan)

---

### 7. WifiNetwork

**Purpose**: Represent a WiFi access point detected during scan

**Source**: NetworkManager DBUS API (`org.freedesktop.NetworkManager.AccessPoint`)

**Fields** (read-only from scan):

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `ssid` | string | Network name (SSID) | AccessPoint.Ssid property (decoded) |
| `strength` | number | Signal strength (0-100) | AccessPoint.Strength property |
| `security` | "none" \| "wep" \| "wpa" | Security type | Derived from Flags, WpaFlags, RsnFlags |
| `frequency` | number | Frequency in MHz | AccessPoint.Frequency property |

**Relationships**:
- **Belongs to**: NetworkInterface (WiFi type only)
- **Selected in**: OnboardingSession.networkInterface.wifiSsid

---

### 8. MarkerFile

**Purpose**: Indicate successful onboarding completion to prevent re-running

**Storage**: File on disk

**Location**: `/var/lib/cockpit-system-onboarding/.onboarding-complete`

**Fields** (file metadata):

| Field | Type | Description |
|-------|------|-------------|
| `exists` | boolean | File existence indicates completion |
| `timestamp` | number | File creation time (mtime) |
| `content` | string | Optional metadata (JSON or plain text) |

**State Transitions**:
1. **Not Exists**: Onboarding never run or incomplete
2. **Exists**: Onboarding completed successfully

**Lifecycle**:
- Created: When `applySystemConfiguration()` completes successfully
- Checked: On systemd unit startup (ConditionPathExists)
- Deleted: Manual intervention or re-enabling onboarding

---

### 9. ApplyResult

**Purpose**: Track results of applying configuration changes to the system

**Storage**: Runtime only (returned from `applySystemConfiguration()`)

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Overall success status |
| `results` | string[] | Array of log messages (✓ success, ✗ error, - skipped) |
| `errors` | Error[] | Array of error objects if failures occurred |

**Log Message Format**:
- ✓ Hostname set to: example.com
- ✓ IPv4 configured: 192.168.1.100/24
- ✗ Failed to set hostname: Permission denied
- - Network: No interface selected

---

## Validation Rules Summary

### Hostname Validation (RFC 1123)
```typescript
function validateHostname(hostname: string): string | null {
  if (!hostname.trim()) return 'Hostname is required';
  if (hostname.length > 253) return 'Hostname must be 253 characters or less';

  const labels = hostname.split('.');
  for (const label of labels) {
    if (label.length === 0) return 'Hostname cannot have empty labels';
    if (label.length > 63) return 'Each hostname label must be 63 characters or less';
    if (!/^[a-zA-Z0-9]/.test(label)) return 'Each label must start with alphanumeric';
    if (!/[a-zA-Z0-9]$/.test(label)) return 'Each label must end with alphanumeric';
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return 'Only letters, numbers, hyphens allowed';
  }

  return null;
}
```

### IPv4 Address Validation
```typescript
function validateIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && part === String(num);
  });
}
```

### IPv6 Address Validation
```typescript
function validateIPv6(ip: string): boolean {
  // Supports full form, compressed form (::), and CIDR notation
  const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
  return ipv6Pattern.test(ip.split('/')[0]); // Remove CIDR prefix if present
}
```

### VLAN ID Validation
```typescript
function validateVlanId(vlanId: number | null): string | null {
  if (vlanId === null) return null;
  if (vlanId < 1 || vlanId > 4094) return 'VLAN ID must be between 1 and 4094';
  return null;
}
```

### Port Validation
```typescript
function validatePort(port: number | null): string | null {
  if (port === null) return null;
  if (port < 1 || port > 65535) return 'Port must be between 1 and 65535';
  return null;
}
```

---

## Data Flow

1. **Configuration Loading**:
   ```
   JSON file → loadConfig() → SystemOnboardingConfig → React context
   ```

2. **Wizard State Updates**:
   ```
   User input → Validation → OnboardingSession update → Re-render
   ```

3. **Network Interface Discovery**:
   ```
   NetworkManager DBUS → NetworkInterface[] → Display in wizard
   ```

4. **WiFi Scanning**:
   ```
   NM Device.Wireless.RequestScan() → AccessPoint[] → WifiNetwork[] → Display options
   ```

5. **Configuration Application**:
   ```
   OnboardingSession → applySystemConfiguration() → DBUS calls → ApplyResult → Display logs
   ```

6. **Enrollment**:
   ```
   EnrollmentState → Enrollment scripts (env vars) → Execute → Capture output
   ```

---

## TypeScript Type Definitions

```typescript
// Complete type definitions derived from data model
export interface SystemOnboardingConfig {
  version: string;
  runOnce?: boolean;
  keepCockpit?: boolean;
  hideModules?: boolean;
  autoReboot?: boolean;
  network?: NetworkConfig;
  enrollmentServices?: EnrollmentService[];
  led?: LedConfig;
}

export interface NetworkConfig {
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
}

export interface EnrollmentService {
  id: string;
  name: string;
  description?: string;
  endpoint: {
    url: string;
    allowUserOverride?: boolean;
  };
  credentialsSchema: any; // JSON Schema
  scriptPath: string;
}

export interface LedConfig {
  enabled?: boolean;
  tool?: string;
  states?: Record<LedState, string>;
}

export type LedState = 'ready' | 'in-progress' | 'applying' | 'success' | 'error' | 'off';

export interface OnboardingSession {
  hostname: {
    value: string;
  };
  networkInterface: {
    selectedInterface: string | null;
    interfaceType: 'ethernet' | 'wifi' | null;
    wifiSsid: string | null;
    wifiPassword: string | null;
    wifiSecurity: 'none' | 'wep' | 'wpa' | null;
    vlanId: number | null;
  };
  networkAddress: {
    ipv4: {
      method: 'auto' | 'static' | 'disabled';
      address: string | null;
      subnetMask: string | null;
      gateway: string | null;
      autoDns: boolean;
      primaryDns: string | null;
      secondaryDns: string | null;
    };
    ipv6: {
      method: 'auto' | 'static' | 'disabled';
      address: string | null; // with /prefix
      gateway: string | null;
      autoDns: boolean;
      primaryDns: string | null;
      secondaryDns: string | null;
    };
  };
  networkServices: {
    ntp: {
      autoConfig: boolean;
      servers: string[];
    };
    proxy: {
      enabled: boolean;
      hostname: string | null;
      port: number | null;
      username: string | null;
      password: string | null;
    };
  };
  enrollment: {
    selectedServices: string[];
    credentials: Record<string, any>;
    endpoints: Record<string, string>;
  };
  wizardStep: number;
}

export interface NetworkInterface {
  name: string;
  type: 'ethernet' | 'wifi' | 'other';
  macAddress: string;
  state: number;
  ipv4Address: string | null;
  ipv6Address: string | null;
  connection: any | null;
}

export interface WifiNetwork {
  ssid: string;
  strength: number;
  security: 'none' | 'wep' | 'wpa';
  frequency: number;
}

export interface ApplyResult {
  success: boolean;
  results: string[];
  errors?: Error[];
}
```

---

## Summary

This data model defines **9 core entities** with comprehensive field definitions, validation rules, relationships, and state transitions. All entities align with the feature specification requirements and support the wizard-based onboarding workflow from initial access through enrollment completion.

**Key Characteristics**:
- **Configuration**: Persistent JSON with fallback hierarchy
- **Session State**: Runtime React context for wizard progress
- **System Integration**: Read-only data from NetworkManager DBUS
- **Validation**: Comprehensive rules for all user inputs
- **Extensibility**: Enrollment services defined via configuration
