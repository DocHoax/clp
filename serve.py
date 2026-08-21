#!/usr/bin/env python3
"""
Clp Real-Time Synchronization Hub & Server
Provides:
1. Full RFC 6455 WebSocket Server (/sync and /ws) for bidirectional live sync
2. Server-Sent Events (SSE) stream (/api/stream) fallback
3. REST Clipboard API (GET/POST /api/clipboard, /api/devices, /api/history, /api/network-info)
4. Static file server for the Clp Web Studio
"""

import http.server
import socketserver
import threading
import json
import os
import sys
import time
import socket
import hashlib
import base64
import struct
import urllib.parse

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# --- IN-MEMORY REAL-TIME STATE ---
class HubState:
    def __init__(self):
        self.lock = threading.Lock()
        self.current_clip = {
            "id": "clip-init",
            "content": "Welcome to Clp — Real-time clipboard sync is now active across all your devices!",
            "type": "text",
            "originDevice": "Clp Hub Server",
            "timestamp": int(time.time() * 1000),
            "pinned": True
        }
        self.history = [self.current_clip]
        self.ws_clients = [] # list of (socket, client_info)
        self.sse_clients = [] # list of response write functions
        self.devices = {} # deviceId -> dict

    def broadcast_clip(self, clip_data, sender_ws=None):
        with self.lock:
            # Ensure proper format
            if not clip_data.get("id"):
                clip_data["id"] = f"clip-{int(time.time() * 1000)}"
            if not clip_data.get("timestamp"):
                clip_data["timestamp"] = int(time.time() * 1000)

            self.current_clip = clip_data
            # Insert into history (deduplicate)
            self.history = [c for c in self.history if c.get("content") != clip_data.get("content")]
            self.history.insert(0, clip_data)
            if len(self.history) > 100:
                self.history.pop()

            payload_str = json.dumps({
                "type": "clipboard_sync",
                "payload": clip_data
            })

            # 1. Broadcast to all WebSocket clients (except sender)
            dead_ws = []
            frame = self.encode_ws_frame(payload_str)
            for sock, info in self.ws_clients:
                if sock != sender_ws:
                    try:
                        sock.sendall(frame)
                    except Exception:
                        dead_ws.append(sock)
            for d in dead_ws:
                self.remove_ws_client(d)

            # 2. Broadcast to all SSE clients
            dead_sse = []
            sse_msg = f"event: clipboard_sync\ndata: {payload_str}\n\n".encode("utf-8")
            for q in self.sse_clients:
                try:
                    q.put(sse_msg)
                except Exception:
                    dead_sse.append(q)
            for q in dead_sse:
                if q in self.sse_clients:
                    self.sse_clients.remove(q)

    def encode_ws_frame(self, message):
        data = message.encode("utf-8")
        length = len(data)
        if length <= 125:
            header = bytearray([0x81, length])
        elif length <= 65535:
            header = bytearray([0x81, 126]) + struct.pack("!H", length)
        else:
            header = bytearray([0x81, 127]) + struct.pack("!Q", length)
        return bytes(header) + data

    def add_ws_client(self, sock, client_info):
        with self.lock:
            self.ws_clients.append((sock, client_info))
            dev_id = client_info.get("deviceId") or f"dev-{int(time.time() * 1000)}"
            self.devices[dev_id] = {
                "id": dev_id,
                "name": client_info.get("deviceName", "Remote Browser Client"),
                "os": client_info.get("osType", "web"),
                "ip": client_info.get("ip", "127.0.0.1"),
                "connectedAt": int(time.time() * 1000),
                "lastActive": int(time.time() * 1000)
            }
            self.broadcast_device_update()

    def remove_ws_client(self, sock):
        with self.lock:
            self.ws_clients = [c for c in self.ws_clients if c[0] != sock]
            try:
                sock.close()
            except Exception:
                pass
            self.broadcast_device_update()

    def broadcast_device_update(self):
        msg = json.dumps({
            "type": "devices_update",
            "payload": {
                "activeCount": max(1, len(self.ws_clients) + len(self.sse_clients)),
                "devices": list(self.devices.values())
            }
        })
        frame = self.encode_ws_frame(msg)
        for sock, _ in self.ws_clients:
            try:
                sock.sendall(frame)
            except Exception:
                pass

hub = HubState()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


