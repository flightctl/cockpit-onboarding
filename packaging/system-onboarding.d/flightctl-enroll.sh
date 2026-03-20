#!/bin/bash
# flightctl-enroll.sh - Enroll device with Flight Control
#
# Cockpit System Onboarding enrollment script.
# Reads credentials from ENROLLMENT_CREDENTIALS_JSON and endpoint from
# ENROLLMENT_ENDPOINT environment variables.
#
# Expected credential fields (from credentialsSchema):
#   username (required) - Flight Control username
#   password (required) - Flight Control password
#
# Steps:
#   1. Login to Flight Control API
#   2. Request enrollment certificate
#   3. Install agent config
#   4. Restart flightctl-agent service
#
# See: specs/001-system-onboarding/contracts/enrollment-api.md
set -euo pipefail

AGENT_CONFIG="/etc/flightctl/config.yaml"

# Verify required tools
for cmd in jq flightctl systemctl; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "Error: '$cmd' is not installed" >&2
        exit 1
    fi
done

# Verify flightctl-agent is installed
if ! systemctl list-unit-files flightctl-agent.service | grep -q flightctl-agent; then
    echo "Error: flightctl-agent service is not installed" >&2
    echo "Hint: install the flightctl-agent package before enrolling" >&2
    exit 1
fi

# Parse credentials from environment
USERNAME=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.username // empty') || {
    echo "Error: failed to parse username from credentials" >&2
    exit 2
}

PASSWORD=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.password // empty') || {
    echo "Error: failed to parse password from credentials" >&2
    exit 2
}

# Validate required fields
if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
    echo "Error: username and password are required" >&2
    exit 2
fi

# Create isolated temp directory for flightctl client config
TMPDIR=$(mktemp -d)
chmod 700 "$TMPDIR"
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

# Step 1: Login to Flight Control API
echo "Logging into Flight Control..."
# Note: -p exposes password in /proc/PID/cmdline; unavoidable with current
# flightctl CLI. The isolated temp config dir limits exposure window.
flightctl login "$ENROLLMENT_ENDPOINT" -u "$USERNAME" -p "$PASSWORD" --config-dir "$TMPDIR" -k || {
    echo "Error: flightctl login failed" >&2
    exit 2
}

# Step 2: Request enrollment certificate
echo "Requesting enrollment certificate..."
flightctl certificate request \
    --signer=enrollment \
    --expiration=365d \
    --output=embedded \
    --config-dir "$TMPDIR" \
    -d "$TMPDIR" > "$TMPDIR/config.yaml" || {
    echo "Error: flightctl certificate request failed" >&2
    exit 1
}

# Step 3: Install agent config
echo "Installing agent configuration..."
mkdir -p "$(dirname "$AGENT_CONFIG")"
install -m 0600 "$TMPDIR/config.yaml" "$AGENT_CONFIG" || {
    echo "Error: failed to install $AGENT_CONFIG" >&2
    exit 1
}

# Step 4: Restart flightctl-agent to pick up new config
echo "Restarting flightctl-agent..."
systemctl restart flightctl-agent || {
    echo "Error: failed to restart flightctl-agent" >&2
    exit 1
}

echo "Successfully enrolled with Flight Control"
exit 0
