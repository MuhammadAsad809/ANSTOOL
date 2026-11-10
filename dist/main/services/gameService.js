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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const CATALOG_URL = "https://raw.githubusercontent.com/SteamTools-Team/GameList/refs/heads/main/games.json";
class GameService {
    steamService;
    cachedGameList = null;
    cacheFilePath;
    constructor(steamService) {
        this.steamService = steamService;
        const tempDir = path.join(os.tmpdir(), "OpenSteamData");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        this.cacheFilePath = path.join(tempDir, "games.json");
    }
    async getInstalledGames() {
        const steamPath = await this.steamService.getSteamPath();
        if (!fs.existsSync(steamPath)) {
            return [];
        }
        const libraryPaths = new Set([steamPath]);
        // Parse libraryfolders.vdf
        const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
        if (fs.existsSync(vdfPath)) {
            try {
                const vdfContent = fs.readFileSync(vdfPath, "utf-8");
                const pathMatches = vdfContent.matchAll(/"path"\s+"([^"]+)"/g);
                for (const match of pathMatches) {
                    const rawPath = match[1].replace(/\\\\/g, "\\");
                    if (fs.existsSync(rawPath)) {
                        libraryPaths.add(rawPath);
                    }
                }
            }
            catch (err) {
                console.warn("Error reading libraryfolders.vdf:", err);
            }
        }
        const installedGames = new Map();
        for (const libPath of libraryPaths) {
            const steamAppsPath = path.join(libPath, "steamapps");
            if (!fs.existsSync(steamAppsPath))
                continue;
            try {
                const files = fs.readdirSync(steamAppsPath);
                for (const file of files) {
                    if (file.startsWith("appmanifest_") && file.endsWith(".acf")) {
                        try {
                            const fullPath = path.join(steamAppsPath, file);
                            const content = fs.readFileSync(fullPath, "utf-8");
                            const appidMatch = content.match(/"appid"\s+"(\d+)"/);
                            const nameMatch = content.match(/"name"\s+"([^"]+)"/);
                            const installdirMatch = content.match(/"installdir"\s+"([^"]+)"/);
                            if (appidMatch && nameMatch) {
                                const appid = appidMatch[1];
                                if (appid === "228980" || appid === "250820")
                                    continue; // redistributables
                                const installDirName = installdirMatch ? installdirMatch[1] : "";
                                const gamePath = installDirName
                                    ? path.join(steamAppsPath, "common", installDirName)
                                    : "";
                                installedGames.set(appid, {
                                    appid,
                                    name: nameMatch[1],
                                    installed: true,
                                    installPath: gamePath
                                });
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }
        return Array.from(installedGames.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
    async syncCatalog() {
        try {
            const res = await fetch(CATALOG_URL, {
                headers: { "User-Agent": "OpenSteam-Manager/1.0" }
            });
            if (!res.ok) {
                throw new Error(`Failed to download game list: HTTP ${res.status}`);
            }
            const text = await res.text();
            fs.writeFileSync(this.cacheFilePath, text, "utf-8");
            this.cachedGameList = JSON.parse(text);
            return {
                success: true,
                totalGames: this.cachedGameList ? this.cachedGameList.length : 0
            };
        }
        catch (err) {
            console.error("Failed to sync catalog:", err);
            return { success: false, totalGames: 0 };
        }
    }
    async loadCatalog() {
        if (this.cachedGameList && this.cachedGameList.length > 0) {
            return this.cachedGameList;
        }
        if (fs.existsSync(this.cacheFilePath)) {
            try {
                const stats = fs.statSync(this.cacheFilePath);
                const isFresh = Date.now() - stats.mtimeMs < 24 * 60 * 60 * 1000; // 24 hours
                if (isFresh) {
                    const raw = fs.readFileSync(this.cacheFilePath, "utf-8");
                    this.cachedGameList = JSON.parse(raw);
                    if (this.cachedGameList)
                        return this.cachedGameList;
                }
            }
            catch { }
        }
        const syncResult = await this.syncCatalog();
        if (syncResult.success && this.cachedGameList) {
            return this.cachedGameList;
        }
        // Fallback if network failed but old cache exists
        if (fs.existsSync(this.cacheFilePath)) {
            try {
                const raw = fs.readFileSync(this.cacheFilePath, "utf-8");
                this.cachedGameList = JSON.parse(raw);
                if (this.cachedGameList)
                    return this.cachedGameList;
            }
            catch { }
        }
        return [];
    }
    async searchCatalog(query, limit = 50) {
        const list = await this.loadCatalog();
        const cleanQuery = query.trim().toLowerCase();
        if (!cleanQuery) {
            return list.slice(0, limit);
        }
        const isNumeric = /^\d+$/.test(cleanQuery);
        if (isNumeric) {
            const match = list.filter((g) => g.appid === cleanQuery);
            if (match.length > 0)
                return match;
        }
        return list
            .filter((g) => g.name && g.name.toLowerCase().includes(cleanQuery))
            .slice(0, limit);
    }
}
exports.GameService = GameService;
