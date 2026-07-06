#!/bin/bash
# Create temporary onboarding user for initial system access
# Part of cockpit-system-onboarding first-boot setup

set -e

# shellcheck source=common.sh
. /usr/libexec/cockpit-system-onboarding/common.sh

# Create onboarding user with no password (pam_succeed_if allows login)
if ! id onboarding >/dev/null 2>&1; then
    useradd -m -s /bin/bash -c "System Onboarding User" onboarding
    echo "Created onboarding user"
else
    echo "Onboarding user already exists"
fi
passwd -d onboarding  # Remove password (required for Cockpit passwordless login)

# Block SSH access for the onboarding user (passwordless account must not be reachable via SSH)
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/50-deny-onboarding.conf <<EOF
DenyUsers onboarding
EOF
chmod 0644 /etc/ssh/sshd_config.d/50-deny-onboarding.conf
systemctl reload sshd 2>/dev/null || systemctl reload ssh 2>/dev/null || true
echo "Blocked SSH access for onboarding user"

# Ensure state directory is writable by onboarding user (for completion marker)
mkdir -p /var/lib/cockpit-system-onboarding
chmod 0700 /var/lib/cockpit-system-onboarding
chown onboarding:onboarding /var/lib/cockpit-system-onboarding

# Install sudoers file for system configuration permissions
if [ -f /usr/share/cockpit/system-onboarding/sudoers.conf ]; then
    cp /usr/share/cockpit/system-onboarding/sudoers.conf /etc/sudoers.d/cockpit-system-onboarding
    chmod 0440 /etc/sudoers.d/cockpit-system-onboarding
    echo "Installed sudoers configuration"
fi

# Install polkit rule for D-Bus service access (hostname, network, time)
if [ -f /usr/share/cockpit/system-onboarding/49-cockpit-system-onboarding.rules ]; then
    cp /usr/share/cockpit/system-onboarding/49-cockpit-system-onboarding.rules /etc/polkit-1/rules.d/
    echo "Installed polkit rules"
fi

# Configure Cockpit to allow passwordless login for onboarding user
mkdir -p /etc/cockpit
if [ ! -f /etc/cockpit/cockpit.conf ]; then
    cat > /etc/cockpit/cockpit.conf <<EOF
[WebService]
AllowUnencrypted = true
LoginTo = false
EOF
    echo "Created Cockpit configuration"
else
    # Add settings if not already present
    if ! grep -q "AllowUnencrypted" /etc/cockpit/cockpit.conf; then
        if grep -q '^\[WebService\]' /etc/cockpit/cockpit.conf; then
            # Insert under existing [WebService] section
            sed -i '/^\[WebService\]/a AllowUnencrypted = true\nLoginTo = false' /etc/cockpit/cockpit.conf
        else
            # No [WebService] section exists, append one
            printf '\n[WebService]\nAllowUnencrypted = true\nLoginTo = false\n' >> /etc/cockpit/cockpit.conf
        fi
        echo "Updated Cockpit configuration"
    fi
fi

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
