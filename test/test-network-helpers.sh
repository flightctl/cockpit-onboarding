#!/bin/bash
# Unit tests for prefix_to_netmask() and compute_dhcp_range() from common.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$REPO_ROOT/packaging/systemd/scripts/common.sh"

PASS=0
FAIL=0

assert_eq() {
    local label="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then
        echo "  PASS: $label"
        PASS=$(( PASS + 1 ))
    else
        echo "  FAIL: $label — expected '$expected', got '$actual'"
        FAIL=$(( FAIL + 1 ))
    fi
}

# ── prefix_to_netmask ───────────────────────────────────────────────

echo "prefix_to_netmask"

assert_eq "/32" "255.255.255.255" "$(prefix_to_netmask 32)"
assert_eq "/24" "255.255.255.0"   "$(prefix_to_netmask 24)"
assert_eq "/16" "255.255.0.0"     "$(prefix_to_netmask 16)"
assert_eq "/8"  "255.0.0.0"       "$(prefix_to_netmask 8)"
assert_eq "/25" "255.255.255.128" "$(prefix_to_netmask 25)"
assert_eq "/20" "255.255.240.0"   "$(prefix_to_netmask 20)"
assert_eq "/28" "255.255.255.240" "$(prefix_to_netmask 28)"
assert_eq "/1"  "128.0.0.0"       "$(prefix_to_netmask 1)"

# ── compute_dhcp_range — default ethernet (192.168.100.1/24, 40) ────

echo ""
echo "compute_dhcp_range: ethernet defaults (192.168.100.1/24, size 40)"

compute_dhcp_range "192.168.100.1" 24 40
assert_eq "start"   "192.168.100.2" "$DHCP_RANGE_START"
assert_eq "end"     "192.168.100.41" "$DHCP_RANGE_END"
assert_eq "netmask" "255.255.255.0"  "$DHCP_NETMASK"

# ── compute_dhcp_range — default wifi AP (10.42.0.1/24, 40) ─────────

echo ""
echo "compute_dhcp_range: wifi AP defaults (10.42.0.1/24, size 40)"

compute_dhcp_range "10.42.0.1" 24 40
assert_eq "start"   "10.42.0.2"    "$DHCP_RANGE_START"
assert_eq "end"     "10.42.0.41"    "$DHCP_RANGE_END"
assert_eq "netmask" "255.255.255.0" "$DHCP_NETMASK"

# ── compute_dhcp_range — /16 network ────────────────────────────────

echo ""
echo "compute_dhcp_range: 172.16.0.1/16, size 100"

compute_dhcp_range "172.16.0.1" 16 100
assert_eq "start"   "172.16.0.2"  "$DHCP_RANGE_START"
assert_eq "end"     "172.16.0.101" "$DHCP_RANGE_END"
assert_eq "netmask" "255.255.0.0"  "$DHCP_NETMASK"

# ── compute_dhcp_range — small range ────────────────────────────────

echo ""
echo "compute_dhcp_range: 10.0.0.1/28, size 5"

compute_dhcp_range "10.0.0.1" 28 5
assert_eq "start"   "10.0.0.2"      "$DHCP_RANGE_START"
assert_eq "end"     "10.0.0.6"      "$DHCP_RANGE_END"
assert_eq "netmask" "255.255.255.240" "$DHCP_NETMASK"

# ── compute_dhcp_range — range size 1 ──────────────────────────────

echo ""
echo "compute_dhcp_range: 192.168.1.1/24, size 1"

compute_dhcp_range "192.168.1.1" 24 1
assert_eq "start"   "192.168.1.2"  "$DHCP_RANGE_START"
assert_eq "end"     "192.168.1.2"  "$DHCP_RANGE_END"
assert_eq "netmask" "255.255.255.0" "$DHCP_NETMASK"

# ── compute_dhcp_range — crosses octet boundary ────────────────────

echo ""
echo "compute_dhcp_range: 10.0.0.250/24, size 20 (crosses .255 boundary)"

compute_dhcp_range "10.0.0.250" 24 20
assert_eq "start" "10.0.0.251"  "$DHCP_RANGE_START"
assert_eq "end"   "10.0.1.14" "$DHCP_RANGE_END"

# ── Summary ─────────────────────────────────────────────────────────

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
