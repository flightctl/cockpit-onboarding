#!/bin/bash
# Example enrollment script for demonstration purposes
#
# This script demonstrates the enrollment API contract and can be used
# as a template for creating custom enrollment scripts.
#
# Environment variables provided by the plugin:
# - ENROLLMENT_SERVICE_ID: Service identifier
# - ENROLLMENT_SERVICE_NAME: Human-readable service name
# - ENROLLMENT_ENDPOINT: Service endpoint URL
# - ENROLLMENT_CREDENTIALS_JSON: JSON-encoded credentials
# - ENROLLMENT_HOSTNAME: System hostname
# - ENROLLMENT_INTERFACE: Primary network interface

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Read configuration from environment
SERVICE_ID="${ENROLLMENT_SERVICE_ID}"
SERVICE_NAME="${ENROLLMENT_SERVICE_NAME}"
ENDPOINT="${ENROLLMENT_ENDPOINT}"
CREDENTIALS_JSON="${ENROLLMENT_CREDENTIALS_JSON}"
HOSTNAME="${ENROLLMENT_HOSTNAME}"
INTERFACE="${ENROLLMENT_INTERFACE}"

# Parse credentials from JSON
if ! command -v jq &> /dev/null; then
    echo "✗ Error: jq is required but not installed" >&2
    exit 1
fi

ORGANIZATION_ID=$(echo "$CREDENTIALS_JSON" | jq -r '.organizationId // empty')
ACTIVATION_KEY=$(echo "$CREDENTIALS_JSON" | jq -r '.activationKey // empty')

# Validate required credentials
if [ -z "$ORGANIZATION_ID" ] || [ -z "$ACTIVATION_KEY" ]; then
    echo "✗ Error: Missing required credentials (organizationId or activationKey)" >&2
    exit 2  # Invalid credentials
fi

# Example: Simulate enrollment process
echo "Enrolling device into $SERVICE_NAME..."
echo "Endpoint: $ENDPOINT"
echo "Hostname: $HOSTNAME"
echo "Interface: $INTERFACE"

# Step 1: Validate connection
echo "Validating connection to enrollment service..."
if ! curl --silent --fail --max-time 10 "$ENDPOINT/health" >/dev/null 2>&1; then
    echo "✗ Service unavailable at $ENDPOINT" >&2
    exit 3  # Service unavailable
fi

# Step 2: Authenticate (simulated)
echo "Authenticating with service..."
sleep 1  # Simulate API call

# In a real script, you would call the service API here
# Example:
# RESPONSE=$(curl -X POST "$ENDPOINT/api/enroll" \
#     --header "Content-Type: application/json" \
#     --data "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\",\"hostname\":\"$HOSTNAME\"}")
#
# Check authentication
# if ! echo "$RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
#     echo "✗ Authentication failed" >&2
#     exit 2  # Invalid credentials
# fi

# Step 3: Enroll device (simulated)
echo "Enrolling device..."
sleep 1  # Simulate API call

# Generate a simulated device ID
DEVICE_ID="${HOSTNAME}-$(date +%s)"

echo "✓ Successfully enrolled into $SERVICE_NAME"
echo "✓ Device ID: $DEVICE_ID"

# Output device URL for plugin to display as hyperlink
echo "DEVICE_URL: ${ENDPOINT}/devices/${DEVICE_ID}"

exit 0
