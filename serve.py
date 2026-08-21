#!/usr/bin/env python3
"""
Clp Interactive Web Studio Server
Serves the web application on http://localhost:3000 with CORS and proper MIME headers.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    os.chdir(DIRECTORY)
    port = PORT
    for attempt in range(5):
        try:
            with socketserver.TCPServer(("", port), Handler) as httpd:
                print("==================================================")
                print(f"[+] Clp Web Studio running at: http://localhost:{port}")
                print(f"[+] Serving directory: {DIRECTORY}")
                print(f"[+] Press Ctrl+C to stop the server")
                print("==================================================")
                if "--open" in sys.argv or "-o" in sys.argv:
                    webbrowser.open(f"http://localhost:{port}")
                httpd.serve_forever()
                break
        except OSError:
            port += 1

if __name__ == '__main__':
    main()
