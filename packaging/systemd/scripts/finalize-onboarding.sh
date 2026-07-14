#!/bin/bash
set -euo pipefail

# shellcheck source=common.sh
. /usr/libexec/flightctl-onboarding/common.sh

MARKER_PATH="${ONBOARDING_MARKER_DIR}/.onboarding-complete"

HOSTNAME="${1:-}"

mkdir -p "${ONBOARDING_MARKER_DIR}"

jq -n \
    --arg hostname "$HOSTNAME" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{completedAt: $ts, hostname: $hostname}' > "${MARKER_PATH}"

chmod 0644 "${MARKER_PATH}"
echo "Onboarding completion marker created"
