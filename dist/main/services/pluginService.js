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
exports.PluginService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const adm_zip_1 = __importDefault(require("adm-zip"));
class PluginService {
    steamService;
    constructor(steamService) {
        this.steamService = steamService;
    }
    async installMillennium() {
        const tempDir = os.tmpdir();
        const installerPath = path.join(tempDir, "MillenniumInstaller.exe");
        try {
            const url = "https://github.com/SteamClientHomebrew/Installer/releases/latest/download/MillenniumInstaller-Windows.exe";
            const res = await fetch(url, {
                headers: { "User-Agent": "OpenSteam-Manager/1.0" }
            });
            if (!res.ok) {
                throw new Error(`Failed to download Millennium: HTTP ${res.status}`);
            }
            const buf = await res.arrayBuffer();
            fs.writeFileSync(installerPath, Buffer.from(buf));
            if (os.platform() === "win32") {
                const child = (0, child_process_1.spawn)(installerPath, [], { detached: true, stdio: "ignore" });
                child.unref();
                return {
                    success: true,
                    message: "Millennium installer launched successfully. Complete the setup wizard in Windows."
                };
            }
            else {
                return {
                    success: true,
                    message: `Millennium installer downloaded to ${installerPath}. Execute via Wine or your Windows host.`
                };
            }
        }
        catch (err) {
            return { success: false, message: `Millennium installation failed: ${err.message}` };
        }
    }
    async installLuaManager() {
        const steamPath = await this.steamService.getSteamPath();
        if (!fs.existsSync(steamPath)) {
            throw new Error(`Steam directory not found at: ${steamPath}`);
        }
        const pluginsFolder = path.join(steamPath, "plugins");
        const targetPluginDir = path.join(pluginsFolder, "LuaManager");
        const tempZip = path.join(os.tmpdir(), "LuaManager_Temp.zip");
        try {
            if (!fs.existsSync(pluginsFolder)) {
                fs.mkdirSync(pluginsFolder, { recursive: true });
            }
            const url = "https://github.com/Abrahamqb/OpenSteam/raw/refs/heads/master/Plugins/LuaManager.zip";
            const res = await fetch(url, {
                headers: { "User-Agent": "OpenSteamManager" }
            });
            if (!res.ok) {
                throw new Error(`Failed to download LuaManager plugin: HTTP ${res.status}`);
            }
            const buf = await res.arrayBuffer();
            fs.writeFileSync(tempZip, Buffer.from(buf));
            if (fs.existsSync(targetPluginDir)) {
                fs.rmSync(targetPluginDir, { recursive: true, force: true });
            }
            const zip = new adm_zip_1.default(tempZip);
            zip.extractAllTo(pluginsFolder, true);
            return {
                success: true,
                message: "LuaManager plugin successfully installed into Steam/plugins! Activate it inside Millennium settings."
            };
        }
        finally {
            try {
                if (fs.existsSync(tempZip))
                    fs.unlinkSync(tempZip);
            }
            catch { }
        }
    }
}
exports.PluginService = PluginService;
