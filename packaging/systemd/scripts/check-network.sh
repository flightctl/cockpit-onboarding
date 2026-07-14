#!/bin/bash
set -euo pipefail

# Restricted arping wrapper for flightctl-onboarding.
# Only allows the two arping invocation patterns the UI actually needs,
# preventing abuse of dangerous flags (-s, -U, etc.) via the sudoers wildcard.

usage() {
    echo "Usage: $0 <mode> <interface> <ip>" >&2
    echo "  mode: check-ip | check-gateway" >&2
    exit 2
}

[[ $# -eq 3 ]] || usage

MODE="$1"
IFACE="$2"
IP="$3"

if [[ ! "$IFACE" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "Invalid interface name: $IFACE" >&2
    exit 2
fi

if [[ ! "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Invalid IPv4 address: $IP" >&2
    exit 2
fi

case "$MODE" in
    check-ip)
        exec /usr/bin/arping -D -c 3 -w 5 -I "$IFACE" "$IP"
        ;;
    check-gateway)
        exec /usr/bin/arping -c 2 -w 3 -I "$IFACE" "$IP"
        ;;
    *)
        echo "Unknown mode: $MODE" >&2
        usage
        ;;
esac
