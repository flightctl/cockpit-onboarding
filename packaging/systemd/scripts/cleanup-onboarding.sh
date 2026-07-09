#!/bin/bash
# Post-onboarding cleanup script
# Runs after successful onboarding to remove temporary access and clean up
# Part of cockpit-system-onboarding

set -e

# shellcheck source=common.sh
. /usr/libexec/cockpit-system-onboarding/common.sh

ONBOARDING_USER="onboarding"
SERVICE_NAME="cockpit-system-onboarding-setup.service"

# Read configuration values
RUN_ONCE=$(load_config '.runOnce' 'true')
KEEP_COCKPIT=$(load_config '.keepCockpit' 'false')
HIDE_MODULES=$(load_config '.hideModules' 'true')

echo "Cleanup configuration: runOnce=$RUN_ONCE, keepCockpit=$KEEP_COCKPIT, hideModules=$HIDE_MODULES"

disarm_watchdog
rm -f "${ONBOARDING_MARKER_DIR}/.watchdog-status" 2>/dev/null || true

# Remove attempted marker file
rm -f "${ONBOARDING_MARKER_DIR}/.onboarding-attempted" 2>/dev/null || true

# Remove the onboarding Ethernet connection
if nmcli connection show "$ONBOARDING_SETUP_CONNECTION" >/dev/null 2>&1; then
    nmcli connection delete "$ONBOARDING_SETUP_CONNECTION" 2>/dev/null || true
    echo "Removed onboarding Ethernet connection"
fi

# Remove module overrides if they were installed
if [ "$HIDE_MODULES" = "true" ]; then
    if [ -d ~${ONBOARDING_USER}/.config/cockpit ]; then
        rm -f ~${ONBOARDING_USER}/.config/cockpit/*.override.json 2>/dev/null || true
        echo "Removed module override files"
    fi
fi

# Stop and disable all WiFi AP, dnsmasq, and captive portal template instances.
# These are always cleaned up regardless of runOnce — the AP is only needed during onboarding.
for pattern in 'cockpit-system-onboarding-wifi-ap@*.service' \
               'cockpit-system-onboarding-dnsmasq@*.service' \
               'cockpit-system-onboarding-captive-portal@*.service'; do
    for unit in $(systemctl list-units --plain --no-legend "$pattern" 2>/dev/null | awk '{print $1}'); do
        systemctl stop "$unit" 2>/dev/null || true
        systemctl disable "$unit" 2>/dev/null || true
        echo "Stopped and disabled $unit"
    done
done

# Remove the dedicated firewalld zone if it exists
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    if firewall-cmd --permanent --info-zone=cockpit-onboarding-ap >/dev/null 2>&1; then
        firewall-cmd --permanent --delete-zone=cockpit-onboarding-ap
        firewall-cmd --reload
        echo "Removed firewalld zone 'cockpit-onboarding-ap'"
    fi
fi

# Clean up runtime files (hostapd configs, env files)
rm -rf /run/cockpit-system-onboarding 2>/dev/null || true

# Remove SSH denial for onboarding user (no longer needed after cleanup)
if [ -f /etc/ssh/sshd_config.d/50-deny-onboarding.conf ]; then
    rm -f /etc/ssh/sshd_config.d/50-deny-onboarding.conf
    systemctl reload sshd 2>/dev/null || systemctl reload ssh 2>/dev/null || true
    echo "Removed SSH denial for onboarding user"
fi

if [ "$RUN_ONCE" = "true" ]; then
    echo "runOnce is enabled - performing full cleanup"

    # Note: sudoers and polkit rules are left in place here.
    # They are removed by the RPM %postun scriptlet on package uninstall.

    # Disable the systemd setup service to prevent re-running on next boot
    if systemctl is-enabled "$SERVICE_NAME" >/dev/null 2>&1; then
        systemctl disable "$SERVICE_NAME" 2>/dev/null || true
        echo "Disabled $SERVICE_NAME"
    fi

    if [ "$KEEP_COCKPIT" = "true" ]; then
        # Keep Cockpit running but force password change on the onboarding user
        # This ensures the user must set a real password on next login
        if id "$ONBOARDING_USER" >/dev/null 2>&1; then
            passwd -e "$ONBOARDING_USER" 2>/dev/null || true
            echo "Forced password change for $ONBOARDING_USER on next login"
        fi
    else
        # Delete the onboarding user entirely
        if id "$ONBOARDING_USER" >/dev/null 2>&1; then
            # Terminate the user's login session and systemd --user instance
            loginctl terminate-user "$ONBOARDING_USER" 2>/dev/null || true
            # Kill any remaining user processes
            pkill -u "$ONBOARDING_USER" 2>/dev/null || true
            sleep 2

            # Remove user and home directory
            userdel -r "$ONBOARDING_USER" 2>/dev/null || true
            echo "Deleted onboarding user and home directory"
        fi

        # Remove Cockpit configuration changes made during setup
        # Only remove AllowUnencrypted if we added it
        if [ -f /etc/cockpit/cockpit.conf ]; then
            # Remove the lines we added
            sed -i '/^AllowUnencrypted = true$/d' /etc/cockpit/cockpit.conf 2>/dev/null || true
            sed -i '/^LoginTo = false$/d' /etc/cockpit/cockpit.conf 2>/dev/null || true
            # Remove file if only section headers and whitespace remain
            if ! grep -qE '^[^[\s]' /etc/cockpit/cockpit.conf 2>/dev/null; then
                rm -f /etc/cockpit/cockpit.conf
            fi
            echo "Cleaned up Cockpit configuration"
        fi
    fi
else
    echo "runOnce is disabled - skipping user and service cleanup"
fi

# Create the gate file so flightctl-agent's ConditionPathExists is satisfied
touch "${ONBOARDING_MARKER_DIR}/.onboarding-confirmed"
echo "Created agent startup gate file"

if systemctl list-unit-files flightctl-agent.service | grep -q flightctl-agent; then
    systemctl enable flightctl-agent 2>/dev/null || true
    if systemctl start flightctl-agent; then
        echo "Started flightctl-agent"
    else
        echo "WARNING: flightctl-agent did not start; check journalctl -u flightctl-agent" >&2
    fi
fi

echo "Post-onboarding cleanup complete"
