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
// Curated Top 24 Trending & Modern Games for Instant Zero-Lag Home Display
const DEFAULT_POPULAR_GAMES = [
    { appid: "2358720", name: "Black Myth: Wukong" },
    { appid: "1245620", name: "ELDEN RING" },
    { appid: "1091500", name: "Cyberpunk 2077" },
    { appid: "271590", name: "Grand Theft Auto V" },
    { appid: "1551360", name: "Forza Horizon 5" },
    { appid: "1174180", name: "Red Dead Redemption 2" },
    { appid: "1086940", name: "Baldur's Gate 3" },
    { appid: "730", name: "Counter-Strike 2" },
    { appid: "252490", name: "Rust" },
    { appid: "1817070", name: "Marvel’s Spider-Man Remastered" },
    { appid: "1593500", name: "God of War" },
    { appid: "990080", name: "Hogwarts Legacy" },
    { appid: "1623730", name: "Palworld" },
    { appid: "1938090", name: "Call of Duty®" },
    { appid: "553850", name: "HELLDIVERS™ 2" },
    { appid: "2195250", name: "EA SPORTS FC™ 25" },
    { appid: "2246340", name: "Monster Hunter Wilds" },
    { appid: "814380", name: "Sekiro™: Shadows Die Twice" },
    { appid: "2050650", name: "Resident Evil 4" },
    { appid: "1151640", name: "Horizon Zero Dawn™ Complete Edition" },
    { appid: "377160", name: "Fallout 4" },
    { appid: "1326470", name: "Sons Of The Forest" },
    { appid: "244210", name: "Assetto Corsa" },
    { appid: "227300", name: "Euro Truck Simulator 2" }
];
class GameService {
    steamService;
    cacheFilePath;
    constructor(steamService) {
        this.steamService = steamService;
        const tempDir = path.join(os.tmpdir(), "OpenSteamData");
        if (!fs.existsSync(tempDir)) {
            try {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            catch { }
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
        return { success: true, totalGames: DEFAULT_POPULAR_GAMES.length };
    }
    async searchCatalog(query, limit = 30) {
        const cleanQuery = (query || "").trim();
        // 1. If query is empty, instantly return the top modern trending games
        if (!cleanQuery) {
            return DEFAULT_POPULAR_GAMES.slice(0, limit);
        }
        // 2. Direct numeric AppID search via official Steam Store details API
        const isNumeric = /^\d+$/.test(cleanQuery);
        if (isNumeric) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 4500);
                const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${cleanQuery}`, {
                    signal: controller.signal,
                    headers: { "User-Agent": "Mozilla/5.0" }
                });
                clearTimeout(timeout);
                if (res.ok) {
                    const json = await res.json();
                    if (json[cleanQuery]?.success && json[cleanQuery]?.data?.name) {
                        return [{
                                appid: cleanQuery,
                                name: json[cleanQuery].data.name,
                                installed: false
                            }];
                    }
                }
            }
            catch { }
            // Fallback if network failed for numeric AppID
            const localMatch = DEFAULT_POPULAR_GAMES.find((g) => g.appid === cleanQuery);
            if (localMatch)
                return [localMatch];
            return [{ appid: cleanQuery, name: `Steam Game ${cleanQuery}`, installed: false }];
        }
        // 3. Search Official Steam Store Search API directly
        // This returns the newest, official, live games on Steam!
        const results = [];
        const seenAppIds = new Set();
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4500);
            const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanQuery)}&l=english&cc=US`, {
                signal: controller.signal,
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            clearTimeout(timeout);
            if (res.ok) {
                const json = await res.json();
                if (json.items && Array.isArray(json.items)) {
                    for (const item of json.items) {
                        const appIdStr = String(item.id);
                        if (!seenAppIds.has(appIdStr)) {
                            seenAppIds.add(appIdStr);
                            results.push({
                                appid: appIdStr,
                                name: item.name,
                                installed: false
                            });
                        }
                    }
                }
            }
        }
        catch { }
        // 4. Also match against popular games list to ensure high relevancy
        const lowerQuery = cleanQuery.toLowerCase();
        for (const popGame of DEFAULT_POPULAR_GAMES) {
            if (popGame.name.toLowerCase().includes(lowerQuery) && !seenAppIds.has(popGame.appid)) {
                seenAppIds.add(popGame.appid);
                results.push(popGame);
            }
        }
        // 5. If results are found, return them up to limit
        if (results.length > 0) {
            return results.slice(0, limit);
        }
        // 6. Last resort fallback
        return [{
                appid: "0",
                name: `No results found for "${cleanQuery}"`
            }];
    }
}
exports.GameService = GameService;
