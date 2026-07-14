#!/usr/bin/env bash
# Install flightctl CLI, agent, and SELinux policy on a test VM from published RPMs.
#
# Usage: hack/install-flightctl-on-vm.sh <vm-ip>
#
# Environment:
#   SKIP_FLIGHTCTL=1          Skip installation entirely
#   FLIGHTCTL_REPO_URL        .repo file (default: COPR @redhat-et/flightctl-dev for Fedora)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    echo "Usage: $0 <vm-ip>" >&2
    echo "  Install flightctl-cli, flightctl-agent, and flightctl-selinux from published RPMs." >&2
    echo "" >&2
    echo "  Set SKIP_FLIGHTCTL=1 to skip. Override FLIGHTCTL_REPO_URL to use a different repo." >&2
    exit 1
}

if [[ "${SKIP_FLIGHTCTL:-0}" == "1" ]]; then
    echo "Skipping flightctl installation (SKIP_FLIGHTCTL=1)"
    exit 0
fi

if [[ $# -ne 1 ]]; then
    usage
fi

VM_IP="$1"
FEDORA_VERSION="${FEDORA_VERSION:-43}"
FLIGHTCTL_REPO_URL="${FLIGHTCTL_REPO_URL:-https://copr.fedorainfracloud.org/coprs/g/redhat-et/flightctl-dev/repo/fedora-${FEDORA_VERSION}/flightctl-redhat-et-flightctl-dev-fedora-${FEDORA_VERSION}.repo}"

run_ssh() {
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        "fedora@${VM_IP}" "$@"
}

echo "=== Installing flightctl packages on ${VM_IP} ==="

run_ssh \
    FLIGHTCTL_REPO_URL="${FLIGHTCTL_REPO_URL}" \
    bash -s <<'REMOTE'
set -euo pipefail

PACKAGES=(flightctl-selinux flightctl-cli flightctl-agent)

echo "Adding repository: ${FLIGHTCTL_REPO_URL}"
sudo dnf install -y dnf-plugins-core
sudo rm -f /etc/yum.repos.d/flightctl*.repo
sudo dnf config-manager addrepo --from-repofile="${FLIGHTCTL_REPO_URL}"

if ! sudo dnf install -y "${PACKAGES[@]}"; then
    echo "ERROR: Failed to install flightctl packages from ${FLIGHTCTL_REPO_URL}" >&2
    exit 1
fi
echo "Installed flightctl packages from ${FLIGHTCTL_REPO_URL}"

# Verify the agent package landed; the unit stays disabled until onboarding
# completes (flightctl-onboarding installs a ConditionPathExists gate).
if [[ ! -f /usr/lib/systemd/system/flightctl-agent.service ]]; then
    echo "ERROR: flightctl-agent.service unit file missing after install" >&2
    exit 1
fi

if ! command -v flightctl >/dev/null; then
    echo "ERROR: flightctl CLI is not on PATH after install" >&2
    exit 1
fi

echo "flightctl-agent unit file and flightctl CLI are present (service disabled until onboarding completes)"
REMOTE

echo "Flight Control packages installed on ${VM_IP}"
