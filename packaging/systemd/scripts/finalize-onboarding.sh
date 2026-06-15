#!/bin/bash
set -euo pipefail

# shellcheck source=common.sh
. /usr/libexec/cockpit-system-onboarding/common.sh

MARKER_PATH="${ONBOARDING_MARKER_DIR}/.onboarding-complete"

HOSTNAME="${1:-}"

mkdir -p "${ONBOARDING_MARKER_DIR}"

cat > "${MARKER_PATH}" <<EOF
{
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "${HOSTNAME}"
}
EOF

chmod 0644 "${MARKER_PATH}"
echo "Onboarding completion marker created"
