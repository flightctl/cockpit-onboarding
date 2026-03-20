#!/usr/bin/python3
"""Captive portal responder for cockpit-system-onboarding WiFi AP.

Responds to iOS and Android captive portal detection probes so that
phones connecting to the onboarding WiFi AP do not show "No Internet"
warnings. Combined with dnsmasq wildcard DNS (address=/#/<AP_IP>),
all probe requests are redirected to this server.
"""

import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

# iOS expects this exact body to consider the network "connected"
IOS_SUCCESS = b"<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>"


class CaptivePortalHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/generate_204":
            # Android captive portal check
            self.send_response(204)
            self.end_headers()
        elif self.path == "/hotspot-detect.html":
            # iOS captive portal check
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(IOS_SUCCESS)
        else:
            # Catch-all: iOS sometimes probes other paths
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(IOS_SUCCESS)

    def log_message(self, fmt, *args):
        print(fmt % args, file=sys.stderr, flush=True)


if __name__ == "__main__":
    bind_address = sys.argv[1]
    server = HTTPServer((bind_address, 80), CaptivePortalHandler)
    print(f"Captive portal listening on {bind_address}:80", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
