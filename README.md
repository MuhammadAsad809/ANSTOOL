# ⚡ ANSTOOL - 1-Click Steam Game Unlocker

**ANSTOOL** is a clean, lightweight, and ultra-simple Steam game unlocker built with Electron and TypeScript. Designed for zero-friction gaming: **Search Game -> Click Add -> Done ✅**.

---

## 🚀 The 1-Click Experience

No confusing menus. No manual proxy hook modes. No complex steps.

1. **Search Any Game**: Type the game title (e.g. *Black Myth: Wukong*, *Elden Ring*, *Cyberpunk 2077*) or enter its Steam AppID.
2. **Click "⚡ Add Game"**: ANSTOOL automatically:
   - Silently verifies and deploys Steam proxy hooks (`xinput1_4.dll`, etc.)
   - Generates the Lua unlock configuration with all official DLCs & depot keys
   - Fetches depot manifests into Steam's `depotcache/`
   - Flushes/reloads Steam seamlessly
   - Launches Steam's native installer dialog (`steam://install/<AppID>`)
3. **Done ✅**: Steam starts downloading your game immediately!

---

## ⚡ Features

- **Dead-Simple UI**: Cyberpunk-inspired dark theme, instant debounced search, and trending game quick-tags.
- **100% Search Accuracy**: Direct integration with Steam Store APIs + cached database ensures every Steam game can be found and unlocked.
- **Resilient Fallback Engine**: If third-party manifest servers are rate-limited or blocked, ANSTOOL falls back to official Steam metadata & DLC trees so unlocks never fail.
- **My Library Manager**: Easily inspect, re-launch, or remove your unlocked games in one place.
- **Zero-Config Automation**: Background proxy hook injection and Steam process management.

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

# Build TypeScript and compile distribution assets
npm run build

# Start the application in development
npm run start
```

### Build Windows Executable (.exe)
```bash
npm run dist:win
```
The installer and portable standalone `.exe` will be generated in the `release/` directory.

---

## 📦 Automated GitHub Releases

Pushing to `main` triggers `.github/workflows/build-exe.yml`, which compiles the latest Windows installer and standalone `.exe` binaries under GitHub Actions / Releases automatically.
