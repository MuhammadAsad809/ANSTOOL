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
        const luaFolder = path.join(steamPath, "config", this.steamService.getLuaFolder());
        const depotCache = path.join(steamPath, "depotcache");
        if (!fs.existsSync(luaFolder))
            fs.mkdirSync(luaFolder, { recursive: true });
        if (!fs.existsSync(depotCache))
            fs.mkdirSync(depotCache, { recursive: true });
        // 1. Fetch Depot Keys
        const depotKeys = await this.getDepotKeys();
        // 2. Query SteamProof API for depots & manifest info
        const infoUrl = `${STEAMPROOF_API}/apps/depots?ids=${appId}`;
        const dlUrl = `${STEAMPROOF_API}/app/${appId}/manifests/download`;
        const [infoRes, dlRes] = await Promise.all([
            fetch(infoUrl, { headers: { "User-Agent": "OpenSteam-Manager/1.0" } }),
            fetch(dlUrl, { headers: { "User-Agent": "OpenSteam-Manager/1.0" } })
        ]);
        if (!infoRes.ok) {
            throw new Error(`SteamProof API error: HTTP ${infoRes.status}`);
        }
        const infoJson = await infoRes.json();
        if (!infoJson.apps || infoJson.apps.length === 0) {
            throw new Error(`SteamProof API returned no depot data for AppID ${appId}.`);
        }
        const appData = infoJson.apps[0];
        const targetLuaPath = path.join(luaFolder, `${appId}.lua`);
        // 3. Build base Lua script
        const lines = [
            `-- Open Steam Lua Generator v3.0`,
            `-- AppID: ${appId}`,
            `addappid(${appId})`
        ];
        if (appData.depots && Array.isArray(appData.depots)) {
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
        // 4. Download physical binary manifests if dlRes succeeded
        let manifestsCount = 0;
        const manifestEntries = [];
        if (dlRes.ok) {
            try {
                const dlJson = await dlRes.json();
                if (dlJson.manifests && Array.isArray(dlJson.manifests)) {
                    for (const m of dlJson.manifests) {
                        const destManifest = path.join(depotCache, `${m.depotId}_${m.manifestId}.manifest`);
                        if (!fs.existsSync(destManifest) && m.url) {
                            try {
                                const mFileRes = await fetch(m.url, {
                                    headers: { "User-Agent": "OpenSteam-Manager/1.0" }
                                });
                                if (mFileRes.ok) {
                                    const buf = await mFileRes.arrayBuffer();
                                    fs.writeFileSync(destManifest, Buffer.from(buf));
                                    manifestsCount++;
                                }
                            }
                            catch (mErr) {
                                console.warn(`Failed to download physical manifest ${m.manifestId}:`, mErr);
                            }
                        }
                        else if (fs.existsSync(destManifest)) {
                            manifestsCount++;
                        }
                        // Find matching depot for size
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
            catch (err) {
                console.warn("Error parsing manifest download response:", err);
            }
        }
        // Fallback to manifests list from infoJson if dlRes was empty
        if (manifestEntries.length === 0 && appData.depots) {
            for (const depot of appData.depots) {
                const dId = String(depot.depotId);
                if (depot.manifests) {
                    const pub = depot.manifests.public;
                    if (pub && pub.manifestId) {
                        if (depot.maxSize && Number(depot.maxSize) > 0) {
                            manifestEntries.push(`setManifestid(${dId}, "${pub.manifestId}", ${depot.maxSize})`);
                        }
                        else {
                            manifestEntries.push(`setManifestid(${dId}, "${pub.manifestId}")`);
                        }
                    }
                }
            }
        }
        if (manifestEntries.length > 0) {
            lines.push("");
            lines.push(`-- SteamProof Manifests (updated ${new Date().toISOString()})`);
            lines.push(...manifestEntries);
        }
        fs.writeFileSync(targetLuaPath, lines.join("\n") + "\n", "utf-8");
        const totalBindings = manifestEntries.length;
        return {
            success: true,
            luaPath: targetLuaPath,
            manifestsCount: totalBindings,
            message: `Successfully generated Lua unlock with ${totalBindings} depot manifest binding(s) for AppID ${appId}!`
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
        const luaFolder = path.join(steamPath, "config", this.steamService.getLuaFolder());
        if (!fs.existsSync(luaFolder))
            return [];
        return fs.readdirSync(luaFolder).filter((f) => f.endsWith(".lua"));
    }
    async removeLua(appId) {
        const steamPath = await this.steamService.getSteamPath();
        const target = path.join(steamPath, "config", this.steamService.getLuaFolder(), `${appId}.lua`);
        if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            return true;
        }
        return false;
    }
}
exports.LuaService = LuaService;
