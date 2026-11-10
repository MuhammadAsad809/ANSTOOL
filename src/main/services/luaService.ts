import * as path from "path";
import * as fs from "fs";
import { SteamService } from "./steamService";
import { FixManifestsResult, ManifestDownloadItem, SteamProofApp } from "../../types/opensteam";

const STEAMPROOF_API = "https://api.steamproof.net";
const DEPOT_KEYS_URLS = [
  "https://gitlab.com/steamautocracks/manifesthub/-/raw/main/depotkeys.json",
  "https://api.993499094.xyz/depotkeys.json"
];

export class LuaService {
  private depotKeysCache: Record<string, string> | null = null;

  constructor(private steamService: SteamService) {}

  public async getDepotKeys(cacheDays: number = 7): Promise<Record<string, string>> {
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
      } catch {
        shouldRefresh = true;
      }
    }

    if (shouldRefresh) {
      const mergedKeys: Record<string, string> = {};
      for (const url of DEPOT_KEYS_URLS) {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "OpenSteam-Manager/1.0" }
          });
          if (res.ok) {
            const keys: Record<string, string> = await res.json();
            Object.assign(mergedKeys, keys);
            if (Object.keys(mergedKeys).length > 0) break;
          }
        } catch {
          continue;
        }
      }

      if (Object.keys(mergedKeys).length > 0) {
        this.depotKeysCache = mergedKeys;
        try {
          fs.writeFileSync(cacheFile, JSON.stringify(mergedKeys), "utf-8");
        } catch {}
      } else if (fs.existsSync(cacheFile)) {
        // Fallback to expired cache
        const raw = fs.readFileSync(cacheFile, "utf-8");
        this.depotKeysCache = JSON.parse(raw);
      }
    }

    return this.depotKeysCache || {};
  }

  public async generateAndInstallLua(
    appIdInput: string | number
  ): Promise<{ success: boolean; luaPath: string; manifestsCount: number; message: string }> {
    const appId = String(appIdInput).trim();
    if (!/^\d+$/.test(appId)) {
      throw new Error(`Invalid AppID: ${appId}. Must be numeric.`);
    }

    const steamPath = await this.steamService.getSteamPath();
    const luaFolder = path.join(steamPath, "config", this.steamService.getLuaFolder());
    const depotCache = path.join(steamPath, "depotcache");

    if (!fs.existsSync(luaFolder)) fs.mkdirSync(luaFolder, { recursive: true });
    if (!fs.existsSync(depotCache)) fs.mkdirSync(depotCache, { recursive: true });

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

    const infoJson: any = await infoRes.json();
    if (!infoJson.apps || infoJson.apps.length === 0) {
      throw new Error(`SteamProof API returned no depot data for AppID ${appId}.`);
    }

    const appData: SteamProofApp = infoJson.apps[0];
    const targetLuaPath = path.join(luaFolder, `${appId}.lua`);

    // 3. Build base Lua script
    const lines: string[] = [
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
        } else {
          lines.push(`addappid(${dId}, 0, "")`);
        }
      }
    }

    // 4. Download physical binary manifests if dlRes succeeded
    let manifestsCount = 0;
    const manifestEntries: string[] = [];

    if (dlRes.ok) {
      try {
        const dlJson: any = await dlRes.json();
        if (dlJson.manifests && Array.isArray(dlJson.manifests)) {
          for (const m of dlJson.manifests as ManifestDownloadItem[]) {
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
              } catch (mErr) {
                console.warn(`Failed to download physical manifest ${m.manifestId}:`, mErr);
              }
            } else if (fs.existsSync(destManifest)) {
              manifestsCount++;
            }

            // Find matching depot for size
            const depotInfo = appData.depots?.find((d) => String(d.depotId) === String(m.depotId));
            if (depotInfo && depotInfo.maxSize && Number(depotInfo.maxSize) > 0) {
              manifestEntries.push(`setManifestid(${m.depotId}, "${m.manifestId}", ${depotInfo.maxSize})`);
            } else {
              manifestEntries.push(`setManifestid(${m.depotId}, "${m.manifestId}")`);
            }
          }
        }
      } catch (err) {
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
            } else {
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

    return {
      success: true,
      luaPath: targetLuaPath,
      manifestsCount,
      message: `Successfully installed Lua script and synced ${manifestsCount} manifest(s) for AppID ${appId}!`
    };
  }

  public async fixAllManifests(): Promise<FixManifestsResult> {
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
    const needsUpdateIds: string[] = [];
    const luaData: Map<string, { path: string; content: string }> = new Map();
    let missingDepotsCount = 0;

    for (const f of files) {
      const appId = path.basename(f, ".lua");
      if (!/^\d+$/.test(appId)) continue;

      const fullPath = path.join(luaFolder, f);
      const content = fs.readFileSync(fullPath, "utf-8");
      luaData.set(appId, { path: fullPath, content });

      const depotIdMatches = Array.from(content.matchAll(/addappid\((\d+)/g)).map((m) => m[1]);

      let hasMissing = false;
      for (const dId of depotIdMatches) {
        if (dId === appId) continue;
        const exists = fs.readdirSync(depotCache).some((mf) => mf.startsWith(`${dId}_`) && mf.endsWith(".manifest"));
        if (!exists) {
          hasMissing = true;
          missingDepotsCount++;
        }
      }

      if (hasMissing || depotIdMatches.length === 0) {
        needsUpdateIds.push(appId);
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
        if (!infoRes.ok) continue;

        const infoJson: any = await infoRes.json();
        if (!infoJson.apps) continue;

        for (const app of infoJson.apps) {
          const appId = String(app.appId);
          const localInfo = luaData.get(appId);
          if (!localInfo) continue;

          // Download physical manifests
          try {
            const dlRes = await fetch(`${STEAMPROOF_API}/app/${appId}/manifests/download`, {
              headers: { "User-Agent": "OpenSteam-Manager/1.0" }
            });
            if (dlRes.ok) {
              const dlJson: any = await dlRes.json();
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
          } catch {}

          // Generate manifest injection lines
          const manifestEntries: string[] = [];
          if (app.depots && Array.isArray(app.depots)) {
            for (const depot of app.depots) {
              const dId = String(depot.depotId);
              if (depot.manifests?.public?.manifestId) {
                const mId = depot.manifests.public.manifestId;
                if (depot.maxSize && Number(depot.maxSize) > 0) {
                  manifestEntries.push(`setManifestid(${dId}, "${mId}", ${depot.maxSize})`);
                } else {
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
      } catch (err) {
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

  public async importManualLua(
    sourceFilePath?: string
  ): Promise<{ success: boolean; importedFile: string; message: string }> {
    if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
      throw new Error("Specified Lua file does not exist.");
    }

    const steamPath = await this.steamService.getSteamPath();
    const luaFolder = path.join(steamPath, "config", this.steamService.getLuaFolder());
    if (!fs.existsSync(luaFolder)) fs.mkdirSync(luaFolder, { recursive: true });

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

  public async listInstalledLuas(): Promise<string[]> {
    const steamPath = await this.steamService.getSteamPath();
    const luaFolder = path.join(steamPath, "config", this.steamService.getLuaFolder());
    if (!fs.existsSync(luaFolder)) return [];
    return fs.readdirSync(luaFolder).filter((f) => f.endsWith(".lua"));
  }

  public async removeLua(appId: string): Promise<boolean> {
    const steamPath = await this.steamService.getSteamPath();
    const target = path.join(steamPath, "config", this.steamService.getLuaFolder(), `${appId}.lua`);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      return true;
    }
    return false;
  }
}
