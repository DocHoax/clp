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
# Start the lightweight studio server (port 3000)
python serve.py

# Or open in browser directly
python serve.py --open
```

### Key Capabilities:
- ⚡ **Universal Real-Time Mesh:** Instant transfer across browser tabs, simulated devices, and WebSocket backends (< 15ms latency).
- 💻 **Multi-Device Simulation Studio:** Interactive device frames (MacBook Pro, iPhone 16 Pro, Alienware PC, ThinkPad Linux) for instant cross-device copy/paste demonstrations.
- 🗄️ **Clipboard History Vault:** Tag-based categorization (URLs, Code, JSON, Colors, Plain Text), search, pinning, and JSON backup export.
- 🔒 **Zero-Knowledge E2EE:** Client-side AES-GCM 256 encryption with PBKDF2 passphrase key derivation.
- 📱 **QR Code Device Pairing:** Generate scannable pairing QR codes to easily connect mobile devices to your mesh.
- 🔊 **Web Audio Synthesizer:** Real-time futuristic sound feedback for copy, sync, and pairing events.

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
