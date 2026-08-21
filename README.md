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

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- bun (v1.0+)
- MongoDB (local or cloud)
- Android Studio or Xcode (for mobile development)

### Installation
```bash
bun install
```

### Mobile App
```bash
cd apps/mobile
bun run dev
```

### Desktop App
```bash
cd apps/desktop
bun run dev
```

### API
```bash
cd packages/api
bun run dev
```

## 🔌 Configuration
Create a `.env` file in each app directory with the following variables:

```env
# API
MONGODB_URI=your_mongo_connection_string
JWT_SECRET=your_secret

# Mobile
API_URL=http://localhost:3000
```

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

Created by [Your Name]
