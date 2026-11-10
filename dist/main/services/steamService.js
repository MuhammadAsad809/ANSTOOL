"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SteamService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const adm_zip_1 = __importDefault(require("adm-zip"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const KNOWN_INJECTED_DLLS = [
    "xinput1_4.dll",
    "hid.dll",
    "wtsapi32.dll",
    "dwmapi.dll",
    "OpenSteamTool.dll"
];
class SteamService {
    customPath = null;
    luaFolderName = "stplug-in";
    getLuaFolder() {
        return this.luaFolderName;
    }
    setLuaFolder(folder) {
        this.luaFolderName = folder;
    }
    setCustomSteamPath(customPath) {
        this.customPath = customPath.trim();
    }
    async getSteamPath() {
        if (this.customPath && fs.existsSync(this.customPath)) {
            return this.customPath;
        }
        const platform = os.platform();
        if (platform === "win32") {
            // 1. Try Windows Registry via PowerShell
            try {
                const { stdout } = await execAsync('powershell -NoProfile -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\Valve\\Steam\' -ErrorAction SilentlyContinue).SteamPath"');
                const regPath = stdout.trim().replace(/\//g, "\\");
                if (regPath && fs.existsSync(regPath)) {
                    return regPath;
                }
            }
            catch {
                // Fallback
            }
            // 2. Standard Windows Default Paths
            const defaultPaths = [
                "C:\\Program Files (x86)\\Steam",
                "C:\\Program Files\\Steam",
                "D:\\Steam",
                "E:\\Steam"
            ];
            for (const p of defaultPaths) {
                if (fs.existsSync(p))
                    return p;
            }
            return "C:\\Program Files (x86)\\Steam";
        }
        else {
            // Linux / macOS / Unix environments (including Wine / Proton / flatpak)
            const home = os.homedir();
            const linuxPaths = [
                path.join(home, ".local/share/Steam"),
                path.join(home, ".steam/steam"),
                path.join(home, ".steam/root"),
                path.join(home, ".var/app/com.valvesoftware.Steam/.local/share/Steam")
            ];
            for (const p of linuxPaths) {
                if (fs.existsSync(p))
                    return p;
            }
            // Return default location even if not yet created
            return path.join(home, ".local/share/Steam");
        }
    }
    async getSteamPathInfo() {
        const steamPath = await this.getSteamPath();
        const exists = fs.existsSync(steamPath);
        const injectedFiles = [];
        if (exists) {
            for (const dll of KNOWN_INJECTED_DLLS) {
                if (fs.existsSync(path.join(steamPath, dll))) {
                    injectedFiles.push(dll);
                }
            }
        }
        const isPatched = injectedFiles.length > 0;
        const luaPath = path.join(steamPath, "config", this.luaFolderName);
        const depotCachePath = path.join(steamPath, "depotcache");
        return {
            path: steamPath,
            isDefault: !this.customPath,
            exists,
            isPatched,
            injectedFiles,
            luaPath,
            depotCachePath
        };
    }
    async getProcessStatus() {
        const platform = os.platform();
        try {
            if (platform === "win32") {
                const { stdout } = await execAsync("tasklist /FI \"IMAGENAME eq steam.exe\" /NH");
                const helperRes = await execAsync("tasklist /FI \"IMAGENAME eq steamwebhelper.exe\" /NH");
                return {
                    steamRunning: stdout.toLowerCase().includes("steam.exe"),
                    helperRunning: helperRes.stdout.toLowerCase().includes("steamwebhelper.exe")
                };
            }
            else {
                const { stdout } = await execAsync("pgrep -f steam || true");
                const isRunning = stdout.trim().length > 0;
                return {
                    steamRunning: isRunning,
                    helperRunning: isRunning
                };
            }
        }
        catch {
            return { steamRunning: false, helperRunning: false };
        }
    }
    async killSteamProcesses() {
        const platform = os.platform();
        try {
            if (platform === "win32") {
                await execAsync("taskkill /F /IM steam.exe /T 2>nul || true");
                await execAsync("taskkill /F /IM steamwebhelper.exe /T 2>nul || true");
            }
            else {
                await execAsync("pkill -9 -f steam 2>/dev/null || true");
            }
            return true;
        }
        catch {
            return false;
        }
    }
    async restartSteam(disableWebHelper = false) {
        await this.killSteamProcesses();
        await new Promise((r) => setTimeout(r, 1500));
        const steamPath = await this.getSteamPath();
        const platform = os.platform();
        try {
            if (platform === "win32") {
                const steamExe = path.join(steamPath, "Steam.exe");
                if (disableWebHelper) {
                    (0, child_process_1.spawn)(steamExe, ["-no-browser", "+open", "steam://open/minigameslist"], {
                        detached: true,
                        stdio: "ignore"
                    }).unref();
                }
                else {
                    (0, child_process_1.spawn)("cmd.exe", ["/c", "start", "steam://flushconfig"], {
                        detached: true,
                        stdio: "ignore"
                    }).unref();
                }
            }
            else {
                const steamBin = path.join(steamPath, "steam.sh");
                const cmd = fs.existsSync(steamBin) ? steamBin : "steam";
                (0, child_process_1.spawn)(cmd, disableWebHelper ? ["-no-browser"] : [], {
                    detached: true,
                    stdio: "ignore"
                }).unref();
            }
            return true;
        }
        catch (err) {
            console.error("Failed to restart Steam:", err);
            return false;
        }
    }
    async patchSteam(mode = 1) {
        const steamPath = await this.getSteamPath();
        if (!fs.existsSync(steamPath)) {
            throw new Error(`Steam directory not found at: ${steamPath}`);
        }
        const tempDir = path.join(steamPath, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const zipPath = path.join(tempDir, "inject.zip");
        try {
            let downloadUrl = "";
            if (mode === 0) {
                // Mode 0: OpenSteam001/OpenSteamTool latest release (-Release.zip)
                const apiRes = await fetch("https://api.github.com/repos/OpenSteam001/OpenSteamTool/releases/latest", {
                    headers: { "User-Agent": "OpenSteamManager" }
                });
                if (!apiRes.ok) {
                    throw new Error(`Failed to fetch OpenSteamTool release: HTTP ${apiRes.status}`);
                }
                const data = await apiRes.json();
                const asset = data.assets?.find((a) => a.name && a.name.toLowerCase().endsWith("-release.zip"));
                if (!asset || !asset.browser_download_url) {
                    throw new Error("Could not find stable -Release.zip asset in OpenSteamTool release.");
                }
                downloadUrl = asset.browser_download_url;
            }
            else {
                // Mode 1: Abrahamqb/OpenSteamMore-Dev inject.zip
                downloadUrl = "https://github.com/Abrahamqb/OpenSteamMore-Dev/releases/latest/download/inject.zip";
            }
            const fileRes = await fetch(downloadUrl, {
                headers: { "User-Agent": "OpenSteamManager" }
            });
            if (!fileRes.ok) {
                throw new Error(`Failed to download patch payload: HTTP ${fileRes.status}`);
            }
            const arrayBuffer = await fileRes.arrayBuffer();
            fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));
            // Extract using AdmZip
            const zip = new adm_zip_1.default(zipPath);
            if (mode === 0) {
                // Extract only DLL files directly to Steam root
                const entries = zip.getEntries();
                for (const entry of entries) {
                    if (entry.entryName.toLowerCase().endsWith(".dll")) {
                        const destFile = path.join(steamPath, path.basename(entry.entryName));
                        fs.writeFileSync(destFile, entry.getData());
                    }
                }
            }
            else {
                zip.extractAllTo(steamPath, true);
            }
            return {
                success: true,
                message: `Steam successfully patched via Mode ${mode}! Restart Steam to apply hooks.`
            };
        }
        finally {
            try {
                if (fs.existsSync(zipPath))
                    fs.unlinkSync(zipPath);
                if (fs.existsSync(tempDir))
                    fs.rmdirSync(tempDir);
            }
            catch { }
        }
    }
    async unpatchSteam() {
        const steamPath = await this.getSteamPath();
        if (!fs.existsSync(steamPath)) {
            return { success: false, message: "Steam folder not found." };
        }
        await this.killSteamProcesses();
        await new Promise((r) => setTimeout(r, 1000));
        const deleted = [];
        // Delete known proxy DLLs
        for (const dll of KNOWN_INJECTED_DLLS) {
            const full = path.join(steamPath, dll);
            if (fs.existsSync(full)) {
                try {
                    fs.unlinkSync(full);
                    deleted.push(dll);
                }
                catch (err) {
                    console.warn(`Could not remove ${dll}:`, err.message);
                }
            }
        }
        // Check OpenSteamDel.json if present
        const delListFile = path.join(steamPath, "OpenSteamDel.json");
        if (fs.existsSync(delListFile)) {
            try {
                const raw = fs.readFileSync(delListFile, "utf-8");
                const files = JSON.parse(raw);
                for (const f of files) {
                    const target = path.join(steamPath, f);
                    if (fs.existsSync(target)) {
                        fs.unlinkSync(target);
                        deleted.push(f);
                    }
                }
                fs.unlinkSync(delListFile);
            }
            catch { }
        }
        return {
            success: true,
            message: `Unpatched Steam successfully. Removed ${deleted.length} hook file(s).`
        };
    }
}
exports.SteamService = SteamService;
