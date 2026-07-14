#!/usr/bin/python3
"""Captive portal responder for flightctl-onboarding WiFi AP.

Handles OS-specific captive portal detection probes to trigger the
captive portal dialog on client devices, then redirects all other
requests to the Cockpit onboarding wizard. Combined with dnsmasq
wildcard DNS (address=/#/<AP_IP>), all HTTP requests from connected
clients land on this server.

Probe behavior (returns non-success to trigger captive portal UI):
  - Apple:   GET /hotspot-detect.html -> 302 redirect to wizard
  - Android: GET /generate_204       -> 302 redirect to wizard
  - Windows: GET /connecttest.txt    -> 302 redirect to wizard
  - Windows: GET /ncsi.txt           -> 302 redirect to wizard

All other requests also get a 302 redirect to the wizard.

A device info page is served at /device-info showing the device
serial number and WiFi AP MAC address for operator identification.
"""

import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

COCKPIT_PATH = "/cockpit/@localhost/system-onboarding/index.html"

DEVICE_INFO_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Device Onboarding</title>
<style>
body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 20px;
    background: #f5f5f5;
    color: #333;
}}
.card {{
    max-width: 400px;
    margin: 40px auto;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    padding: 24px;
}}
h1 {{
    font-size: 1.3em;
    margin: 0 0 16px 0;
    color: #1a1a1a;
}}
.info-row {{
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
}}
.info-label {{
    font-weight: 600;
    color: #666;
}}
.info-value {{
    font-family: monospace;
    color: #1a1a1a;
}}
.button {{
    display: block;
    width: 100%;
    margin-top: 20px;
    padding: 12px;
    background: #0066cc;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 1em;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    box-sizing: border-box;
}}
</style>
</head>
<body>
<div class="card">
    <h1>Device Onboarding</h1>
    <div class="info-row">
        <span class="info-label">Serial Number</span>
        <span class="info-value">{serial}</span>
    </div>
    <div class="info-row">
        <span class="info-label">WiFi MAC Address</span>
        <span class="info-value">{mac}</span>
    </div>
    <a class="button" href="{wizard_url}">Open Onboarding Wizard</a>
</div>
</body>
</html>
"""


def read_serial_number():
    """Read the device serial number from DMI data."""
    try:
        with open("/sys/class/dmi/id/product_serial", "r") as f:
            serial = f.read().strip()
            if serial and serial.lower() not in ("", "none", "not specified",
                                                  "to be filled by o.e.m."):
                return serial
    except (OSError, IOError):
        pass
    return "N/A"


def read_mac_address(interface):
    """Read the MAC address of the given network interface."""
    try:
        path = f"/sys/class/net/{interface}/address"
        with open(path, "r") as f:
            return f.read().strip().upper()
    except (OSError, IOError):
        return "N/A"


class CaptivePortalHandler(BaseHTTPRequestHandler):
    ap_address = "10.42.0.1"
    wifi_interface = ""
    wizard_url = ""
    serial_number = "N/A"
    mac_address = "N/A"

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/device-info":
            self._serve_device_info()
        elif path == "/hotspot-detect.html":
            # Apple CNA: return non-Success body to trigger captive portal
            # dialog, then redirect to device-info (CNA is a limited WebKit
            # view that can't handle the full Cockpit app).
            self._redirect_to_device_info()
        else:
            # Android /generate_204, Windows /connecttest.txt and /ncsi.txt,
            # and all other requests: redirect to the wizard directly.
            self._redirect_to_wizard()

    def _redirect_to_wizard(self):
        self.send_response(302)
        self.send_header("Location", self.wizard_url)
        self.send_header("Cache-Control", "no-cache, no-store")
        self.end_headers()

    def _redirect_to_device_info(self):
        device_info_url = f"http://{self.ap_address}:80/device-info"
        self.send_response(302)
        self.send_header("Location", device_info_url)
        self.send_header("Cache-Control", "no-cache, no-store")
        self.end_headers()

    def _serve_device_info(self):
        page = DEVICE_INFO_TEMPLATE.format(
            serial=self.serial_number,
            mac=self.mac_address,
            wizard_url=self.wizard_url,
        )
        body = page.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache, no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(fmt % args, file=sys.stderr, flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: captive-portal.py <bind_address> [wifi_interface]",
              file=sys.stderr)
        sys.exit(1)

    bind_address = sys.argv[1]
    wifi_interface = sys.argv[2] if len(sys.argv) > 2 else ""

    wizard_url = f"http://{bind_address}:9090{COCKPIT_PATH}"

    CaptivePortalHandler.ap_address = bind_address
    CaptivePortalHandler.wifi_interface = wifi_interface
    CaptivePortalHandler.wizard_url = wizard_url
    CaptivePortalHandler.serial_number = read_serial_number()
    CaptivePortalHandler.mac_address = read_mac_address(wifi_interface)

    print(f"Captive portal listening on {bind_address}:80", flush=True)
    print(f"Wizard URL: {wizard_url}", flush=True)
    print(f"Device serial: {CaptivePortalHandler.serial_number}", flush=True)
    print(f"WiFi MAC: {CaptivePortalHandler.mac_address}", flush=True)

    server = HTTPServer((bind_address, 80), CaptivePortalHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
