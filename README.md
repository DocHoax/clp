# Clp

**Clp** is a blazing-fast, secure, cross-platform clipboard synchronization tool that bridges the gap between your desktop and mobile devices. Copy on your laptop, instantly paste on your phone.

## 🚀 Features
- **Real-Time Sync:** Instantaneous transfer via secure WebSockets.
- **Cross-Platform:** Full compatibility with Windows, macOS, Linux, Android, and iOS.
- **Tri-Option Auth:** Secure signup via Email, Google, or Apple accounts.
- **Privacy First:** Designed with client-side encryption in mind.

## 🛠️ Tech Stack

### Frontend (Mobile)
- **Framework:** React Native
- **Language:** TypeScript
- **Navigation:** React Navigation v7
- **Styling:** NativeWind (TailwindCSS for React Native)
- **Icons:** React Native Vector Icons
- **State Management:** Zustand

### Backend (API & Web)
- **Runtime:** Node.js + bun
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB
- **ORM/Driver:** Mongoose
- **Authentication:** JWT, bcrypt
- **Real-Time:** Socket.IO
- **Validation:** Zod

### Desktop
- **Framework:** Electron
- **UI Framework:** React + TypeScript
- **Styling:** TailwindCSS
- **Packaging:** electron-builder

## 📂 Project Structure
```
clp/
├── apps/
│   ├── mobile/        # React Native mobile app
│   ├── web/           # Web interface (optional)
│   └── desktop/       # Electron desktop app
├── packages/
│   ├── api/           # Express API server
│   ├── auth/          # Authentication utilities
│   ├── db/            # Database models and utilities
│   └── ws/            # WebSocket utilities
└── package.json       # Root configuration
```

## 🌐 Interactive Web Studio & Multi-Device Hub
The project now includes an **Interactive Web Studio** with a cyberpunk glassmorphic UI, live multi-device simulation, system clipboard synchronization, E2EE vault, and QR device pairing.

### Launching the Web Interface:
```bash
# Start the real-time sync server (WebSockets + REST + UI on port 3000)
python serve.py

# Or open in browser directly
python serve.py --open
```

### Real-Time User & Device Synchronization:
1. **Live WebSockets (`/sync` & `/ws`)**: High-performance, bi-directional real-time clipboard synchronization across all connected desktop and mobile browsers.
2. **Local Area Network (LAN) Sync**: Connect any mobile phone or second computer on your local WiFi by opening the network URL (e.g. `http://192.168.x.x:3000`) or scanning the in-app pairing QR code.
3. **REST API Sync Bridge**:
   - `GET /api/clipboard`: Fetch current universal clipboard state.
   - `POST /api/clipboard`: Broadcast new clip to all connected users in real time.
   - `GET /api/devices`: Live connected client and device presence list.
   - `GET /api/network-info`: Discover server LAN IP and pairing URLs.
4. **Cross-Tab & System Sync**: Uses browser `BroadcastChannel` + native `navigator.clipboard` for instant multi-window sync.

## 🔐 Authentication Flow
1. **Signup:** User registers via Email, Google, or Apple
2. **Login:** JWT token is issued
3. **Device Registration:** Device registers with user ID
4. **Real-Time Sync:** WebSocket connection established for instant updates

## 📄 License
ISC

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support
For issues or questions, please open an issue on GitHub.

---

Created by [Adam Muhammad]
