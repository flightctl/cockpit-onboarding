#!/bin/bash
# Create temporary onboarding user for initial system access
# Part of flightctl-onboarding first-boot setup

set -e

# shellcheck source=common.sh
. /usr/libexec/flightctl-onboarding/common.sh

# Create onboarding user with no password (pam_succeed_if allows login)
if ! id onboarding >/dev/null 2>&1; then
    useradd -m -s /bin/bash -c "System Onboarding User" onboarding

    ONBOARDING_PASSWORD=$(load_config '.onboardingUser.password' '')
    if [ -n "$ONBOARDING_PASSWORD" ]; then
        echo "onboarding:$ONBOARDING_PASSWORD" | chpasswd
        echo "Set password for onboarding user"
    else
        passwd -d onboarding
        echo "Created onboarding user with passwordless login"
    fi
else
    echo "Onboarding user already exists"
fi

# Block SSH access for the onboarding user (passwordless account must not be reachable via SSH)
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/50-deny-onboarding.conf <<EOF
DenyUsers onboarding
EOF
chmod 0644 /etc/ssh/sshd_config.d/50-deny-onboarding.conf
systemctl reload sshd 2>/dev/null || systemctl reload ssh 2>/dev/null || true
echo "Blocked SSH access for onboarding user"

# Ensure state directory is writable by onboarding user (for completion marker)
mkdir -p /var/lib/flightctl-onboarding
chmod 0700 /var/lib/flightctl-onboarding
chown onboarding:onboarding /var/lib/flightctl-onboarding

# Configure Cockpit for onboarding access.
# Track which settings we add so cleanup only reverts our changes.
mkdir -p /etc/cockpit
COCKPIT_CONF="/etc/cockpit/cockpit.conf"
COCKPIT_MODIFIED="${ONBOARDING_MARKER_DIR}/.cockpit-conf-modified"
: > "$COCKPIT_MODIFIED"

ensure_webservice_section() {
    if [ ! -f "$COCKPIT_CONF" ]; then
        printf '[WebService]\n' > "$COCKPIT_CONF"
    elif ! grep -q '^\[WebService\]' "$COCKPIT_CONF"; then
        printf '\n[WebService]\n' >> "$COCKPIT_CONF"
    fi
}

add_cockpit_setting() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}" "$COCKPIT_CONF" 2>/dev/null; then
        echo "Cockpit ${key} already set, skipping"
        return
    fi
    ensure_webservice_section
    sed -i "/^\[WebService\]/a ${key} = ${value}" "$COCKPIT_CONF"
    echo "${key}" >> "$COCKPIT_MODIFIED"
    echo "Added ${key} = ${value} to Cockpit configuration"
}

add_cockpit_setting "AllowUnencrypted" "true"
add_cockpit_setting "LoginTo" "false"

# Install module overrides if hideModules=true
HIDE_MODULES=$(load_config '.hideModules' 'true')
if [ "$HIDE_MODULES" = "true" ]; then
    echo "Installing module overrides to hide other Cockpit modules"
    mkdir -p ~onboarding/.config/cockpit

    # Copy all override files from packaging directory
    if [ -d /usr/share/cockpit/system-onboarding/overrides ]; then
        cp /usr/share/cockpit/system-onboarding/overrides/*.override.json ~onboarding/.config/cockpit/ 2>/dev/null || true
        chown -R onboarding:onboarding ~onboarding/.config
        echo "Module overrides installed"
    else
        echo "Warning: Module override files not found"
    fi
else
    echo "Module hiding is disabled, all Cockpit modules will be visible"
fi

echo "Onboarding user setup complete"
