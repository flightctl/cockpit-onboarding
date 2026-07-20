import socket
import time

IFACE_TABLE = "table[aria-label='Network interface selector']"

SINGLE_NIC_MAC = "52:54:00:99:00:01"
SINGLE_NIC_NETDEV_ID = "singlenic_net"
SINGLE_NIC_DEV_ID = "singlenic_dev"
SINGLE_NIC_SUBNET = "10.111.113.0/24"


def wait_for_nic(machine, mac, timeout=15):
    """Wait for a NIC with the given MAC to appear in sysfs and NetworkManager.

    Returns the interface name. Raises if the NIC is not detected within the
    timeout.
    """
    deadline = time.time() + timeout
    iface = ""
    while time.time() < deadline:
        iface = machine.execute(
            f"for d in /sys/class/net/*/address; do "
            f"  if grep -qi {mac} \"$d\" 2>/dev/null; then "
            f"    basename $(dirname \"$d\"); break; "
            f"  fi; "
            f"done"
        ).strip()
        if iface:
            break
        time.sleep(1)
    if not iface:
        raise Exception(f"NIC with MAC {mac} not found after {timeout}s")

    deadline = time.time() + timeout
    while time.time() < deadline:
        rc = machine.execute(
            f"nmcli -g GENERAL.STATE device show {iface} >/dev/null 2>&1"
            f" && echo ok || echo wait"
        ).strip()
        if rc == "ok":
            break
        time.sleep(1)

    return iface


def add_single_nic_interface(test_case):
    """Hotplug a secondary NIC with cockpit port forwarding for single-NIC tests.

    Adds a QEMU user-mode NIC so that the browser connects to cockpit
    through the secondary interface while SSH stays on the primary.
    Registers cleanup via addCleanup so the NIC is removed after the test.

    Returns the interface name inside the VM.
    """
    m = test_case.machine

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.2', 0))
    host_port = s.getsockname()[1]
    s.close()

    m._qemu_monitor(
        f"netdev_add user,id={SINGLE_NIC_NETDEV_ID},"
        f"net={SINGLE_NIC_SUBNET},"
        f"hostfwd=tcp:127.0.0.2:{host_port}-:9090"
    )
    m._qemu_monitor(
        f"device_add virtio-net-pci,"
        f"netdev={SINGLE_NIC_NETDEV_ID},"
        f"mac={SINGLE_NIC_MAC},"
        f"id={SINGLE_NIC_DEV_ID}"
    )

    m.execute("udevadm settle")

    iface = wait_for_nic(m, SINGLE_NIC_MAC)

    m.execute(f"nmcli device connect {iface}", timeout=30)
    deadline = time.time() + 30
    while time.time() < deadline:
        addr = m.execute(
            f"nmcli -g IP4.ADDRESS device show {iface} 2>/dev/null || true"
        ).strip()
        if addr:
            break
        time.sleep(1)
    else:
        raise Exception(f"Secondary NIC {iface} did not get a DHCP address")

    original_port = test_case.browser.port
    test_case.browser.port = host_port

    test_case.addCleanup(lambda: setattr(test_case.browser, 'port', original_port))
    test_case.addCleanup(remove_single_nic_interface, m)

    return iface


def remove_single_nic_interface(machine):
    """Remove the secondary NIC added by add_single_nic_interface."""
    try:
        machine._qemu_monitor(f"device_del {SINGLE_NIC_DEV_ID}")
        machine._qemu_monitor(f"netdev_del {SINGLE_NIC_NETDEV_ID}")
    except Exception:
        pass


def click_button_text(b, text):
    b.wait_js_cond(
        f"Array.from(document.querySelectorAll('button'))"
        f".some(el => el.textContent.trim() === '{text}')"
    )
    b.eval_js(
        f"Array.from(document.querySelectorAll('button'))"
        f".find(el => el.textContent.trim() === '{text}').click()"
    )


def wait_button_text(b, text):
    b.wait_js_cond(
        f"Array.from(document.querySelectorAll('button'))"
        f".some(el => el.textContent.trim() === '{text}')"
    )


def iface_row_selector(browser, table, interface):
    names = browser.eval_js(
        f"Array.from(document.querySelectorAll(\"{table} td[data-label='Name']\"))"
        ".map(e => e.textContent)"
    )
    row = names.index(interface) + 1
    return f"{table} tbody tr:nth-child({row})"


def complete_network_step(b):
    b.wait_visible("#networkStep")
    b.wait_visible(IFACE_TABLE)
    b.click(f"{IFACE_TABLE} tbody tr:first-child input[type='radio']")
    click_button_text(b, "Next")


def navigate_to_network_services_step(b):
    complete_network_step(b)
    b.wait_visible("#networkServicesStep")


def complete_network_services_step(b):
    b.wait_visible("#networkServicesStep")
    click_button_text(b, "Next")


def navigate_to_enrollment_step(b):
    navigate_to_network_services_step(b)
    complete_network_services_step(b)
    b.wait_visible("#enrollmentStep")


def complete_enrollment_step(b):
    b.wait_visible("#enrollmentStep")
    b.wait_visible("#flightctl-enrollment")
    if b.is_present("#flightctl-enrollment:checked"):
        b.click("label[for='flightctl-enrollment']")
        b.wait_not_present("#flightctl-enrollment:checked")
    click_button_text(b, "Next")


def navigate_to_labels_step(b):
    navigate_to_enrollment_step(b)
    complete_enrollment_step(b)
    b.wait_visible("#labelsStep")
    b.wait_visible("#hostname-input")


def navigate_to_hostname_step(b):
    navigate_to_labels_step(b)


def complete_hostname_step(b, hostname):
    b.wait_visible("#labelsStep")
    b.wait_visible("#hostname-input")
    b.set_input_text("#hostname-input", hostname)
    click_button_text(b, "Next")


def advance_past_optional_steps_to_review(b, hostname="test-host"):
    navigate_to_labels_step(b)
    complete_hostname_step(b, hostname)
    b.wait_visible("#reviewStep")
