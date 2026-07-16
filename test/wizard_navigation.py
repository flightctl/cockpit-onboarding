IFACE_TABLE = "table[aria-label='Network interface selector']"


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
