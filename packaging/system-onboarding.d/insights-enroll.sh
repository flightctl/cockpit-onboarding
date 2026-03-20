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
