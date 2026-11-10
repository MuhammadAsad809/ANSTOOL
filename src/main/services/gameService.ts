import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { SteamGame } from "../../types/opensteam";
import { SteamService } from "./steamService";

const CATALOG_URL = "https://raw.githubusercontent.com/SteamTools-Team/GameList/refs/heads/main/games.json";

export class GameService {
  private cachedGameList: SteamGame[] | null = null;
  private cacheFilePath: string;

  constructor(private steamService: SteamService) {
    const tempDir = path.join(os.tmpdir(), "OpenSteamData");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    this.cacheFilePath = path.join(tempDir, "games.json");
  }

  public async getInstalledGames(): Promise<SteamGame[]> {
    const steamPath = await this.steamService.getSteamPath();
    if (!fs.existsSync(steamPath)) {
      return [];
    }

    const libraryPaths: Set<string> = new Set([steamPath]);

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
      } catch (err) {
        console.warn("Error reading libraryfolders.vdf:", err);
      }
    }

    const installedGames: Map<string, SteamGame> = new Map();

    for (const libPath of libraryPaths) {
      const steamAppsPath = path.join(libPath, "steamapps");
      if (!fs.existsSync(steamAppsPath)) continue;

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
                if (appid === "228980" || appid === "250820") continue; // redistributables

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
            } catch {}
          }
        }
      } catch {}
    }

    return Array.from(installedGames.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  public async syncCatalog(): Promise<{ success: boolean; totalGames: number }> {
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
    } catch (err: any) {
      console.error("Failed to sync catalog:", err);
      return { success: false, totalGames: 0 };
    }
  }

  private async loadCatalog(): Promise<SteamGame[]> {
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
          if (this.cachedGameList) return this.cachedGameList;
        }
      } catch {}
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
        if (this.cachedGameList) return this.cachedGameList;
      } catch {}
    }

    return [];
  }

  public async searchCatalog(query: string, limit: number = 50): Promise<SteamGame[]> {
    const list = await this.loadCatalog();
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return list.slice(0, limit);
    }

    const isNumeric = /^\d+$/.test(cleanQuery);

    if (isNumeric) {
      const match = list.filter((g) => g.appid === cleanQuery);
      if (match.length > 0) return match;
    }

    return list
      .filter((g) => g.name && g.name.toLowerCase().includes(cleanQuery))
      .slice(0, limit);
  }
}
