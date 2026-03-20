#!/bin/bash
# Create temporary onboarding user for initial system access
# Part of cockpit-system-onboarding first-boot setup

set -e

# Create onboarding user with no password (pam_succeed_if allows login)
if ! id onboarding >/dev/null 2>&1; then
    useradd -m -s /bin/bash -c "System Onboarding User" onboarding
    passwd -d onboarding  # Remove password
    echo "Created onboarding user"
else
    echo "Onboarding user already exists"
fi

# Install sudoers file for system configuration permissions
if [ -f /usr/share/cockpit/system-onboarding/sudoers.conf ]; then
    cp /usr/share/cockpit/system-onboarding/sudoers.conf /etc/sudoers.d/cockpit-system-onboarding
    chmod 0440 /etc/sudoers.d/cockpit-system-onboarding
    echo "Installed sudoers configuration"
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
    # Append if not already present
    if ! grep -q "AllowUnencrypted" /etc/cockpit/cockpit.conf; then
        echo "[WebService]" >> /etc/cockpit/cockpit.conf
        echo "AllowUnencrypted = true" >> /etc/cockpit/cockpit.conf
        echo "LoginTo = false" >> /etc/cockpit/cockpit.conf
        echo "Updated Cockpit configuration"
    fi
fi

# Install module overrides if hideModules=true
USER_CONFIG="/etc/cockpit/system-onboarding/config.json"
DEFAULT_CONFIG="/usr/share/cockpit/system-onboarding/config.json"

# Load configuration with fallback hierarchy
load_config() {
    local key="$1"
    local default="$2"

    # Try user override first
    if [ -f "$USER_CONFIG" ]; then
        value=$(jq -r "$key" "$USER_CONFIG" 2>/dev/null)
        if [ -n "$value" ] && [ "$value" != "null" ]; then
            echo "$value"
            return
        fi
    fi

    # Fall back to default config
    if [ -f "$DEFAULT_CONFIG" ]; then
        value=$(jq -r "$key" "$DEFAULT_CONFIG" 2>/dev/null)
        if [ -n "$value" ] && [ "$value" != "null" ]; then
            echo "$value"
            return
        fi
    fi

    # Use built-in default
    echo "$default"
}

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
