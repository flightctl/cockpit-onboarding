#!/bin/bash
# Initialize LED indicator to 'ready' state
# Part of cockpit-system-onboarding first-boot setup

set -e

# shellcheck source=common.sh
. /usr/libexec/cockpit-system-onboarding/common.sh

# Check if LED control is enabled
LED_ENABLED=$(load_config '.led.enabled' 'false')
if [ "$LED_ENABLED" != "true" ]; then
    echo "LED control is disabled in configuration"
    exit 0
fi

# Get LED tool path and ready state argument
LED_TOOL=$(load_config '.led.tool' '')
LED_READY_STATE=$(load_config '.led.states.ready' 'ready')

if [ -z "$LED_TOOL" ]; then
    echo "LED tool path not configured"
    exit 0
fi

# Check if LED tool exists and is executable
if [ ! -f "$LED_TOOL" ]; then
    echo "LED tool not found: $LED_TOOL"
    echo "Continuing without LED indicator (graceful degradation)"
    exit 0
fi

if [ ! -x "$LED_TOOL" ]; then
    echo "LED tool is not executable: $LED_TOOL"
    echo "Continuing without LED indicator (graceful degradation)"
    exit 0
fi

LED_OWNER=$(stat -c '%u' "$LED_TOOL")
if [ "$LED_OWNER" != "0" ]; then
    echo "LED tool is not owned by root: $LED_TOOL"
    echo "Continuing without LED indicator (graceful degradation)"
    exit 0
fi

# Execute LED tool with 'ready' state
# Use timeout to prevent hanging if LED tool has issues
if timeout 5s "$LED_TOOL" "$LED_READY_STATE" 2>&1; then
    echo "LED set to 'ready' state"
else
    echo "LED tool execution failed or timed out"
    echo "Continuing without LED indicator (graceful degradation)"
fi

exit 0
