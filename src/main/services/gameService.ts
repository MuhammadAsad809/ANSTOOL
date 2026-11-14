import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { SteamGame } from "../../types/opensteam";
import { SteamService } from "./steamService";

// Curated Top 24 Trending & Modern Games for Instant Zero-Lag Home Display
const DEFAULT_POPULAR_GAMES: SteamGame[] = [
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

export class GameService {
  private cacheFilePath: string;

  constructor(private steamService: SteamService) {
    const tempDir = path.join(os.tmpdir(), "OpenSteamData");
    if (!fs.existsSync(tempDir)) {
      try {
        fs.mkdirSync(tempDir, { recursive: true });
      } catch {}
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
    return { success: true, totalGames: DEFAULT_POPULAR_GAMES.length };
  }

  public async searchCatalog(query: string, limit: number = 30): Promise<SteamGame[]> {
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
          const json: any = await res.json();
          if (json[cleanQuery]?.success && json[cleanQuery]?.data?.name) {
            return [{
              appid: cleanQuery,
              name: json[cleanQuery].data.name,
              installed: false
            }];
          }
        }
      } catch {}

      // Fallback if network failed for numeric AppID
      const localMatch = DEFAULT_POPULAR_GAMES.find((g) => g.appid === cleanQuery);
      if (localMatch) return [localMatch];
      return [{ appid: cleanQuery, name: `Steam Game ${cleanQuery}`, installed: false }];
    }

    // 3. Search Official Steam Store Search API directly
    // This returns the newest, official, live games on Steam!
    const results: SteamGame[] = [];
    const seenAppIds = new Set<string>();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanQuery)}&l=english&cc=US`,
        {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0" }
        }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const json: any = await res.json();
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
    } catch {}

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
