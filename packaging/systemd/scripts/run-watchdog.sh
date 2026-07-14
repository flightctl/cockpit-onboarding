#!/bin/bash
# run-watchdog.sh - Restricted wrapper for arming the connectivity watchdog
# via a transient systemd timer. Called through sudo from the onboarding
# cockpit plugin.
#
# Usage: run-watchdog.sh <timeout-seconds> <test-host>
set -euo pipefail

# shellcheck source=common.sh
. /usr/libexec/flightctl-onboarding/common.sh

WATCHDOG_STATE_FILE="${ONBOARDING_MARKER_DIR}/.watchdog-active"
ROLLBACK_SCRIPT="/usr/libexec/flightctl-onboarding/watchdog-rollback.sh"

if [ $# -ne 2 ]; then
    echo "Usage: run-watchdog.sh <timeout-seconds> <test-host>" >&2
    exit 1
fi

TIMEOUT="$1"
TEST_HOST="$2"

if ! [[ "$TIMEOUT" =~ ^[0-9]+$ ]] || [ "$TIMEOUT" -lt 60 ] || [ "$TIMEOUT" -gt 1800 ]; then
    echo "Error: timeout must be a number between 60 and 1800" >&2
    exit 1
fi

if ! [[ "$TEST_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
    echo "Error: invalid test host: $TEST_HOST" >&2
    exit 1
fi

echo -n "$TEST_HOST" > "$WATCHDOG_STATE_FILE"

exec systemd-run \
    --on-active="${TIMEOUT}s" \
    --unit=flightctl-onboarding-watchdog \
    --description="Onboarding connectivity watchdog" \
    --property=ProtectHome=yes \
    --property=PrivateTmp=yes \
    --property=ProtectKernelModules=yes \
    --property=ProtectControlGroups=yes \
    --property=RestrictSUIDSGID=yes \
    --property=ProtectClock=yes \
    --property=ProtectHostname=yes \
    --property=RestrictRealtime=yes \
    --property=LockPersonality=yes \
    "$ROLLBACK_SCRIPT"
