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
exports.LuaService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const STEAMPROOF_API = "https://api.steamproof.net";
const DEPOT_KEYS_URLS = [
    "https://gitlab.com/steamautocracks/manifesthub/-/raw/main/depotkeys.json",
    "https://api.993499094.xyz/depotkeys.json"
];
class LuaService {
    steamService;
    depotKeysCache = null;
    constructor(steamService) {
        this.steamService = steamService;
    }
    async getDepotKeys(cacheDays = 7) {
        if (this.depotKeysCache) {
            return this.depotKeysCache;
        }
        const steamPath = await this.steamService.getSteamPath();
        const cacheDir = path.join(steamPath, "cache");
        const cacheFile = path.join(cacheDir, "depotkeys.json");
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        let shouldRefresh = true;
        if (fs.existsSync(cacheFile)) {
            try {
                const stats = fs.statSync(cacheFile);
                const ageMs = Date.now() - stats.mtimeMs;
                const maxAgeMs = cacheDays * 24 * 60 * 60 * 1000;
                if (ageMs < maxAgeMs) {
                    const raw = fs.readFileSync(cacheFile, "utf-8");
                    this.depotKeysCache = JSON.parse(raw);
                    if (this.depotKeysCache && Object.keys(this.depotKeysCache).length > 0) {
                        shouldRefresh = false;
                    }
                }
            }
            catch {
                shouldRefresh = true;
            }
        }
        if (shouldRefresh) {
            const mergedKeys = {};
            for (const url of DEPOT_KEYS_URLS) {
                try {
                    const res = await fetch(url, {
                        headers: { "User-Agent": "OpenSteam-Manager/1.0" }
                    });
                    if (res.ok) {
                        const keys = await res.json();
                        Object.assign(mergedKeys, keys);
                        if (Object.keys(mergedKeys).length > 0)
                            break;
                    }
                }
                catch {
                    continue;
                }
            }
            if (Object.keys(mergedKeys).length > 0) {
                this.depotKeysCache = mergedKeys;
                try {
                    fs.writeFileSync(cacheFile, JSON.stringify(mergedKeys), "utf-8");
                }
                catch { }
            }
            else if (fs.existsSync(cacheFile)) {
                // Fallback to expired cache
                const raw = fs.readFileSync(cacheFile, "utf-8");
                this.depotKeysCache = JSON.parse(raw);
            }
        }
        return this.depotKeysCache || {};
    }
    async generateAndInstallLua(appIdInput) {
        const appId = String(appIdInput).trim();
        if (!/^\d+$/.test(appId)) {
            throw new Error(`Invalid AppID: ${appId}. Must be numeric.`);
        }
        const steamPath = await this.steamService.getSteamPath();
        const luaFolder1 = path.join(steamPath, "config", "stplug-in");
        const luaFolder2 = path.join(steamPath, "stplug-in");
        const luaFolder3 = path.join(steamPath, "config", "lua");
        const depotCache = path.join(steamPath, "depotcache");
        try {
            if (!fs.existsSync(luaFolder1))
                fs.mkdirSync(luaFolder1, { recursive: true });
        }
        catch { }
        try {
            if (!fs.existsSync(luaFolder2))
                fs.mkdirSync(luaFolder2, { recursive: true });
        }
        catch { }
        try {
            if (!fs.existsSync(luaFolder3))
                fs.mkdirSync(luaFolder3, { recursive: true });
        }
        catch { }
        try {
            if (!fs.existsSync(depotCache))
                fs.mkdirSync(depotCache, { recursive: true });
        }
        catch { }
        // 1. Fetch Depot Keys
        let depotKeys = {};
        try {
            depotKeys = await this.getDepotKeys();
        }
        catch { }
        // 2. Fetch Official Steam Store details (Game name & DLCs)
        let gameName = `AppID ${appId}`;
        let dlcIds = [];
        try {
            const storeController = new AbortController();
            const storeTimeout = setTimeout(() => storeController.abort(), 4000);
            const storeRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`, {
                signal: storeController.signal,
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            clearTimeout(storeTimeout);
            if (storeRes.ok) {
                const storeJson = await storeRes.json();
                if (storeJson[appId]?.success && storeJson[appId]?.data) {
                    gameName = storeJson[appId].data.name || gameName;
                    if (Array.isArray(storeJson[appId].data.dlc)) {
                        dlcIds = storeJson[appId].data.dlc;
                    }
                }
            }
        }
        catch { }
        const targetLuaPath = path.join(luaFolder1, `${appId}.lua`);
        const lines = [
            `-- ANSTOOL 1-Click Game Unlocker`,
            `-- Game: ${gameName}`,
            `-- AppID: ${appId}`,
            `addappid(${appId})`
        ];
        // Add all official DLCs
        if (dlcIds.length > 0) {
            lines.push("");
            lines.push(`-- Official DLC Unlocks (${dlcIds.length} DLCs)`);
            for (const dlc of dlcIds) {
                lines.push(`addappid(${dlc})`);
            }
        }
        // 3. Attempt SteamProof API for specific depot keys and physical manifests
        let manifestsCount = 0;
        const manifestEntries = [];
        let steamProofSuccess = false;
        try {
            const spController = new AbortController();
            const spTimeout = setTimeout(() => spController.abort(), 4000);
            const infoUrl = `${STEAMPROOF_API}/apps/depots?ids=${appId}`;
            const dlUrl = `${STEAMPROOF_API}/app/${appId}/manifests/download`;
            const [infoRes, dlRes] = await Promise.all([
                fetch(infoUrl, { signal: spController.signal, headers: { "User-Agent": "OpenSteam-Manager/1.0" } }).catch(() => null),
                fetch(dlUrl, { signal: spController.signal, headers: { "User-Agent": "OpenSteam-Manager/1.0" } }).catch(() => null)
            ]);
            clearTimeout(spTimeout);
            if (infoRes && infoRes.ok) {
                const infoJson = await infoRes.json().catch(() => null);
                if (infoJson && infoJson.apps && infoJson.apps.length > 0) {
                    steamProofSuccess = true;
                    const appData = infoJson.apps[0];
                    if (appData.depots && Array.isArray(appData.depots)) {
                        lines.push("");
                        lines.push(`-- Depot Bindings`);
                        for (const depot of appData.depots) {
                            const dId = String(depot.depotId);
                            const key = depotKeys[dId];
                            if (key) {
                                lines.push(`addappid(${dId}, 1, "${key}")`);
                            }
                            else {
                                lines.push(`addappid(${dId}, 0, "")`);
                            }
                        }
                    }
                    // Download physical binary manifests if available
                    if (dlRes && dlRes.ok) {
                        const dlJson = await dlRes.json().catch(() => null);
                        if (dlJson && dlJson.manifests && Array.isArray(dlJson.manifests)) {
                            for (const m of dlJson.manifests) {
                                const destManifest = path.join(depotCache, `${m.depotId}_${m.manifestId}.manifest`);
                                if (!fs.existsSync(destManifest) && m.url) {
                                    try {
                                        const mFileRes = await fetch(m.url, { headers: { "User-Agent": "OpenSteam-Manager/1.0" } });
                                        if (mFileRes.ok) {
                                            const buf = await mFileRes.arrayBuffer();
                                            fs.writeFileSync(destManifest, Buffer.from(buf));
                                            manifestsCount++;
                                        }
                                    }
                                    catch { }
                                }
                                else if (fs.existsSync(destManifest)) {
                                    manifestsCount++;
                                }
                                const depotInfo = appData.depots?.find((d) => String(d.depotId) === String(m.depotId));
                                if (depotInfo && depotInfo.maxSize && Number(depotInfo.maxSize) > 0) {
                                    manifestEntries.push(`setManifestid(${m.depotId}, "${m.manifestId}", ${depotInfo.maxSize})`);
                                }
                                else {
                                    manifestEntries.push(`setManifestid(${m.depotId}, "${m.manifestId}")`);
                                }
                            }
                        }
                    }
                    // Fallback manifest entries from appData
                    if (manifestEntries.length === 0 && appData.depots) {
                        for (const depot of appData.depots) {
                            const dId = String(depot.depotId);
                            if (depot.manifests?.public?.manifestId) {
                                const mId = depot.manifests.public.manifestId;
                                if (depot.maxSize && Number(depot.maxSize) > 0) {
                                    manifestEntries.push(`setManifestid(${dId}, "${mId}", ${depot.maxSize})`);
                                }
                                else {
                                    manifestEntries.push(`setManifestid(${dId}, "${mId}")`);
                                }
                            }
                        }
                    }
                }
            }
        }
        catch { }
        // Fallback: If SteamProof was blocked, search our depotKeys database for any related depots
        if (!steamProofSuccess && Object.keys(depotKeys).length > 0) {
            const relatedDepots = Object.entries(depotKeys).filter(([dId]) => {
                const idNum = Number(dId);
                const appNum = Number(appId);
                return idNum >= appNum && idNum <= appNum + 20;
            });
            if (relatedDepots.length > 0) {
                lines.push("");
                lines.push(`-- Auto-matched Depots (${relatedDepots.length})`);
                for (const [dId, key] of relatedDepots) {
                    lines.push(`addappid(${dId}, 1, "${key}")`);
                }
            }
        }
        if (manifestEntries.length > 0) {
            lines.push("");
            lines.push(`-- Depot Manifests`);
            lines.push(...manifestEntries);
        }
        const finalContent = lines.join("\n") + "\n";
        try {
            fs.writeFileSync(path.join(luaFolder1, `${appId}.lua`), finalContent, "utf-8");
        }
        catch { }
        try {
            fs.writeFileSync(path.join(luaFolder2, `${appId}.lua`), finalContent, "utf-8");
        }
        catch { }
        try {
            fs.writeFileSync(path.join(luaFolder3, `${appId}.lua`), finalContent, "utf-8");
        }
        catch { }
        return {
            success: true,
            luaPath: path.join(luaFolder1, `${appId}.lua`),
            manifestsCount: manifestEntries.length,
            message: `Unlocked "${gameName}" (${appId}) successfully!`
        };
    }
    async fixAllManifests() {
        const steamPath = await this.steamService.getSteamPath();
        const luaFolder = path.join(steamPath, "config", this.steamService.getLuaFolder());
        const depotCache = path.join(steamPath, "depotcache");
        if (!fs.existsSync(luaFolder)) {
            return { totalManifestsDownloaded: 0, luaFilesUpdated: 0, scannedCount: 0, missingDepots: 0 };
        }
        if (!fs.existsSync(depotCache)) {
            fs.mkdirSync(depotCache, { recursive: true });
        }
        const files = fs.readdirSync(luaFolder).filter((f) => f.endsWith(".lua"));
        const needsUpdateIds = [];
        const luaData = new Map();
        let missingDepotsCount = 0;
        for (const f of files) {
            const appId = path.basename(f, ".lua");
            if (!/^\d+$/.test(appId))
                continue;
            const fullPath = path.join(luaFolder, f);
            const content = fs.readFileSync(fullPath, "utf-8");
            luaData.set(appId, { path: fullPath, content });
            const hasManifestBindings = content.includes("setManifestid");
            const depotIdMatches = Array.from(content.matchAll(/addappid\((\d+)/g)).map((m) => m[1]);
            if (!hasManifestBindings || depotIdMatches.length === 0) {
                needsUpdateIds.push(appId);
                missingDepotsCount += depotIdMatches.length > 0 ? depotIdMatches.length - 1 : 1;
            }
        }
        if (needsUpdateIds.length === 0) {
            return {
                totalManifestsDownloaded: 0,
                luaFilesUpdated: 0,
                scannedCount: files.length,
                missingDepots: 0
            };
        }
        let totalDownloaded = 0;
        let luaFilesUpdated = 0;
        // Batch query SteamProof API in chunks of 20
        const chunkSize = 20;
        for (let i = 0; i < needsUpdateIds.length; i += chunkSize) {
            const chunk = needsUpdateIds.slice(i, i + chunkSize);
            const idsQuery = chunk.join(",");
            try {
                const infoRes = await fetch(`${STEAMPROOF_API}/apps/depots?ids=${idsQuery}`, {
                    headers: { "User-Agent": "OpenSteam-Manager/1.0" }
                });
                if (!infoRes.ok)
                    continue;
                const infoJson = await infoRes.json();
                if (!infoJson.apps)
                    continue;
                for (const app of infoJson.apps) {
                    const appId = String(app.appId);
                    const localInfo = luaData.get(appId);
                    if (!localInfo)
                        continue;
                    // Download physical manifests
                    try {
                        const dlRes = await fetch(`${STEAMPROOF_API}/app/${appId}/manifests/download`, {
                            headers: { "User-Agent": "OpenSteam-Manager/1.0" }
                        });
                        if (dlRes.ok) {
                            const dlJson = await dlRes.json();
                            if (dlJson.manifests) {
                                for (const m of dlJson.manifests) {
                                    const mFile = path.join(depotCache, `${m.depotId}_${m.manifestId}.manifest`);
                                    if (!fs.existsSync(mFile) && m.url) {
                                        const mBufRes = await fetch(m.url, { headers: { "User-Agent": "OpenSteam-Manager/1.0" } });
                                        if (mBufRes.ok) {
                                            const buf = await mBufRes.arrayBuffer();
                                            fs.writeFileSync(mFile, Buffer.from(buf));
                                            totalDownloaded++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch { }
                    // Generate manifest injection lines
                    const manifestEntries = [];
                    if (app.depots && Array.isArray(app.depots)) {
                        for (const depot of app.depots) {
                            const dId = String(depot.depotId);
                            if (depot.manifests?.public?.manifestId) {
                                const mId = depot.manifests.public.manifestId;
                                if (depot.maxSize && Number(depot.maxSize) > 0) {
                                    manifestEntries.push(`setManifestid(${dId}, "${mId}", ${depot.maxSize})`);
                                }
                                else {
                                    manifestEntries.push(`setManifestid(${dId}, "${mId}")`);
                                }
                            }
                        }
                    }
                    if (manifestEntries.length > 0) {
                        // Strip old setManifestid lines and manifests comment
                        let clean = localInfo.content
                            .replace(/\r?\n?setManifestid\([^\)]*\);?/gi, "")
                            .replace(/(\r?\n-- SteamProof Manifests.*)/gis, "")
                            .trimEnd();
                        const updatedContent = [
                            clean,
                            "",
                            `-- SteamProof Manifests (updated ${new Date().toISOString()})`,
                            ...manifestEntries
                        ].join("\n") + "\n";
                        fs.writeFileSync(localInfo.path, updatedContent, "utf-8");
                        luaFilesUpdated++;
                    }
                }
            }
            catch (err) {
                console.warn("Error processing fix batch:", err);
            }
        }
        return {
            totalManifestsDownloaded: totalDownloaded,
            luaFilesUpdated,
            scannedCount: files.length,
            missingDepots: missingDepotsCount
        };
    }
    async importManualLua(sourceFilePath) {
        if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
            throw new Error("Specified Lua file does not exist.");
        }
        const steamPath = await this.steamService.getSteamPath();
        const luaFolder = path.join(steamPath, "config", this.steamService.getLuaFolder());
        if (!fs.existsSync(luaFolder))
            fs.mkdirSync(luaFolder, { recursive: true });
        const fileName = path.basename(sourceFilePath);
        const dest = path.join(luaFolder, fileName);
        fs.copyFileSync(sourceFilePath, dest);
        // Auto-fix manifests for imported lua
        await this.fixAllManifests();
        return {
            success: true,
            importedFile: fileName,
            message: `Imported ${fileName} to ${luaFolder} and synchronized manifests.`
        };
    }
    async listInstalledLuas() {
        const steamPath = await this.steamService.getSteamPath();
        const folders = [
            path.join(steamPath, "config", "stplug-in"),
            path.join(steamPath, "stplug-in")
        ];
        const set = new Set();
        for (const f of folders) {
            if (fs.existsSync(f)) {
                try {
                    for (const file of fs.readdirSync(f)) {
                        if (file.endsWith(".lua"))
                            set.add(file);
                    }
                }
                catch { }
            }
        }
        return Array.from(set);
    }
    async getInstalledLuasWithNames() {
        const steamPath = await this.steamService.getSteamPath();
        const folders = [
            path.join(steamPath, "config", "stplug-in"),
            path.join(steamPath, "stplug-in"),
            path.join(steamPath, "config", "lua")
        ];
        const map = new Map();
        for (const f of folders) {
            if (fs.existsSync(f)) {
                try {
                    for (const file of fs.readdirSync(f)) {
                        if (file.endsWith(".lua")) {
                            const appId = file.replace(".lua", "");
                            if (!map.has(appId)) {
                                let name = `Steam AppID ${appId}`;
                                try {
                                    const content = fs.readFileSync(path.join(f, file), "utf-8");
                                    const m = content.match(/--\s*Game:\s*(.*)/i);
                                    if (m && m[1])
                                        name = m[1].trim();
                                }
                                catch { }
                                map.set(appId, name);
                            }
                        }
                    }
                }
                catch { }
            }
        }
        return Array.from(map.entries()).map(([appId, name]) => ({ appId, name }));
    }
    async removeLua(appId) {
        const steamPath = await this.steamService.getSteamPath();
        const targets = [
            path.join(steamPath, "config", "stplug-in", `${appId}.lua`),
            path.join(steamPath, "stplug-in", `${appId}.lua`),
            path.join(steamPath, "config", "lua", `${appId}.lua`)
        ];
        let removed = false;
        for (const target of targets) {
            if (fs.existsSync(target)) {
                try {
                    fs.unlinkSync(target);
                    removed = true;
                }
                catch { }
            }
        }
        return removed;
    }
}
exports.LuaService = LuaService;
