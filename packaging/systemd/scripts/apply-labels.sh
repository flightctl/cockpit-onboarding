#!/bin/bash
# Apply flightctl label configuration for cockpit-system-onboarding
# Called via sudo by the onboarding user
# Usage: apply-labels.sh <params-json-file>
#
# Params JSON format:
# {
#   "DEFAULT_LABELS": { "key1": "value1" },
#   "SYSTEMINFO_LABELS": { "labelKey1": "systemInfoField1" }
# }
#
# Writes:
#   /etc/flightctl/conf.d/50-cockpit-labels.yaml

set -euo pipefail

PARAMS_FILE="${1:?Usage: apply-labels.sh <params-json-file>}"

if [ ! -f "$PARAMS_FILE" ]; then
    echo "Error: params file not found: $PARAMS_FILE" >&2
    exit 1
fi

DEFAULT_LABELS=$(jq -c '.DEFAULT_LABELS // {}' "$PARAMS_FILE")
SYSTEMINFO_LABELS=$(jq -c '.SYSTEMINFO_LABELS // {}' "$PARAMS_FILE")

rm -f "$PARAMS_FILE"

if [ "$DEFAULT_LABELS" = "{}" ] && [ "$SYSTEMINFO_LABELS" = "{}" ]; then
    exit 0
fi

LABELS_DIR="/etc/flightctl/conf.d"
LABELS_FILE="${LABELS_DIR}/50-cockpit-labels.yaml"

mkdir -p "$LABELS_DIR"

TMPFILE=$(mktemp "${LABELS_FILE}.XXXXXX")

{
    if [ "$DEFAULT_LABELS" != "{}" ]; then
        echo "default-labels:"
        echo "$DEFAULT_LABELS" | jq -r 'to_entries[] | "  \(.key): \"\(.value)\""'
    fi
    if [ "$SYSTEMINFO_LABELS" != "{}" ]; then
        echo "label-from-systeminfo:"
        echo "$SYSTEMINFO_LABELS" | jq -r 'to_entries[] | "  \(.key): \(.value)"'
    fi
} > "$TMPFILE"

chmod 0600 "$TMPFILE"
mv "$TMPFILE" "$LABELS_FILE"

echo "Wrote labels config: $LABELS_FILE"
