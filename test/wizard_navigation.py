def complete_network_step(b):
    b.wait_visible("#networkStep")
    b.wait_visible("table[aria-label='Network interface selector']")
    b.click("table[aria-label='Network interface selector'] tbody tr:first-child input[type='radio']")
    b.click("button:contains('Next')")


def navigate_to_network_services_step(b):
    complete_network_step(b)
    b.wait_visible("#networkServicesStep")


def complete_network_services_step(b):
    b.wait_visible("#networkServicesStep")
    b.click("button:contains('Next')")


def navigate_to_enrollment_step(b):
    navigate_to_network_services_step(b)
    complete_network_services_step(b)
    b.wait_visible("#enrollmentStep")


def complete_enrollment_step(b):
    b.wait_visible("#enrollmentStep")
    b.click("button:contains('Next')")


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
    b.click("button:contains('Next')")


def advance_past_optional_steps_to_review(b, hostname="test-host"):
    navigate_to_labels_step(b)
    complete_hostname_step(b, hostname)
    b.wait_visible("#reviewStep")