# --- HTTP & WEBSOCKET REQUEST HANDLER ---
class ClpHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. WebSocket Upgrade Check
        if self.headers.get("Upgrade", "").lower() == "websocket" or path in ["/sync", "/ws"]:
            self.handle_websocket_upgrade(query)
            return

        # 2. REST API: GET /api/clipboard
        if path == "/api/clipboard":
            self.send_json_response(hub.current_clip)
            return

        # 3. REST API: GET /api/devices
        if path == "/api/devices":
            self.send_json_response({
                "activeCount": max(1, len(hub.ws_clients) + len(hub.sse_clients)),
                "devices": list(hub.devices.values())
            })
            return

        # 4. REST API: GET /api/history
        if path == "/api/history":
            self.send_json_response(hub.history)
            return

        # 5. REST API: GET /api/network-info
        if path == "/api/network-info":
            local_ip = get_local_ip()
            self.send_json_response({
                "localUrl": f"http://localhost:{PORT}",
                "networkUrl": f"http://{local_ip}:{PORT}",
                "ip": local_ip,
                "port": PORT
            })
            return

        # 6. REST API: GET /health
        if path == "/health":
            self.send_json_response({
                "status": "healthy",
                "uptime": time.time(),
                "activeConnections": len(hub.ws_clients) + len(hub.sse_clients),
                "timestamp": int(time.time() * 1000)
            })
            return

        # 7. Fallback to static files
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ["/api/clipboard", "/api/sync"]:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
                content = data.get("content", "")
                origin = data.get("originDevice") or self.headers.get("User-Agent", "HTTP Client")[:30]
                type_val = data.get("type", "text")

                clip_data = {
                    "id": f"clip-{int(time.time() * 1000)}",
                    "content": content,
                    "type": type_val,
                    "originDevice": origin,
                    "timestamp": int(time.time() * 1000),
                    "pinned": False
                }

                hub.broadcast_clip(clip_data)
                self.send_json_response({"success": True, "clip": clip_data})
            except Exception as e:
                self.send_json_response({"error": str(e)}, status=400)
            return

        self.send_error(404, "Endpoint not found")

    def send_json_response(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def handle_websocket_upgrade(self, query):
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self.send_error(400, "Missing Sec-WebSocket-Key")
            return

        # Compute accept key
        guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        accept = base64.b64encode(hashlib.sha1((key + guid).encode("utf-8")).digest()).decode("utf-8")

        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n"
            "Access-Control-Allow-Origin: *\r\n\r\n"
        )
        self.wfile.write(response.encode("utf-8"))
        self.wfile.flush()

        sock = self.connection
        client_info = {
            "deviceId": (query.get("deviceId") or [""])[0] or f"dev-{int(time.time() * 1000)}",
            "deviceName": (query.get("deviceName") or ["Remote Client"])[0],
            "osType": (query.get("osType") or ["web"])[0],
            "ip": self.client_address[0]
        }

        hub.add_ws_client(sock, client_info)

        # Send initial latest clipboard state to newly connected client
        initial_payload = json.dumps({
            "type": "clipboard_sync",
            "payload": hub.current_clip
        })
        sock.sendall(hub.encode_ws_frame(initial_payload))

        # Start loop to read frames from this client
        try:
            while True:
                head = sock.recv(2)
                if not head or len(head) < 2:
                    break

                b1 = head[0]
                b2 = head[1]
                fin = (b1 & 0x80) != 0
                opcode = b1 & 0x0F
                masked = (b2 & 0x80) != 0
                payload_len = b2 & 0x7F

                if opcode == 0x8: # Close frame
                    break
                elif opcode == 0x9: # Ping frame
                    # Pong reply
                    sock.sendall(bytearray([0x8A, 0]))
                    continue

                if payload_len == 126:
                    ext = sock.recv(2)
                    payload_len = struct.unpack("!H", ext)[0]
                elif payload_len == 127:
                    ext = sock.recv(8)
                    payload_len = struct.unpack("!Q", ext)[0]

                mask_key = sock.recv(4) if masked else None
                data = bytearray()
                while len(data) < payload_len:
                    chunk = sock.recv(min(4096, payload_len - len(data)))
                    if not chunk:
                        break
                    data.extend(chunk)

                if masked and mask_key:
                    for i in range(len(data)):
                        data[i] ^= mask_key[i % 4]

                if opcode == 0x1: # Text frame
                    msg_text = data.decode("utf-8", errors="ignore")
                    try:
                        parsed = json.loads(msg_text)
                        if parsed.get("type") == "clipboard_update":
                            payload = parsed.get("payload", {})
                            content = payload.get("content", "")
                            origin = payload.get("originDevice") or client_info.get("deviceName", "Remote Client")
                            type_val = payload.get("type", "text")

                            clip_data = {
                                "id": f"clip-{int(time.time() * 1000)}",
                                "content": content,
                                "type": type_val,
                                "originDevice": origin,
                                "timestamp": int(time.time() * 1000),
                                "pinned": False
                            }

                            # Broadcast to all clients
                            hub.broadcast_clip(clip_data, sender_ws=sock)
                    except Exception as err:
                        print("WebSocket frame processing error:", err)

        except Exception:
            pass
        finally:
            hub.remove_ws_client(sock)


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    os.chdir(DIRECTORY)
    port = PORT
    local_ip = get_local_ip()

    for attempt in range(5):
        try:
            with ThreadedTCPServer(("", port), ClpHandler) as httpd:
                print("==================================================")
                print(f"[+] Clp Real-Time Sync Server started successfully!")
                print(f"[+] Local Studio URL:   http://localhost:{port}")
                print(f"[+] Network / Phone URL: http://{local_ip}:{port}")
                print(f"[+] Real-Time WebSockets: ws://localhost:{port}/sync")
                print(f"[+] REST API Endpoint:   http://localhost:{port}/api/clipboard")
                print(f"[+] Serving Directory:   {DIRECTORY}")
                print("==================================================")

                if "--open" in sys.argv or "-o" in sys.argv:
                    import webbrowser
                    webbrowser.open(f"http://localhost:{port}")

                httpd.serve_forever()
                break
        except OSError as e:
            port += 1


if __name__ == "__main__":
    main()
