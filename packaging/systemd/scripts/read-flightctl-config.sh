#!/bin/bash
# Read flightctl agent config and output parsed fields as JSON.
# Called via sudo by the onboarding user.
#
# Outputs: {"exists":true,"serverUrl":"https://...","hasCredentials":true}
# If the config file does not exist: {"exists":false,"serverUrl":null,"hasCredentials":false}
set -euo pipefail

AGENT_CONFIG="/etc/flightctl/config.yaml"

if [ ! -f "$AGENT_CONFIG" ]; then
    echo '{"exists":false,"serverUrl":null,"hasCredentials":false}'
    exit 0
fi

content=$(cat "$AGENT_CONFIG")

server_url=$(echo "$content" | sed -n 's/^[[:space:]]*server:[[:space:]]*\(\S\+\)/\1/p' | head -1)
has_creds=$(echo "$content" | grep -qE '^\s+client-certificate-data:\s+\S' && echo true || echo false)

if [ -n "$server_url" ]; then
    printf '{"exists":true,"serverUrl":"%s","hasCredentials":%s}\n' "$server_url" "$has_creds"
else
    printf '{"exists":true,"serverUrl":null,"hasCredentials":%s}\n' "$has_creds"
fi
