#!/bin/bash
# Apply system-wide proxy configuration for flightctl-onboarding
# Called via sudo by the onboarding user
# Usage: apply-proxy.sh <params-json-file>
#
# Params JSON format:
# {
#   "protocol": "http",
#   "hostname": "proxy.example.com",
#   "port": 8080,
#   "username": "user",       (optional)
#   "password": "pass",       (optional)
#   "noProxy": "10.0.0.0/8"   (optional, comma-separated no-proxy hosts)
# }
#
# Writes:
#   /etc/systemd/system.conf.d/50-flightctl-onboarding-proxy.conf
#   Appends to /etc/environment
# Then runs systemctl daemon-reexec to pick up the new DefaultEnvironment.

set -euo pipefail

PARAMS_FILE="${1:?Usage: apply-proxy.sh <params-json-file>}"

if [ ! -f "$PARAMS_FILE" ]; then
    echo "Error: params file not found: $PARAMS_FILE" >&2
    exit 1
fi

PROTOCOL=$(jq -r '.protocol // "http"' "$PARAMS_FILE" | tr -d '\n\r')
PROXY_HOST=$(jq -r '.hostname // empty' "$PARAMS_FILE" | tr -d '\n\r')
PROXY_PORT=$(jq -r '.port // empty' "$PARAMS_FILE" | tr -d '\n\r')
USERNAME=$(jq -r '.username // empty' "$PARAMS_FILE" | tr -d '\n\r')
PASSWORD=$(jq -r '.password // empty' "$PARAMS_FILE" | tr -d '\n\r')
NO_PROXY_EXTRA=$(jq -r '.noProxy // empty' "$PARAMS_FILE" | tr -d '\n\r')
APPLY_FOR_HTTPS=$(jq -r '.applyForHttps // "true"' "$PARAMS_FILE" | tr -d '\n\r')

if [ -z "$PROXY_HOST" ] || [ -z "$PROXY_PORT" ]; then
    echo "Error: hostname and port are required" >&2
    exit 1
fi

# URL-encode a value for safe inclusion in a proxy URL
urlencode() {
    python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ['_URLENCODE_VAL'], safe=''), end='')" 2>/dev/null || printf '%s' "$1"
}

# Build proxy URLs: full (with credentials) for root-only configs,
# and stripped (without credentials) for world-readable /etc/environment
PROXY_URL_STRIPPED="${PROTOCOL}://${PROXY_HOST}:${PROXY_PORT}"
if [ -n "$USERNAME" ] && [ -n "$PASSWORD" ]; then
    ENCODED_USER=$(export _URLENCODE_VAL="$USERNAME"; urlencode "$USERNAME")
    ENCODED_PASS=$(export _URLENCODE_VAL="$PASSWORD"; urlencode "$PASSWORD")
    PROXY_URL="${PROTOCOL}://${ENCODED_USER}:${ENCODED_PASS}@${PROXY_HOST}:${PROXY_PORT}"
else
    PROXY_URL="$PROXY_URL_STRIPPED"
fi

# Build NO_PROXY from wizard input
NO_PROXY="${NO_PROXY_EXTRA:-}"

# Write systemd global default drop-in
SYSTEMD_DROPIN_DIR="/etc/systemd/system.conf.d"
SYSTEMD_DROPIN="${SYSTEMD_DROPIN_DIR}/50-flightctl-onboarding-proxy.conf"

mkdir -p "$SYSTEMD_DROPIN_DIR"

TMPFILE=$(mktemp "${SYSTEMD_DROPIN}.XXXXXX")
DEFAULT_ENV="\"HTTP_PROXY=${PROXY_URL}\""
if [ "$APPLY_FOR_HTTPS" = "true" ]; then
    DEFAULT_ENV="${DEFAULT_ENV} \"HTTPS_PROXY=${PROXY_URL}\""
fi
DEFAULT_ENV="${DEFAULT_ENV} \"NO_PROXY=${NO_PROXY}\""
cat > "$TMPFILE" <<EOF
[Manager]
DefaultEnvironment=${DEFAULT_ENV}
EOF
chmod 0600 "$TMPFILE"
mv "$TMPFILE" "$SYSTEMD_DROPIN"

echo "Wrote systemd proxy drop-in: $SYSTEMD_DROPIN"

# Append to /etc/environment (idempotent: remove any previous onboarding entries first)
ENV_FILE="/etc/environment"
MARKER="# flightctl-onboarding proxy"
if [ -f "$ENV_FILE" ]; then
    sed -i "/^${MARKER}$/,/^$/{ /^${MARKER}$/d; /^HTTP_PROXY=/d; /^HTTPS_PROXY=/d; /^NO_PROXY=/d; /^$/d; }" "$ENV_FILE"
else
    touch "$ENV_FILE"
fi

{
    echo "${MARKER}"
    echo "HTTP_PROXY=\"${PROXY_URL_STRIPPED}\""
    if [ "$APPLY_FOR_HTTPS" = "true" ]; then
        echo "HTTPS_PROXY=\"${PROXY_URL_STRIPPED}\""
    fi
    echo "NO_PROXY=\"${NO_PROXY}\""
} >> "$ENV_FILE"

chmod 0644 "$ENV_FILE"
echo "Updated /etc/environment with proxy settings (credentials excluded)"

# Reload systemd to pick up the new DefaultEnvironment
systemctl daemon-reexec
echo "Executed systemctl daemon-reexec"

# Clean up params file
rm -f "$PARAMS_FILE"

echo "System-wide proxy configuration applied successfully"
