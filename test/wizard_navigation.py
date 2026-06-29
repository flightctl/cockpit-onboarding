def complete_network_step(b):
    b.wait_visible("#networkStep")
    b.wait_visible("table[aria-label='Network interface selector']")
    b.click("table[aria-label='Network interface selector'] tbody tr:first-child input[type='radio']")
    b.click("button:contains('Next')")


def advance_past_enrollment_and_connectivity(b):
    if b.is_present("#enrollmentStep"):
        b.click("button:contains('Next')")
    b.click("button:contains('Next')")


def navigate_to_hostname_step(b):
    complete_network_step(b)
    advance_past_enrollment_and_connectivity(b)
    b.wait_visible("#hostnameStep")
    b.wait_visible("#hostname-input")


def complete_hostname_step(b, hostname):
    b.wait_visible("#hostnameStep")
    b.wait_visible("#hostname-input")
    b.set_input_text("#hostname-input", hostname)
    b.click("button:contains('Next')")


def advance_past_optional_steps_to_review(b, hostname="test-host"):
    complete_network_step(b)
    advance_past_enrollment_and_connectivity(b)
    complete_hostname_step(b, hostname)
    b.click("button:contains('Next')")
    b.wait_visible("#reviewStep")
