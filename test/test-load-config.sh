#!/bin/bash
# Unit tests for load_config() from common.sh

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

# Set up temp config files
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

# Override the config paths used by load_config
ONBOARDING_USER_CONFIG="$TEST_DIR/user-config.json"
ONBOARDING_DEFAULT_CONFIG="$TEST_DIR/default-config.json"

# ── Basic value retrieval ───────────────────────────────────────────

echo "Basic value retrieval"

cat > "$ONBOARDING_DEFAULT_CONFIG" <<'EOF'
{"network": {"wifiAp": {"password": "onboarding", "channel": 6}}}
EOF
rm -f "$ONBOARDING_USER_CONFIG"

assert_eq "string value" "onboarding" "$(load_config '.network.wifiAp.password' '')"
assert_eq "number value" "6" "$(load_config '.network.wifiAp.channel' '11')"

# ── User config overrides default config ────────────────────────────

echo ""
echo "User config overrides default config"

cat > "$ONBOARDING_DEFAULT_CONFIG" <<'EOF'
{"network": {"wifiAp": {"password": "onboarding", "channel": 6}}}
EOF
cat > "$ONBOARDING_USER_CONFIG" <<'EOF'
{"network": {"wifiAp": {"password": "custom-pass"}}}
EOF

assert_eq "user override" "custom-pass" "$(load_config '.network.wifiAp.password' '')"
assert_eq "unset in user falls through" "6" "$(load_config '.network.wifiAp.channel' '11')"

# ── Empty string is respected (not treated as missing) ──────────────

echo ""
echo "Empty string is respected"

cat > "$ONBOARDING_DEFAULT_CONFIG" <<'EOF'
{"network": {"wifiAp": {"password": "onboarding"}}}
EOF
cat > "$ONBOARDING_USER_CONFIG" <<'EOF'
{"network": {"wifiAp": {"password": ""}}}
EOF

assert_eq "empty string overrides default" "" "$(load_config '.network.wifiAp.password' 'fallback')"

# ── Missing key falls through to default config ─────────────────────

echo ""
echo "Missing key falls through"

cat > "$ONBOARDING_DEFAULT_CONFIG" <<'EOF'
{"network": {"wifiAp": {"password": "onboarding"}}}
EOF
cat > "$ONBOARDING_USER_CONFIG" <<'EOF'
{"network": {"wifiAp": {"ssidPrefix": "test-"}}}
EOF

assert_eq "missing key uses default config" "onboarding" "$(load_config '.network.wifiAp.password' '')"

# ── Null value falls through to default config ──────────────────────

echo ""
echo "Null value falls through"

cat > "$ONBOARDING_DEFAULT_CONFIG" <<'EOF'
{"network": {"wifiAp": {"password": "onboarding"}}}
EOF
cat > "$ONBOARDING_USER_CONFIG" <<'EOF'
{"network": {"wifiAp": {"password": null}}}
EOF

assert_eq "null uses default config" "onboarding" "$(load_config '.network.wifiAp.password' '')"

# ── No config files — uses built-in default ─────────────────────────

echo ""
echo "No config files uses built-in default"

rm -f "$ONBOARDING_USER_CONFIG" "$ONBOARDING_DEFAULT_CONFIG"

assert_eq "no files" "fallback-value" "$(load_config '.network.wifiAp.password' 'fallback-value')"

# ── Boolean values ──────────────────────────────────────────────────

echo ""
echo "Boolean values"

cat > "$ONBOARDING_DEFAULT_CONFIG" <<'EOF'
{"runOnce": true, "keepCockpit": false}
EOF
rm -f "$ONBOARDING_USER_CONFIG"

assert_eq "boolean true" "true" "$(load_config '.runOnce' 'false')"
assert_eq "boolean false" "false" "$(load_config '.keepCockpit' 'true')"

# ── Empty string in default config with no user config ──────────────

echo ""
echo "Empty string in default config"

cat > "$ONBOARDING_DEFAULT_CONFIG" <<'EOF'
{"network": {"wifiAp": {"interface": ""}}}
EOF
rm -f "$ONBOARDING_USER_CONFIG"

assert_eq "empty string from default" "" "$(load_config '.network.wifiAp.interface' 'fallback')"

# ── Summary ─────────────────────────────────────────────────────────

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
