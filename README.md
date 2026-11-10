# ANSTOOL

**ANSTOOL** is an open-source Steam management and unlock tool built with Electron and TypeScript. Inspired by OpenSteam and SteamTools, it provides full automated manifest synchronization, Lua generation, proxy DLL hooks, and plugin management.

---

## ⚡ Features

- **Steam Hook Injector**: Deploy and remove proxy DLL hooks with one click (supports Mode 0 & Mode 1).
- **Automated Lua Store**: Real-time integration with SteamProof API. Automatically fetches depot keys and generates `stplug-in` scripts.
- **Depot Cache Manifest Hub**: Downloads physical binary `.manifest` files directly into Steam's `depotcache/`.
- **Batch Manifest Fixer**: Scans local Steam Lua configurations, identifies missing depot manifests, and updates them in batch.
- **Local Game Library Scanner**: Inspects `libraryfolders.vdf` and `appmanifest_*.acf` across all drives.
- **Millennium & Plugins**: Automated deployment of the Millennium loader and `LuaManager` plugin.
- **Online-Fix Multiplayer Bypass**: Directly fetch and deploy multiplayer compatibility fixes.

---

## 🛠️ Building & Running Locally

### Prerequisites
- Node.js >= 18
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/MuhammadAsad809/ANSTOOL.git
cd ANSTOOL

# Install dependencies
npm install

# Build TypeScript and compile assets
npm run build

# Start the application in development
npm run start
```

### Windows Executable (.exe)
```bash
npm run dist:win
```
The generated `.exe` installer and portable standalone will be located in the `release/` directory.

---

## 🚀 Automated Cloud Builds

This repository includes a GitHub Actions workflow (`.github/workflows/build-exe.yml`). Every push to `main` automatically compiles and produces the Windows `.exe` executable artifact available under GitHub Actions.
