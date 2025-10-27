# Enrollment Script API Contract

**Version**: 1.0
**Date**: 2025-10-27
**Purpose**: Define the interface between the Cockpit System Onboarding plugin and user-provided enrollment scripts

## Overview

Enrollment scripts are executable programs (typically shell scripts) that perform device enrollment into management services. The plugin executes these scripts with credentials and configuration passed via environment variables. Scripts can optionally return a device URL for the plugin to display as a hyperlink.

## Script Execution Environment

### Invocation
```bash
${SCRIPT_PATH}
```

The script is executed directly without arguments. All configuration is passed via environment variables.

### Working Directory
The script is executed with the working directory set to the onboarding user's home directory:
```
/home/onboarding
```

### User Context
- **User**: `onboarding` (temporary user created by systemd setup service)
- **Privileges**: Sudoers configuration grants passwordless sudo for specific commands
- **Shell**: `/bin/bash` (or user's configured shell)

### Timeout
- **Default**: 300 seconds (5 minutes)
- **Behavior**: If script exceeds timeout, it will be terminated with SIGTERM, followed by SIGKILL after 10 seconds

---

## Environment Variables

The plugin sets the following environment variables before executing the script:

| Variable | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `ENROLLMENT_SERVICE_ID` | string | ✅ | Service identifier from configuration | `"flightctl"` |
| `ENROLLMENT_SERVICE_NAME` | string | ✅ | Human-readable service name | `"Flight Control"` |
| `ENROLLMENT_ENDPOINT` | string | ✅ | Service endpoint URL (from config or user override) | `"https://flightctl.example.com"` |
| `ENROLLMENT_CREDENTIALS_JSON` | string | ✅ | JSON-encoded credentials object (matches credentialsSchema) | `'{"username":"admin","password":"secret"}'` |
| `ENROLLMENT_HOSTNAME` | string | ✅ | System hostname configured in wizard | `"edge-device-001"` |
| `ENROLLMENT_INTERFACE` | string | ✅ | Primary network interface configured in wizard | `"eth0"` |
| `ENROLLMENT_LOG_FILE` | string | ❌ | Optional log file path for verbose output | `"/var/log/cockpit-system-onboarding/flightctl.log"` |

### Environment Variable Details

**`ENROLLMENT_CREDENTIALS_JSON`**:
This variable contains a JSON string with credential fields as defined in the service's `credentialsSchema`. Scripts should parse this JSON to extract credentials.

**Examples**:

Username/Password authentication:
```json
{
  "username": "admin",
  "password": "secretPassword123"
}
```

Token authentication:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Organization/Activation Key authentication:
```json
{
  "organizationId": "12345",
  "activationKey": "ABCD-EFGH-IJKL-MNOP"
}
```

---

## Exit Codes

The script must return an exit code to indicate success or failure:

| Exit Code | Meaning | Plugin Behavior |
|-----------|---------|-----------------|
| `0` | Success - enrollment completed | Continue to next service (if any) or complete onboarding |
| `1` | Failure - generic error | Display error message, allow user to retry or skip |
| `2` | Failure - invalid credentials | Display "Invalid credentials" message, allow user to re-enter credentials |
| `3` | Failure - service unavailable | Display "Service unavailable" message, allow retry or skip |
| `4` | Failure - network error | Display "Network error" message, suggest checking network configuration |
| `5-255` | Failure - other errors | Display generic error message with exit code |

**Note**: The script should use specific exit codes (2-4) when possible to provide better user feedback.

---

## Standard Output and Standard Error

### Standard Output (stdout)
The plugin captures stdout and displays it in real-time in the enrollment progress UI. Scripts should write informative messages to stdout to show progress:

```bash
echo "Connecting to Flight Control server..."
echo "Authenticating user..."
echo "Retrieving enrollment configuration..."
echo "Enrolling device..."
echo "✓ Enrollment successful - Device ID: edge-device-001"
```

**Best Practices**:
- Use clear, user-friendly messages
- Avoid excessive output (keep it concise)
- Use ✓ or ✗ symbols to indicate success/failure of sub-steps
- Do NOT output sensitive information (passwords, tokens)

### Device URL Output (Optional)

Scripts MAY output a device URL to allow users to easily navigate to the device in the management service's web UI. The plugin will parse this URL and display it as a clickable hyperlink in the enrollment log, console banner, or completion screen.

**Format**:
```
DEVICE_URL: <url>
```

**Requirements**:
- Must be on a single line
- Must start with `DEVICE_URL:` (case-sensitive)
- URL must be valid HTTP or HTTPS URL
- Should be output after enrollment succeeds (before exit 0)

**Example**:
```bash
echo "✓ Enrollment successful - Device ID: edge-device-001"
echo "DEVICE_URL: https://flightctl.example.com/devices/edge-device-001"
exit 0
```

**Plugin Behavior**:
When the plugin detects a `DEVICE_URL:` line in stdout:
1. Extracts the URL from the line
2. Validates the URL format (must be http/https)
3. Displays the URL as a clickable hyperlink in the UI:
   - In the enrollment progress log: `"✓ Enrollment successful - [View device](URL)"`
   - In the completion screen: `"Device enrolled successfully. [View in Flight Control](URL)"`
   - In the console banner (if configured): `"Onboarding complete. [Manage device](URL)"`

**Multiple Services**:
If enrolling into multiple services, each script can output its own `DEVICE_URL`. The plugin will collect all URLs and display them in the completion screen.

### Standard Error (stderr)
stderr is captured separately and shown only on error. Use stderr for:
- Error messages
- Debug information (when debugging is enabled)
- Warnings that don't affect success

**Example**:
```bash
echo "✗ Failed to connect to server: Connection timeout" >&2
exit 3
```

---

## Script Template

### Bash Script Template

```bash
#!/bin/bash
# Enrollment script for [Service Name]
#
# This script is executed by the Cockpit System Onboarding plugin
# Environment variables are provided by the plugin (see API documentation)

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Configuration from environment
SERVICE_ID="${ENROLLMENT_SERVICE_ID}"
SERVICE_NAME="${ENROLLMENT_SERVICE_NAME}"
ENDPOINT="${ENROLLMENT_ENDPOINT}"
CREDENTIALS_JSON="${ENROLLMENT_CREDENTIALS_JSON}"
HOSTNAME="${ENROLLMENT_HOSTNAME}"
INTERFACE="${ENROLLMENT_INTERFACE}"

# Parse credentials from JSON
# Requires: jq (JSON processor)
if ! command -v jq &> /dev/null; then
    echo "✗ Error: jq is required but not installed" >&2
    exit 1
fi

USERNAME=$(echo "$CREDENTIALS_JSON" | jq -r '.username // empty')
PASSWORD=$(echo "$CREDENTIALS_JSON" | jq -r '.password // empty')

# Validate required credentials
if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
    echo "✗ Error: Missing required credentials (username or password)" >&2
    exit 2  # Invalid credentials
fi

# Perform enrollment
echo "Enrolling device into $SERVICE_NAME..."
echo "Endpoint: $ENDPOINT"
echo "Hostname: $HOSTNAME"

# Example: Call service API or CLI tool
DEVICE_ID=""
if ! DEVICE_ID=$(service-cli enroll \
    --server "$ENDPOINT" \
    --username "$USERNAME" \
    --password "$PASSWORD" \
    --hostname "$HOSTNAME" \
    --interface "$INTERFACE" 2>&1); then

    # Check error type and return appropriate exit code
    if [[ $? -eq 1 ]]; then
        echo "✗ Invalid credentials" >&2
        exit 2
    elif [[ $? -eq 2 ]]; then
        echo "✗ Service unavailable" >&2
        exit 3
    else
        echo "✗ Enrollment failed" >&2
        exit 1
    fi
fi

echo "✓ Enrollment successful - Device ID: $DEVICE_ID"

# Output device URL for plugin to display as hyperlink
if [ -n "$DEVICE_ID" ]; then
    echo "DEVICE_URL: ${ENDPOINT}/devices/${DEVICE_ID}"
fi

exit 0
```

### Python Script Template

```python
#!/usr/bin/env python3
"""
Enrollment script for [Service Name]

This script is executed by the Cockpit System Onboarding plugin.
Environment variables are provided by the plugin (see API documentation).
"""

import os
import sys
import json

def main():
    # Read configuration from environment
    service_id = os.environ['ENROLLMENT_SERVICE_ID']
    service_name = os.environ['ENROLLMENT_SERVICE_NAME']
    endpoint = os.environ['ENROLLMENT_ENDPOINT']
    credentials_json = os.environ['ENROLLMENT_CREDENTIALS_JSON']
    hostname = os.environ['ENROLLMENT_HOSTNAME']
    interface = os.environ['ENROLLMENT_INTERFACE']

    # Parse credentials
    try:
        credentials = json.loads(credentials_json)
    except json.JSONDecodeError as e:
        print(f"✗ Error: Invalid credentials JSON: {e}", file=sys.stderr)
        return 1

    username = credentials.get('username')
    password = credentials.get('password')

    if not username or not password:
        print("✗ Error: Missing required credentials", file=sys.stderr)
        return 2  # Invalid credentials

    # Perform enrollment
    print(f"Enrolling device into {service_name}...")
    print(f"Endpoint: {endpoint}")
    print(f"Hostname: {hostname}")

    try:
        # Example: Call service API
        device_id = service_api.enroll(endpoint, username, password, hostname)
        print(f"✓ Enrollment successful - Device ID: {device_id}")

        # Output device URL for plugin to display as hyperlink
        device_url = f"{endpoint}/devices/{device_id}"
        print(f"DEVICE_URL: {device_url}")

    except ServiceAuthError:
        print("✗ Invalid credentials", file=sys.stderr)
        return 2
    except ServiceUnavailableError:
        print("✗ Service unavailable", file=sys.stderr)
        return 3
    except NetworkError:
        print("✗ Network error", file=sys.stderr)
        return 4
    except Exception as e:
        print(f"✗ Enrollment failed: {e}", file=sys.stderr)
        return 1

    return 0

if __name__ == '__main__':
    sys.exit(main())
```

---

## Security Considerations

### Credential Handling
1. **Never log credentials**: Do not echo passwords, tokens, or keys to stdout/stderr
2. **Secure temporary files**: If credentials must be written to disk, use secure temp files with restrictive permissions (0600)
3. **Clean up**: Remove any temporary files containing credentials on exit (use trap for cleanup)

**Example**:
```bash
TEMP_CREDS=$(mktemp)
chmod 600 "$TEMP_CREDS"
trap "rm -f '$TEMP_CREDS'" EXIT

echo "$CREDENTIALS_JSON" > "$TEMP_CREDS"
# Use $TEMP_CREDS for enrollment
# File is automatically deleted on exit
```

### Network Communication
1. **Use HTTPS**: Always validate SSL/TLS certificates (don't use `--insecure` flags)
2. **Timeout**: Implement connection timeouts to prevent hanging
3. **Retry logic**: Implement exponential backoff for transient errors

### Script Permissions
1. **Executable**: Script must have execute permission (`chmod +x`)
2. **Owner**: Should be owned by root or the onboarding user
3. **Location**: Store in `/etc/cockpit/system-onboarding.d/` or `/usr/share/cockpit/system-onboarding/`

---

## Testing Enrollment Scripts

### Manual Testing
Simulate the plugin execution environment:

```bash
#!/bin/bash
# test-enrollment.sh - Test enrollment script manually

export ENROLLMENT_SERVICE_ID="flightctl"
export ENROLLMENT_SERVICE_NAME="Flight Control"
export ENROLLMENT_ENDPOINT="https://flightctl.example.com"
export ENROLLMENT_CREDENTIALS_JSON='{"username":"testuser","password":"testpass"}'
export ENROLLMENT_HOSTNAME="test-device"
export ENROLLMENT_INTERFACE="eth0"

# Execute script
/etc/cockpit/system-onboarding.d/flightctl-enroll.sh
echo "Exit code: $?"
```

### Integration Testing
The plugin's integration test suite will execute enrollment scripts in a test environment. Scripts should:
1. Support a `--dry-run` mode for testing (optional but recommended)
2. Validate all environment variables are set
3. Return appropriate exit codes for different failure scenarios
4. Output valid device URLs when successful

---

## Example: Flight Control Enrollment Script

```bash
#!/bin/bash
# /etc/cockpit/system-onboarding.d/flightctl-enroll.sh
# Flight Control device enrollment script

set -euo pipefail

# Validate environment
: "${ENROLLMENT_SERVICE_ID:?Missing ENROLLMENT_SERVICE_ID}"
: "${ENROLLMENT_ENDPOINT:?Missing ENROLLMENT_ENDPOINT}"
: "${ENROLLMENT_CREDENTIALS_JSON:?Missing ENROLLMENT_CREDENTIALS_JSON}"
: "${ENROLLMENT_HOSTNAME:?Missing ENROLLMENT_HOSTNAME}"

# Parse credentials
if ! command -v jq &> /dev/null; then
    echo "✗ Error: jq is required but not installed" >&2
    exit 1
fi

USERNAME=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.username // empty')
PASSWORD=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.password // empty')

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
    echo "✗ Error: Missing username or password" >&2
    exit 2
fi

# Step 1: Login to Flight Control
echo "Logging into Flight Control..."
if ! flightctl login \
    --server "$ENROLLMENT_ENDPOINT" \
    --username "$USERNAME" \
    --password "$PASSWORD" 2>/dev/null; then
    echo "✗ Login failed: Invalid credentials" >&2
    exit 2
fi

# Step 2: Get enrollment configuration
echo "Retrieving enrollment configuration..."
if ! flightctl get enrollment-config \
    --output /tmp/flightctl-enrollment.json 2>/dev/null; then
    echo "✗ Failed to retrieve enrollment configuration" >&2
    exit 3
fi

# Step 3: Enroll device
echo "Enrolling device: $ENROLLMENT_HOSTNAME..."
if ! DEVICE_ID=$(flightctl enroll \
    --config /tmp/flightctl-enrollment.json \
    --hostname "$ENROLLMENT_HOSTNAME" \
    --format json 2>/dev/null | jq -r '.deviceId'); then
    echo "✗ Enrollment failed" >&2
    rm -f /tmp/flightctl-enrollment.json
    exit 1
fi

# Cleanup
rm -f /tmp/flightctl-enrollment.json

echo "✓ Successfully enrolled into Flight Control - Device ID: $DEVICE_ID"

# Output device URL for plugin to display
echo "DEVICE_URL: ${ENROLLMENT_ENDPOINT}/devices/${DEVICE_ID}"

exit 0
```

---

## API Versioning

This API is version 1.0. Future versions may add additional environment variables or output formats but will maintain backward compatibility for existing variables.

**Breaking changes** (requiring version bump):
- Removal of environment variables
- Changes to exit code meanings
- Changes to execution context (user, working directory)
- Changes to `DEVICE_URL:` output format

**Non-breaking changes** (no version bump):
- Addition of new optional environment variables
- Addition of new exit codes
- Addition of new optional output formats
- Documentation clarifications

---

## Support and Troubleshooting

### Common Issues

**Issue**: Script fails with "Permission denied"
- **Solution**: Ensure script has execute permission (`chmod +x`)

**Issue**: Script hangs indefinitely
- **Solution**: Implement timeouts in network calls; script will be killed after 5 minutes

**Issue**: Credentials not parsed correctly
- **Solution**: Validate JSON parsing with `jq`; check credentialsSchema matches expected format

**Issue**: Service enrollment fails with network error
- **Solution**: Verify ENROLLMENT_ENDPOINT is reachable; check network configuration in wizard

**Issue**: Device URL not displayed as hyperlink
- **Solution**: Ensure output format is exactly `DEVICE_URL: <url>` with valid http/https URL

### Debugging
Enable verbose logging by checking for the `ENROLLMENT_LOG_FILE` environment variable:

```bash
if [ -n "${ENROLLMENT_LOG_FILE:-}" ]; then
    # Redirect all output to log file
    exec > >(tee -a "$ENROLLMENT_LOG_FILE")
    exec 2>&1
    set -x  # Enable bash debugging
fi
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-27 | Initial API specification with device URL support |
