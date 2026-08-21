#!/usr/bin/env python3
"""
Clp Real-Time Synchronization Hub & Authentication Server
Provides:
1. User Registration, Authentication & Account Management (/api/auth/signup, /api/auth/login, /api/auth/me)
2. User-Scoped & Mesh WebSocket Server (/sync and /ws) for bidirectional live sync
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
import re

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
USERS_DB_PATH = os.path.join(DIRECTORY, "users_db.json")

# --- USER MANAGEMENT & AUTHENTICATION ---
class UserManager:
    def __init__(self, filepath=USERS_DB_PATH):
        self.filepath = filepath
        self.lock = threading.Lock()
        self.users = {} # id -> user dict
        self.tokens = {} # token -> user_id
        self.load_db()

    def hash_password(self, password, salt=None):
        if not salt:
            salt = os.urandom(16).hex()
        pwd_hash = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000
        ).hex()
        return pwd_hash, salt

    def load_db(self):
        with self.lock:
            if os.path.exists(self.filepath):
                try:
                    with open(self.filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.users = data.get("users", {})
                except Exception as e:
                    print("Error reading users db:", e)
            else:
                # Seed with demo user
                demo_hash, demo_salt = self.hash_password("password123")
                demo_id = "usr-adam"
                self.users[demo_id] = {
                    "id": demo_id,
                    "name": "Adam Muhammad",
                    "email": "adam@clp.dev",
                    "password_hash": demo_hash,
                    "salt": demo_salt,
                    "created_at": int(time.time() * 1000)
                }
                # Also assign mock token
                self.tokens["mock-token-adam"] = demo_id
                self.save_db()

    def save_db(self):
        try:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump({"users": self.users}, f, indent=2)
        except Exception as e:
            print("Error saving users db:", e)

    def signup(self, name, email, password):
        with self.lock:
            name = (name or "").strip()
            email = (email or "").strip().lower()
            password = (password or "").strip()

            if not name or len(name) < 2:
                raise ValueError("Full Name must be at least 2 characters")
            if not email or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
                raise ValueError("Please provide a valid email address")
            if not password or len(password) < 6:
                raise ValueError("Password must be at least 6 characters")

            for u in self.users.values():
                if u.get("email") == email:
                    raise ValueError("An account with this email already exists")

            user_id = f"usr-{int(time.time() * 1000)}"
            pwd_hash, salt = self.hash_password(password)

            user_obj = {
                "id": user_id,
                "name": name,
                "email": email,
                "password_hash": pwd_hash,
                "salt": salt,
                "created_at": int(time.time() * 1000)
            }
            self.users[user_id] = user_obj
            self.save_db()

            token = self.create_token(user_id)
            return token, self.sanitize_user(user_obj)

    def login(self, email, password):
        with self.lock:
            email = (email or "").strip().lower()
            password = (password or "").strip()

            user_obj = None
            for u in self.users.values():
                if u.get("email") == email:
                    user_obj = u
                    break

            if not user_obj:
                raise ValueError("Invalid email or password")

            test_hash, _ = self.hash_password(password, user_obj.get("salt"))
            if test_hash != user_obj.get("password_hash"):
                raise ValueError("Invalid email or password")

            token = self.create_token(user_obj["id"])
            return token, self.sanitize_user(user_obj)

    def create_token(self, user_id):
        token_str = f"clp_tok_{user_id}_{os.urandom(16).hex()}_{int(time.time())}"
        self.tokens[token_str] = user_id
        return token_str

    def get_user_by_token(self, token):
        if not token:
            return None
        with self.lock:
            # Check mock token format
            if token.startswith("mock-token-"):
                mock_id = token.replace("mock-token-", "")
                if mock_id in self.users:
                    return self.sanitize_user(self.users[mock_id])
                return {
                    "id": f"usr-{mock_id}",
                    "name": mock_id.capitalize(),
                    "email": f"{mock_id}@clp.dev",
                    "created_at": int(time.time() * 1000)
                }

            user_id = self.tokens.get(token)
            if user_id and user_id in self.users:
                return self.sanitize_user(self.users[user_id])
            return None

    def sanitize_user(self, user_dict):
        initials = "".join([part[0].upper() for part in user_dict.get("name", "U").split()[:2]]) or "U"
        return {
            "id": user_dict.get("id"),
            "name": user_dict.get("name"),
            "email": user_dict.get("email"),
            "initials": initials,
            "createdAt": user_dict.get("created_at")
        }

user_mgr = UserManager()


# --- IN-MEMORY REAL-TIME STATE ---
class HubState:
    def __init__(self):
        self.lock = threading.Lock()
        self.user_clips = {} # user_id -> current_clip
        self.user_histories = {} # user_id -> list of clips
        self.ws_clients = [] # list of (socket, client_info)
        self.sse_clients = [] # list of response write functions
        self.devices = {} # deviceId -> dict

    def get_current_clip(self, user_id="default"):
        with self.lock:
            if user_id not in self.user_clips:
                self.user_clips[user_id] = {
                    "id": "clip-init",
                    "content": "Welcome to Clp — Your clipboard is synchronized across all your devices!",
                    "type": "text",
                    "originDevice": "Clp Cloud Hub",
                    "userId": user_id,
                    "timestamp": int(time.time() * 1000),
                    "pinned": True
                }
            return self.user_clips[user_id]

    def get_history(self, user_id="default"):
        with self.lock:
            if user_id not in self.user_histories:
                self.user_histories[user_id] = [self.get_current_clip(user_id)]
            return self.user_histories[user_id]

    def broadcast_clip(self, clip_data, sender_ws=None, user_id="default"):
        with self.lock:
            if not clip_data.get("id"):
                clip_data["id"] = f"clip-{int(time.time() * 1000)}"
            if not clip_data.get("timestamp"):
                clip_data["timestamp"] = int(time.time() * 1000)
            clip_data["userId"] = user_id

            self.user_clips[user_id] = clip_data
            
            if user_id not in self.user_histories:
                self.user_histories[user_id] = []
            
            hist = self.user_histories[user_id]
            self.user_histories[user_id] = [c for c in hist if c.get("content") != clip_data.get("content")]
            self.user_histories[user_id].insert(0, clip_data)
            if len(self.user_histories[user_id]) > 100:
                self.user_histories[user_id].pop()

            payload_str = json.dumps({
                "type": "clipboard_sync",
                "payload": clip_data
            })

            # Broadcast to WebSocket clients for this user or public
            dead_ws = []
            frame = self.encode_ws_frame(payload_str)
            for sock, info in self.ws_clients:
                client_user_id = info.get("userId", "default")
                # Send if same user or either is default
                if sock != sender_ws and (client_user_id == user_id or client_user_id == "default" or user_id == "default"):
                    try:
                        sock.sendall(frame)
                    except Exception:
                        dead_ws.append(sock)
            for d in dead_ws:
                self.remove_ws_client(d)

            # Broadcast to SSE clients
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
                "name": client_info.get("deviceName", "Remote Client"),
                "os": client_info.get("osType", "web"),
                "ip": client_info.get("ip", "127.0.0.1"),
                "userId": client_info.get("userId", "default"),
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

    def get_auth_user(self):
        auth_header = self.headers.get("Authorization", "")
        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        if not token:
            parsed = urllib.parse.urlparse(self.path)
            query = urllib.parse.parse_qs(parsed.query)
            token = (query.get("token") or [""])[0]

        if token:
            return user_mgr.get_user_by_token(token)
        return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. WebSocket Upgrade Check
        if self.headers.get("Upgrade", "").lower() == "websocket" or path in ["/sync", "/ws"]:
            self.handle_websocket_upgrade(query)
            return

        # 2. REST API: GET /api/auth/me
        if path == "/api/auth/me":
            user = self.get_auth_user()
            if user:
                self.send_json_response({"authenticated": True, "user": user})
            else:
                self.send_json_response({"authenticated": False, "user": None})
            return

        # 3. REST API: GET /api/clipboard
        if path == "/api/clipboard":
            user = self.get_auth_user()
            user_id = user["id"] if user else "default"
            self.send_json_response(hub.get_current_clip(user_id))
            return

        # 4. REST API: GET /api/devices
        if path == "/api/devices":
            self.send_json_response({
                "activeCount": max(1, len(hub.ws_clients) + len(hub.sse_clients)),
                "devices": list(hub.devices.values())
            })
            return

        # 5. REST API: GET /api/history
        if path == "/api/history":
            user = self.get_auth_user()
            user_id = user["id"] if user else "default"
            self.send_json_response(hub.get_history(user_id))
            return

        # 6. REST API: GET /api/network-info
        if path == "/api/network-info":
            local_ip = get_local_ip()
            self.send_json_response({
                "localUrl": f"http://localhost:{PORT}",
                "networkUrl": f"http://{local_ip}:{PORT}",
                "ip": local_ip,
                "port": PORT
            })
            return

        # 7. REST API: GET /health
        if path == "/health":
            self.send_json_response({
                "status": "healthy",
                "uptime": time.time(),
                "activeConnections": len(hub.ws_clients) + len(hub.sse_clients),
                "timestamp": int(time.time() * 1000)
            })
            return

        # 8. Fallback to static files
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        # 1. Auth: Sign Up
        if path == "/api/auth/signup":
            name = data.get("name", "")
            email = data.get("email", "")
            password = data.get("password", "")
            try:
                token, user = user_mgr.signup(name, email, password)
                self.send_json_response({"success": True, "token": token, "user": user})
            except Exception as e:
                self.send_json_response({"success": False, "error": str(e)}, status=400)
            return

        # 2. Auth: Log In
        if path == "/api/auth/login":
            email = data.get("email", "")
            password = data.get("password", "")
            try:
                token, user = user_mgr.login(email, password)
                self.send_json_response({"success": True, "token": token, "user": user})
            except Exception as e:
                self.send_json_response({"success": False, "error": str(e)}, status=400)
            return

        # 3. Auth: Log Out
        if path == "/api/auth/logout":
            self.send_json_response({"success": True})
            return

        # 4. Clipboard Broadcast
        if path in ["/api/clipboard", "/api/sync"]:
            try:
                user = self.get_auth_user()
                user_id = user["id"] if user else "default"
                content = data.get("content", "")
                origin = data.get("originDevice") or (user["name"] if user else "HTTP Client")
                type_val = data.get("type", "text")

                clip_data = {
                    "id": f"clip-{int(time.time() * 1000)}",
                    "content": content,
                    "type": type_val,
                    "originDevice": origin,
                    "userId": user_id,
                    "timestamp": int(time.time() * 1000),
                    "pinned": False
                }

                hub.broadcast_clip(clip_data, user_id=user_id)
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

        token = (query.get("token") or [""])[0]
        user = user_mgr.get_user_by_token(token)
        user_id = user["id"] if user else "default"
        user_name = user["name"] if user else (query.get("deviceName") or ["Remote Client"])[0]

        sock = self.connection
        client_info = {
            "deviceId": (query.get("deviceId") or [""])[0] or f"dev-{int(time.time() * 1000)}",
            "deviceName": user_name,
            "osType": (query.get("osType") or ["web"])[0],
            "userId": user_id,
            "ip": self.client_address[0]
        }

        hub.add_ws_client(sock, client_info)

        # Send initial latest clipboard state for this user
        initial_payload = json.dumps({
            "type": "clipboard_sync",
            "payload": hub.get_current_clip(user_id)
        })
        sock.sendall(hub.encode_ws_frame(initial_payload))

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
                            origin = payload.get("originDevice") or user_name
                            type_val = payload.get("type", "text")

                            clip_data = {
                                "id": f"clip-{int(time.time() * 1000)}",
                                "content": content,
                                "type": type_val,
                                "originDevice": origin,
                                "userId": user_id,
                                "timestamp": int(time.time() * 1000),
                                "pinned": False
                            }

                            hub.broadcast_clip(clip_data, sender_ws=sock, user_id=user_id)
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
                print(f"[+] Clp Real-Time Sync & Auth Server active!")
                print(f"[+] Local Studio URL:   http://localhost:{port}")
                print(f"[+] Network / Phone URL: http://{local_ip}:{port}")
                print(f"[+] Auth Endpoints:      http://localhost:{port}/api/auth/signup")
                print(f"[+] Real-Time WebSockets: ws://localhost:{port}/sync")
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
