#!/bin/bash
# check-connectivity.sh - Verify network reachability to one or more hosts.
#
# Performs a layered check per host:
#   1. DNS resolution (skipped for IP addresses)
#   2. ICMP ping
#   3. TCP connect fallback (if ping fails)
#
# Output uses the STEP:/OK:/ERROR:/INFO: streaming protocol so callers
# (both the TypeScript UI via createStreamParser and apply-and-enroll.sh)
# can parse progress.
#
# Exit codes:
#   0 - All hosts passed (or reachability failed but --required was not set)
#   1 - DNS resolution failed (not retryable without network change)
#   2 - Reachability failed (ping + TCP both failed) with --required
#
# Usage:
#   check-connectivity.sh --hosts <host1>[,<host2>] --interface <iface> \
#       [--port <port>] [--required]
set -euo pipefail

HOSTS=""
IFACE=""
PORT="443"
REQUIRED=false
PING_TIMEOUT="10"
PING_WAIT="5"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --hosts)        HOSTS="$2"; shift 2 ;;
        --interface)    IFACE="$2"; shift 2 ;;
        --port)         PORT="$2"; shift 2 ;;
        --ping-timeout) PING_TIMEOUT="$2"; shift 2 ;;
        --ping-wait)    PING_WAIT="$2"; shift 2 ;;
        --required)     REQUIRED=true; shift ;;
        *)
            echo "ERROR: Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

if [ -z "$HOSTS" ]; then
    echo "ERROR: --hosts is required" >&2
    exit 1
fi

if [ -z "$IFACE" ]; then
    echo "ERROR: --interface is required" >&2
    exit 1
fi

if [[ ! "$IFACE" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "ERROR: Invalid interface name: $IFACE" >&2
    exit 1
fi

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo "ERROR: Invalid port: $PORT" >&2
    exit 1
fi

is_ip_address() {
    [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || [[ "$1" =~ ^[0-9a-fA-F:]+$ ]]
}

resolve_dns() {
    local host="$1"

    echo "STEP: Resolving ${host} via DNS (interface ${IFACE})"
    if systemctl is-active --quiet systemd-resolved 2>/dev/null; then
        if resolvectl query "--interface=${IFACE}" "$host" >/dev/null 2>&1; then
            echo "OK: DNS resolved ${host}"
            return 0
        fi
    fi
    if getent hosts "$host" >/dev/null 2>&1; then
        echo "OK: DNS resolved ${host}"
        return 0
    fi
    echo "ERROR: DNS resolution failed for ${host}"
    return 1
}

check_ping() {
    local host="$1"

    echo "STEP: Pinging ${host} via ${IFACE}"
    if timeout "$PING_TIMEOUT" ping -c 1 -W "$PING_WAIT" -I "$IFACE" "$host" >/dev/null 2>&1; then
        echo "OK: Ping succeeded for ${host}"
        return 0
    fi
    return 1
}

check_tcp() {
    local host="$1"
    local port="$2"

    echo "STEP: TCP connect to ${host}:${port}"
    if timeout "$PING_TIMEOUT" bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" 2>/dev/null; then
        echo "OK: TCP connect succeeded to ${host}:${port}"
        return 0
    fi
    return 1
}

worst_rc=0

IFS=',' read -ra HOST_LIST <<< "$HOSTS"
for host in "${HOST_LIST[@]}"; do
    host=$(echo "$host" | xargs)
    if [ -z "$host" ]; then
        continue
    fi

    if is_ip_address "$host"; then
        echo "INFO: ${host} is an IP address, skipping DNS resolution"
    else
        if ! resolve_dns "$host"; then
            exit 1
        fi
    fi

    if check_ping "$host"; then
        continue
    fi

    echo "INFO: Ping failed for ${host}, trying TCP connect fallback"
    if check_tcp "$host" "$PORT"; then
        continue
    fi

    if [ "$REQUIRED" = true ]; then
        echo "ERROR: ${host} is unreachable (ping and TCP connect to port ${PORT} both failed)"
        worst_rc=2
    else
        echo "INFO: ${host} is unreachable but connectivity is not required, continuing"
    fi
done

exit "$worst_rc"
