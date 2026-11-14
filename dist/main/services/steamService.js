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
            // 1. Query Windows Registry via native reg.exe (The active, running Steam path)
            try {
                const { stdout } = await execAsync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { timeout: 1500 });
                const match = stdout.match(/SteamPath\s+REG_SZ\s+(.*)/i);
                if (match && match[1]) {
                    const regPath = match[1].trim().replace(/\//g, "\\");
                    if (fs.existsSync(regPath)) {
                        return regPath;
                    }
                }
            }
            catch { }
            // 2. Query HKLM Registry fallback
            try {
                const { stdout } = await execAsync('reg query "HKLM\\Software\\Valve\\Steam" /v InstallPath', { timeout: 1500 });
                const match = stdout.match(/InstallPath\s+REG_SZ\s+(.*)/i);
                if (match && match[1]) {
                    const regPath = match[1].trim().replace(/\//g, "\\");
                    if (fs.existsSync(regPath)) {
                        return regPath;
                    }
                }
            }
            catch { }
            // 3. Check standard install directories
            const progFiles86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
            const progFiles = process.env["ProgramFiles"] || "C:\\Program Files";
            const defaultPaths = [
                path.join(progFiles86, "Steam"),
                path.join(progFiles, "Steam"),
                "D:\\Steam",
                "E:\\Steam",
                "C:\\Steam"
            ];
            for (const p of defaultPaths) {
                if (fs.existsSync(p))
                    return p;
            }
            return path.join(progFiles86, "Steam");
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
            return path.join(home, ".local/share/Steam");
        }
    }
    async getSteamPathInfo() {
        try {
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
            const hasLoader = injectedFiles.some((f) => f === "dwmapi.dll" || f === "xinput1_4.dll" || f === "hid.dll" || f === "wtsapi32.dll");
            const hasCore = injectedFiles.includes("OpenSteamTool.dll");
            const isPatched = hasLoader && hasCore;
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
        catch (err) {
            return {
                path: "C:\\Program Files (x86)\\Steam",
                isDefault: true,
                exists: false,
                isPatched: false,
                injectedFiles: [],
                luaPath: "",
                depotCachePath: ""
            };
        }
    }
    async getProcessStatus() {
        const platform = os.platform();
        try {
            if (platform === "win32") {
                let isSteamRunning = false;
                // Method 1: tasklist without restrictive /FI filter (works across Wine, Winlator, Win 7/10/11)
                try {
                    const { stdout } = await execAsync('tasklist /NH', { timeout: 4500 });
                    if (stdout && stdout.toLowerCase().includes("steam.exe")) {
                        isSteamRunning = true;
                    }
                }
                catch { }
                // Method 2: tasklist with /FI filter fallback
                if (!isSteamRunning) {
                    try {
                        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq steam.exe" /NH', { timeout: 3500 });
                        if (stdout && stdout.toLowerCase().includes("steam.exe")) {
                            isSteamRunning = true;
                        }
                    }
                    catch { }
                }
                // Method 3: wmic fallback
                if (!isSteamRunning) {
                    try {
                        const { stdout } = await execAsync('wmic process where "name=\'steam.exe\'" get name', { timeout: 3500 });
                        if (stdout && stdout.toLowerCase().includes("steam.exe")) {
                            isSteamRunning = true;
                        }
                    }
                    catch { }
                }
                // Method 4: steam.pid check in Steam directory
                if (!isSteamRunning) {
                    try {
                        const steamPath = await this.getSteamPath();
                        const pidFile = path.join(steamPath, "steam.pid");
                        if (fs.existsSync(pidFile)) {
                            isSteamRunning = true;
                        }
                    }
                    catch { }
                }
                return {
                    steamRunning: isSteamRunning,
                    helperRunning: isSteamRunning
                };
            }
            else {
                const { stdout } = await execAsync("pgrep -f steam || true", { timeout: 2500 });
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
                // Standard taskkill without /T which causes errors in Wine/Winlator
                await execAsync("taskkill /F /IM steam.exe 2>nul || true");
                await execAsync("taskkill /F /IM steamwebhelper.exe 2>nul || true");
                try {
                    await execAsync('wmic process where "name=\'steam.exe\'" call terminate 2>nul || true');
                }
                catch { }
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
    async startSteam() {
        const steamPath = await this.getSteamPath();
        const platform = os.platform();
        try {
            if (platform === "win32") {
                const steamExe = path.join(steamPath, "Steam.exe");
                if (fs.existsSync(steamExe)) {
                    (0, child_process_1.spawn)(steamExe, [], {
                        detached: true,
                        stdio: "ignore"
                    }).unref();
                    return true;
                }
            }
            else {
                const steamBin = path.join(steamPath, "steam.sh");
                const cmd = fs.existsSync(steamBin) ? steamBin : "steam";
                (0, child_process_1.spawn)(cmd, [], {
                    detached: true,
                    stdio: "ignore"
                }).unref();
                return true;
            }
            return false;
        }
        catch (err) {
            console.error("Failed to start Steam:", err);
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
                const args = disableWebHelper ? ["-no-browser", "+open", "steam://open/minigameslist"] : [];
                if (fs.existsSync(steamExe)) {
                    (0, child_process_1.spawn)(steamExe, args, {
                        detached: true,
                        stdio: "ignore"
                    }).unref();
                    return true;
                }
            }
            else {
                const steamBin = path.join(steamPath, "steam.sh");
                const cmd = fs.existsSync(steamBin) ? steamBin : "steam";
                (0, child_process_1.spawn)(cmd, disableWebHelper ? ["-no-browser"] : [], {
                    detached: true,
                    stdio: "ignore"
                }).unref();
                return true;
            }
            return false;
        }
        catch (err) {
            console.error("Failed to restart Steam:", err);
            return false;
        }
    }
    async patchSteam(mode = 0) {
        const steamPath = await this.getSteamPath();
        if (!fs.existsSync(steamPath)) {
            throw new Error(`Steam directory not found at: ${steamPath}`);
        }
        // Terminate Steam before writing DLL hooks to release locked handles
        await this.killSteamProcesses();
        await new Promise((r) => setTimeout(r, 1200));
        const tempDir = path.join(os.tmpdir(), "anstool_patch");
        if (!fs.existsSync(tempDir)) {
            try {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            catch { }
        }
        const zipPath = path.join(tempDir, "inject.zip");
        try {
            let downloadUrl = "";
            if (mode === 0) {
                // Mode 0 (Recommended): OpenSteamTool complete hook suite (dwmapi.dll + xinput1_4.dll + OpenSteamTool.dll)
                // Try direct release asset link first to avoid GitHub API rate limits
                const directUrl = "https://github.com/OpenSteam001/OpenSteamTool/releases/download/1.4.8/OpenSteamTool-1.4.8-Release.zip";
                let useDirect = false;
                try {
                    const headRes = await fetch(directUrl, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } });
                    if (headRes.ok) {
                        downloadUrl = directUrl;
                        useDirect = true;
                    }
                }
                catch { }
                if (!useDirect) {
                    try {
                        const apiRes = await fetch("https://api.github.com/repos/OpenSteam001/OpenSteamTool/releases/latest", {
                            headers: { "User-Agent": "OpenSteamManager" }
                        });
                        if (apiRes.ok) {
                            const data = await apiRes.json();
                            const asset = data.assets?.find((a) => a.name && a.name.toLowerCase().endsWith("-release.zip"));
                            if (asset && asset.browser_download_url) {
                                downloadUrl = asset.browser_download_url;
                            }
                        }
                    }
                    catch { }
                }
                if (!downloadUrl) {
                    downloadUrl = directUrl;
                }
            }
            else {
                // Mode 1: Abrahamqb/OpenSteamMore-Dev inject.zip
                downloadUrl = "https://github.com/Abrahamqb/OpenSteamMore-Dev/releases/latest/download/inject.zip";
            }
            const fileRes = await fetch(downloadUrl, {
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            if (!fileRes.ok) {
                // Fallback to direct URL if API failed
                if (downloadUrl !== "https://github.com/OpenSteam001/OpenSteamTool/releases/download/1.4.8/OpenSteamTool-1.4.8-Release.zip") {
                    const fbRes = await fetch("https://github.com/OpenSteam001/OpenSteamTool/releases/download/1.4.8/OpenSteamTool-1.4.8-Release.zip", {
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });
                    if (fbRes.ok) {
                        const buf = await fbRes.arrayBuffer();
                        fs.writeFileSync(zipPath, Buffer.from(buf));
                    }
                    else {
                        throw new Error(`Failed to download patch payload: HTTP ${fileRes.status}`);
                    }
                }
                else {
                    throw new Error(`Failed to download patch payload: HTTP ${fileRes.status}`);
                }
            }
            else {
                const arrayBuffer = await fileRes.arrayBuffer();
                fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));
            }
            // Extract all DLL and JSON files directly into Steam directory
            const zip = new adm_zip_1.default(zipPath);
            const entries = zip.getEntries();
            for (const entry of entries) {
                if (entry.isDirectory)
                    continue;
                const filename = path.basename(entry.entryName);
                const lower = filename.toLowerCase();
                if (lower.endsWith(".dll") || lower.endsWith(".json")) {
                    const destFile = path.join(steamPath, filename);
                    try {
                        fs.writeFileSync(destFile, entry.getData());
                    }
                    catch (e) {
                        console.warn(`Could not write ${destFile}:`, e.message);
                    }
                }
            }
            return {
                success: true,
                message: `Steam successfully patched! Proxy hooks (OpenSteamTool + Loaders) are active.`
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
