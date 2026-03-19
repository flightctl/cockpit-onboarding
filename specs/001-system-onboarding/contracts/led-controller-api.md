# LED Controller Tool API Contract

**Version**: 1.0
**Date**: 2025-10-27
**Purpose**: Define the interface for LED indicator control tools used by the Cockpit System Onboarding plugin

## Overview

The LED controller tool is a user-provided executable that controls visual status indicators (LEDs) on the system hardware. The plugin calls this tool at various stages of the onboarding process to provide visual feedback when the user cannot see the Cockpit web UI (e.g., during network reconfiguration or reboot).

## Design Rationale

LED hardware and control methods vary significantly across hardware platforms:
- **GPIO pins** (Raspberry Pi, embedded systems)
- **I2C/SPI LEDs** (custom hardware)
- **USB-controlled LEDs** (external indicators)
- **System LEDs** (front panel indicators on servers)

Additionally, LED patterns (blink speed, color, brightness) are user preferences. Therefore, the plugin delegates LED control to an external configurable tool rather than implementing hardware-specific logic.

---

## Tool Invocation

### Command-line Interface

```bash
<led-tool-path> <state>
```

**Parameters**:
- `<led-tool-path>`: Absolute path to the LED control executable (configured in config.json)
- `<state>`: LED state argument (configured mapping in config.json)

**Example**:
```bash
/usr/local/bin/led-control ready
/usr/local/bin/led-control success
/usr/local/bin/led-control off
```

---

## LED States

The plugin recognizes the following LED states and calls the tool at appropriate times:

| State | When Called | Recommended Visual Pattern | Description |
|-------|-------------|----------------------------|-------------|
| `ready` | When wizard UI is first loaded | Slow blink (500ms on/off) | Indicates system is ready for onboarding |
| `in-progress` | User navigating through wizard steps | Pulsing or breathing pattern | Indicates wizard is in progress |
| `applying` | When applying configuration changes | Fast blink (100ms on/off) | Indicates system is applying changes |
| `success` | When onboarding completes successfully | Solid on | Indicates success, system ready |
| `error` | When an error occurs during onboarding | Rapid blink or different color | Indicates error, user intervention needed |
| `off` | When onboarding is cancelled or exited | LED off | Turn off LED |

**Note**: The visual patterns are **recommendations only**. Tool implementers may use different patterns based on their hardware capabilities and preferences.

---

## State Argument Mapping

The state argument passed to the tool is configurable in `/etc/cockpit/system-onboarding/config.json`:

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

This allows customization of state arguments. For example:
```json
{
  "states": {
    "ready": "slow-blink",
    "in-progress": "pulse",
    "applying": "fast-blink",
    "success": "solid-green",
    "error": "solid-red",
    "off": "turn-off"
  }
}
```

---

## Exit Codes

The tool must return an exit code to indicate success or failure:

| Exit Code | Meaning | Plugin Behavior |
|-----------|---------|-----------------|
| `0` | Success - LED state changed | Continue onboarding normally |
| `1` | Graceful failure - LED hardware unavailable | Log warning, continue onboarding (LED control is optional) |
| `2-255` | Error - configuration or other problem | Log error, continue onboarding (LED control is optional) |

**Important**: The plugin treats LED control as **optional**. If the tool fails, the plugin will log the error but will NOT halt the onboarding process. This ensures that onboarding can complete even on systems without LED hardware.

---

## Standard Output and Standard Error

### Standard Output (stdout)
The tool MAY output informative messages to stdout. These messages will be logged by the plugin but not displayed to the user.

**Example**:
```bash
echo "LED set to slow blink pattern"
```

### Standard Error (stderr)
The tool SHOULD output error messages to stderr. These will be logged by the plugin.

**Example**:
```bash
echo "Warning: GPIO hardware not available, using fallback" >&2
```

---

## Execution Environment

### User Context
- **User**: `onboarding` (the temporary user created by the systemd setup service)
- **Privileges**: May require sudo for GPIO access (sudoers configuration should allow)

### Working Directory
The tool is executed with the working directory set to the onboarding user's home directory:
```
/home/onboarding
```

### Timeout
- **Default**: 5 seconds
- **Behavior**: If the tool takes longer than 5 seconds, it will be terminated with SIGTERM

### Environment Variables
No special environment variables are set. The tool should rely only on its command-line argument.

---

## Tool Implementation Examples

### Example 1: GPIO-based LED Control (Bash)

