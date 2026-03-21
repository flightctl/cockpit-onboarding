#!/bin/bash
# insights-enroll.sh - Enroll device with Red Hat Insights via rhc connect
#
# Cockpit System Onboarding enrollment script.
# Reads credentials from ENROLLMENT_CREDENTIALS_JSON environment variable.
#
# Expected credential fields (from credentialsSchema):
#   organizationId          (required) - Red Hat organization ID
#   activationKey           (required) - Activation key for registration
#   disableRemoteManagement (optional) - Boolean; disable Insights remote management
#                                        (use when Flight Control manages the device)
#
# See: specs/001-system-onboarding/contracts/enrollment-api.md
set -euo pipefail

# Load enrollment parameters from JSON file (passed as $1 by the executor).
# sudo sanitizes the environment, so env vars set via cockpit.spawn's environ
# option won't reach this script. Parameters are passed via a temp file instead.
if [ -n "${1:-}" ] && [ -f "$1" ]; then
    ENROLLMENT_SERVICE_ID=$(jq -r '.ENROLLMENT_SERVICE_ID' "$1")
    ENROLLMENT_SERVICE_NAME=$(jq -r '.ENROLLMENT_SERVICE_NAME' "$1")
    ENROLLMENT_ENDPOINT=$(jq -r '.ENROLLMENT_ENDPOINT' "$1")
    ENROLLMENT_CREDENTIALS_JSON=$(jq -r '.ENROLLMENT_CREDENTIALS_JSON' "$1")
    ENROLLMENT_HOSTNAME=$(jq -r '.ENROLLMENT_HOSTNAME' "$1")
    ENROLLMENT_INTERFACE=$(jq -r '.ENROLLMENT_INTERFACE' "$1")
    export ENROLLMENT_SERVICE_ID ENROLLMENT_SERVICE_NAME ENROLLMENT_ENDPOINT
    export ENROLLMENT_CREDENTIALS_JSON ENROLLMENT_HOSTNAME ENROLLMENT_INTERFACE
    rm -f "$1"
fi

# Verify required tools
for cmd in jq rhc; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "Error: '$cmd' is not installed" >&2
        exit 1
    fi
done

# Parse credentials from environment
ORG_ID=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.organizationId // empty') || {
    echo "Error: failed to parse organizationId from credentials" >&2
    exit 2
}

ACTIVATION_KEY=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.activationKey // empty') || {
    echo "Error: failed to parse activationKey from credentials" >&2
    exit 2
}

DISABLE_MGMT=$(echo "$ENROLLMENT_CREDENTIALS_JSON" | jq -r '.disableRemoteManagement // false')

# Validate required fields
if [ -z "$ORG_ID" ] || [ -z "$ACTIVATION_KEY" ]; then
    echo "Error: organizationId and activationKey are required" >&2
    exit 2
fi

# Build rhc connect command
echo "Registering with Red Hat Insights..."
RHC_ARGS=(connect --organization "$ORG_ID" --activation-key "$ACTIVATION_KEY")

if [ "$DISABLE_MGMT" = "true" ]; then
    if rhc connect --help 2>&1 | grep -q -- '--disable-feature'; then
        RHC_ARGS+=(--disable-feature remote-management)
        echo "Remote management will be disabled (managed by Flight Control)"
    else
        echo "Warning: --disable-feature not supported by this version of rhc, skipping" >&2
    fi
fi

# Execute enrollment
rhc "${RHC_ARGS[@]}" || {
    echo "Error: rhc connect failed" >&2
    exit 1
}

echo "Successfully enrolled with Red Hat Insights"
exit 0
