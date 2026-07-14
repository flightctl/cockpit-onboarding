#!/bin/bash
# run-apply-enroll.sh - Restricted wrapper for launching apply-and-enroll.sh
# via systemd-run. Called through sudo from the onboarding cockpit plugin.
#
# This wrapper replaces a broad "systemd-run *" sudoers entry with a
# constrained invocation that only permits running apply-and-enroll.sh
# with validated arguments.
#
# Usage: run-apply-enroll.sh <params-json-file>
set -euo pipefail

APPLY_SCRIPT="/usr/libexec/flightctl-onboarding/apply-and-enroll.sh"

if [ $# -ne 1 ]; then
    echo "Usage: run-apply-enroll.sh <params-json-file>" >&2
    exit 1
fi

PARAMS_FILE="$1"

if [ ! -f "$PARAMS_FILE" ]; then
    echo "Error: params file does not exist or is not a regular file: $PARAMS_FILE" >&2
    exit 1
fi

UNIT_NAME="flightctl-onboarding-apply-$(date +%s%N)"

# --no-block: return after queuing the unit. Without it, systemd-run waits for
# the job over D-Bus, which fails when invoked via sudo from cockpit-bridge
# ("D-Bus connection terminated while waiting for jobs").
exec systemd-run \
    --no-block \
    "--unit=${UNIT_NAME}" \
    '--property=Type=oneshot' \
    '--remain-after-exit' \
    '--property=Environment=HOME=/root' \
    '--' \
    "$APPLY_SCRIPT" \
    "$PARAMS_FILE"