```bash
#!/bin/bash
# /usr/local/bin/led-control
# GPIO-based LED control for Raspberry Pi (BCM pin 17)

GPIO_PIN=17
GPIO_PATH="/sys/class/gpio/gpio${GPIO_PIN}"
BLINK_PID_FILE="/var/run/led-blink.pid"

# Setup GPIO pin
setup_gpio() {
    if [ ! -d "$GPIO_PATH" ]; then
        echo "$GPIO_PIN" > /sys/class/gpio/export 2>/dev/null || true
        sleep 0.1
    fi
    if [ -d "$GPIO_PATH" ]; then
        echo "out" > "$GPIO_PATH/direction" 2>/dev/null || true
    else
        echo "Warning: GPIO pin $GPIO_PIN not available" >&2
        return 1
    fi
}

# Stop any existing blink process
stop_blink() {
    if [ -f "$BLINK_PID_FILE" ]; then
        kill $(cat "$BLINK_PID_FILE") 2>/dev/null || true
        rm -f "$BLINK_PID_FILE"
    fi
}

# Check if GPIO hardware is available
if ! setup_gpio; then
    echo "LED hardware not available" >&2
    exit 1  # Graceful failure
fi

# Stop any existing blink
stop_blink

# Handle state
case "$1" in
    ready|slow-blink)
        # Slow blink (500ms on, 500ms off) in background
        (
            while true; do
                echo 1 > "$GPIO_PATH/value"
                sleep 0.5
                echo 0 > "$GPIO_PATH/value"
                sleep 0.5
            done
        ) &
        echo $! > "$BLINK_PID_FILE"
        echo "LED set to slow blink"
        ;;

    in-progress|pulse)
        # Pulsing effect (simple implementation: medium blink)
        (
            while true; do
                echo 1 > "$GPIO_PATH/value"
                sleep 0.3
                echo 0 > "$GPIO_PATH/value"
                sleep 0.3
            done
        ) &
        echo $! > "$BLINK_PID_FILE"
        echo "LED set to pulse"
        ;;

    applying|fast-blink)
        # Fast blink (100ms on, 100ms off)
        (
            while true; do
                echo 1 > "$GPIO_PATH/value"
                sleep 0.1
                echo 0 > "$GPIO_PATH/value"
                sleep 0.1
            done
        ) &
        echo $! > "$BLINK_PID_FILE"
        echo "LED set to fast blink"
        ;;

    success|solid)
        # Solid on
        echo 1 > "$GPIO_PATH/value"
        echo "LED set to solid on"
        ;;

    error|rapid-blink)
        # Very fast blink (50ms on, 50ms off)
        (
            while true; do
                echo 1 > "$GPIO_PATH/value"
                sleep 0.05
                echo 0 > "$GPIO_PATH/value"
                sleep 0.05
            done
        ) &
        echo $! > "$BLINK_PID_FILE"
        echo "LED set to rapid blink (error)"
        ;;

    off|turn-off)
        # Turn off LED
        echo 0 > "$GPIO_PATH/value"
        echo "LED turned off"
        ;;

    *)
        echo "Unknown state: $1" >&2
        exit 2
        ;;
esac

exit 0
```

### Example 2: systemd-based LED Triggers (Bash)

```bash
#!/bin/bash
# /usr/local/bin/led-control
# Uses Linux LED subsystem (common on embedded systems)

LED_NAME="led0"  # System-specific LED name
LED_PATH="/sys/class/leds/${LED_NAME}"

# Check if LED is available
if [ ! -d "$LED_PATH" ]; then
    echo "LED $LED_NAME not found in /sys/class/leds/" >&2
    exit 1  # Graceful failure
fi

# Set LED brightness and trigger
set_led() {
    local trigger="$1"
    local brightness="$2"

    echo "$trigger" > "$LED_PATH/trigger" 2>/dev/null || true
    if [ -n "$brightness" ]; then
        echo "$brightness" > "$LED_PATH/brightness" 2>/dev/null || true
    fi
}

case "$1" in
    ready)
        set_led "timer" ""
        echo 500 > "$LED_PATH/delay_on"
        echo 500 > "$LED_PATH/delay_off"
        ;;
    in-progress)
        set_led "heartbeat" ""
        ;;
    applying)
        set_led "timer" ""
        echo 100 > "$LED_PATH/delay_on"
        echo 100 > "$LED_PATH/delay_off"
        ;;
    success)
        set_led "none" "255"
        ;;
    error)
        set_led "timer" ""
        echo 50 > "$LED_PATH/delay_on"
        echo 50 > "$LED_PATH/delay_off"
        ;;
    off)
        set_led "none" "0"
        ;;
    *)
        echo "Unknown state: $1" >&2
        exit 2
        ;;
esac

exit 0
```

### Example 3: Python with RGB LED Control

```python
#!/usr/bin/env python3
"""
LED control tool for RGB LED via I2C
Requires: adafruit-circuitpython-neopixel (or similar library)
"""

import sys
import time
import signal

try:
    import board
    import neopixel
except ImportError:
    print("Error: Required libraries not installed", file=sys.stderr)
    sys.exit(1)

# Configuration
LED_PIN = board.D18
LED_COUNT = 1
LED_BRIGHTNESS = 0.2

try:
    pixels = neopixel.NeoPixel(LED_PIN, LED_COUNT, brightness=LED_BRIGHTNESS)
except Exception as e:
    print(f"Error: LED hardware not available: {e}", file=sys.stderr)
    sys.exit(1)

def blink(color, on_time, off_time, duration=None):
    """Blink LED with specified color and timing"""
    start = time.time()
    while True:
        pixels.fill(color)
        time.sleep(on_time)
        pixels.fill((0, 0, 0))
        time.sleep(off_time)

        if duration and (time.time() - start) > duration:
            break

def signal_handler(sig, frame):
    """Clean up on interrupt"""
    pixels.fill((0, 0, 0))
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Parse state argument
state = sys.argv[1] if len(sys.argv) > 1 else ""

if state in ("ready", "slow-blink"):
    print("LED: Slow blink (green)")
    blink((0, 255, 0), 0.5, 0.5)

elif state in ("in-progress", "pulse"):
    print("LED: Pulse (blue)")
    blink((0, 0, 255), 0.3, 0.3)

elif state in ("applying", "fast-blink"):
    print("LED: Fast blink (yellow)")
    blink((255, 255, 0), 0.1, 0.1)

elif state in ("success", "solid"):
    print("LED: Solid green")
    pixels.fill((0, 255, 0))

elif state in ("error", "rapid-blink"):
    print("LED: Rapid blink (red)")
    blink((255, 0, 0), 0.05, 0.05)

elif state in ("off", "turn-off"):
    print("LED: Off")
    pixels.fill((0, 0, 0))

else:
    print(f"Unknown state: {state}", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
```

---

## Packaging and Installation

### As Part of System Image
LED control tools are typically included in the system image for specific hardware platforms. They should be:
1. Installed to `/usr/local/bin/` or `/usr/bin/`
2. Made executable (`chmod +x`)
3. Configured in the default config file (`/usr/share/cockpit/system-onboarding/config.json`)

### Separate RPM Package
For general-purpose images, LED tools can be packaged as optional RPM packages:

```spec
Name:           led-control-gpio
Version:        1.0.0
Summary:        GPIO-based LED control for Cockpit System Onboarding

%description
Provides GPIO-based LED control tool for use with Cockpit System Onboarding plugin.

%install
install -D -m 0755 led-control %{buildroot}/usr/local/bin/led-control

%files
/usr/local/bin/led-control

%post
# Configure systemd-onboarding to use this tool
if [ -f /etc/cockpit/system-onboarding/config.json ]; then
    # Update config.json to enable LED and set tool path
    # (Use jq or sed to modify JSON)
fi
```

---

## Testing

### Manual Testing
Test the LED tool with all supported states:

```bash
#!/bin/bash
# test-led-control.sh - Test LED control tool

LED_TOOL="/usr/local/bin/led-control"

echo "Testing LED control tool: $LED_TOOL"
echo

for state in ready in-progress applying success error off; do
    echo "Testing state: $state"
    if ! "$LED_TOOL" "$state"; then
        echo "ERROR: Failed with state $state (exit code: $?)"
    fi
    sleep 2
done

echo "Test complete"
```

### Hardware Verification
1. **Check hardware availability**: Ensure GPIO/I2C/LED hardware is accessible
2. **Verify permissions**: Ensure onboarding user can access hardware (via sudo if necessary)
3. **Test blink patterns**: Visually verify that LED patterns are distinct and recognizable
4. **Test graceful degradation**: Verify tool exits with code 1 when hardware is unavailable

---

## Security and Permissions

### GPIO Access
GPIO access typically requires root privileges or membership in the `gpio` group:

```bash
# Option 1: Grant gpio group access
usermod -aG gpio onboarding

# Option 2: Use sudo (configured in sudoers.d/cockpit-system-onboarding)
# onboarding ALL=(ALL) NOPASSWD: /usr/local/bin/led-control
```

### Sudoers Configuration
If the LED tool requires root privileges, add to `/etc/sudoers.d/cockpit-system-onboarding`:

```sudoers
onboarding ALL=(ALL) NOPASSWD: /usr/local/bin/led-control *
```

Then update the config to invoke with sudo:
```json
{
  "led": {
    "tool": "/usr/bin/sudo /usr/local/bin/led-control"
  }
}
```

---

## Troubleshooting

### Common Issues

**Issue**: LED tool fails with "Permission denied"
- **Solution**: Check GPIO/I2C permissions; add onboarding user to `gpio` group or use sudo

**Issue**: LED does not blink as expected
- **Solution**: Verify GPIO pin number matches hardware; check LED wiring

**Issue**: Tool works manually but fails when called by plugin
- **Solution**: Check that tool path is absolute in config.json; verify permissions for onboarding user

**Issue**: Blink process doesn't stop when new state is set
- **Solution**: Implement proper cleanup in tool (kill background processes)

### Debugging
Enable verbose logging in the LED tool:

```bash
#!/bin/bash
# Enable debug mode
DEBUG="${DEBUG:-0}"

if [ "$DEBUG" = "1" ]; then
    set -x
    exec 2>> /var/log/led-control.log
fi

# ... rest of tool
```

Test with debug enabled:
```bash
DEBUG=1 /usr/local/bin/led-control ready
```

---

## API Versioning

This API is version 1.0. Future versions will maintain backward compatibility for existing states.

**Breaking changes** (requiring version bump):
- Removal of LED states
- Changes to exit code meanings
- Changes to execution environment

**Non-breaking changes** (no version bump):
- Addition of new LED states
- Documentation clarifications

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-27 | Initial API specification |
