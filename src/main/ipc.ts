import { ipcMain, dialog, BrowserWindow, shell } from "electron";
import { SteamService } from "./services/steamService";
import { GameService } from "./services/gameService";
import { LuaService } from "./services/luaService";
import { PluginService } from "./services/pluginService";
import { OnlineFixService } from "./services/onlineFixService";

export function registerAllIpcHandlers(
  steamService: SteamService,
  gameService: GameService,
  luaService: LuaService,
  pluginService: PluginService,
  onlineFixService: OnlineFixService
): void {
  function broadcastLog(window: BrowserWindow | null, level: "info" | "success" | "warn" | "error", message: string) {
    if (window && !window.isDestroyed()) {
      window.webContents.send("app:log", { level, message });
    }
  }

  // 1-Click Fast Game Unlock & Install
  ipcMain.handle("steam:one-click-install", async (event, appId: string | number, gameName?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const cleanAppId = String(appId).trim();

    broadcastLog(win, "info", `[1-CLICK] Initializing 1-Click Install for ${gameName || cleanAppId}...`);

    // 1. Ensure Steam is found and patched
    const pathInfo = await steamService.getSteamPathInfo();
    if (!pathInfo.exists) {
      throw new Error(`Steam folder not found at ${pathInfo.path}. Please verify your Steam path.`);
    }

    if (!pathInfo.isPatched) {
      broadcastLog(win, "info", `[1-CLICK] Steam hook not active. Automatically deploying proxy hooks...`);
      try {
        await steamService.patchSteam(1);
        broadcastLog(win, "success", `[1-CLICK] Steam proxy hook deployed.`);
      } catch (err: any) {
        broadcastLog(win, "warn", `[1-CLICK] Hook notice: ${err.message}`);
      }
    }

    // 2. Generate and install Lua unlock + depot manifests
    broadcastLog(win, "info", `[1-CLICK] Unlocking game and binding manifests for AppID ${cleanAppId}...`);
    const luaRes = await luaService.generateAndInstallLua(cleanAppId);
    broadcastLog(win, "success", luaRes.message);

    // 3. Restart Steam if it is currently running so it loads the new configuration
    const proc = await steamService.getProcessStatus();
    if (proc.steamRunning) {
      broadcastLog(win, "info", `[1-CLICK] Relaunching Steam to apply changes...`);
      await steamService.restartSteam();
      await new Promise((r) => setTimeout(r, 2000));
    }

    // 4. Trigger Steam native download/install
    broadcastLog(win, "info", `[1-CLICK] Dispatched steam://install/${cleanAppId}`);
    try {
      await shell.openExternal(`steam://install/${cleanAppId}`);
    } catch {}

    broadcastLog(win, "success", `[1-CLICK] Done! "${gameName || cleanAppId}" added to Steam.`);
    return {
      success: true,
      appId: cleanAppId,
      gameName: gameName || cleanAppId,
      message: `"${gameName || cleanAppId}" added to your Steam library! Installation launched in Steam.`
    };
  });

  // Steam Management
  ipcMain.handle("steam:get-path-info", async () => {
    return await steamService.getSteamPathInfo();
  });

  ipcMain.handle("steam:set-custom-path", async (_event, customPath: string) => {
    steamService.setCustomSteamPath(customPath);
    return await steamService.getSteamPathInfo();
  });

  ipcMain.handle("steam:get-process-status", async () => {
    return await steamService.getProcessStatus();
  });

  ipcMain.handle("steam:kill-processes", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", "Terminating Steam and webhelper processes...");
    const res = await steamService.killSteamProcesses();
    broadcastLog(win, res ? "success" : "warn", res ? "Steam processes terminated." : "No active processes found.");
    return res;
  });

  ipcMain.handle("steam:restart", async (event, noBrowser: boolean = false) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", `Restarting Steam (noBrowser=${noBrowser})...`);
    const res = await steamService.restartSteam(noBrowser);
    broadcastLog(win, res ? "success" : "error", res ? "Steam relaunch command dispatched." : "Failed to restart Steam.");
    return res;
  });

  ipcMain.handle("steam:install-game", async (event, appId: string | number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", `Triggering Steam native installer for AppID ${appId}...`);
    try {
      await shell.openExternal(`steam://install/${appId}`);
      broadcastLog(win, "success", `Dispatched steam://install/${appId} to Steam client.`);
      return true;
    } catch (err: any) {
      broadcastLog(win, "error", `Failed to dispatch steam://install/${appId}: ${err.message}`);
      return false;
    }
  });

  ipcMain.handle("steam:run-game", async (event, appId: string | number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", `Triggering Steam run for AppID ${appId}...`);
    try {
      await shell.openExternal(`steam://run/${appId}`);
      broadcastLog(win, "success", `Dispatched steam://run/${appId} to Steam client.`);
      return true;
    } catch (err: any) {
      broadcastLog(win, "error", `Failed to dispatch steam://run/${appId}: ${err.message}`);
      return false;
    }
  });

  // Patching
  ipcMain.handle("steam:patch", async (event, mode: number = 1) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", `Applying Steam hook (Mode ${mode})...`);
    try {
      const res = await steamService.patchSteam(mode);
      broadcastLog(win, "success", res.message);
      return res;
    } catch (err: any) {
      broadcastLog(win, "error", `Patch failed: ${err.message}`);
      throw err;
    }
  });

  ipcMain.handle("steam:unpatch", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", "Removing injected Steam hooks and proxy DLLs...");
    try {
      const res = await steamService.unpatchSteam();
      broadcastLog(win, "success", res.message);
      return res;
    } catch (err: any) {
      broadcastLog(win, "error", `Unpatch failed: ${err.message}`);
      throw err;
    }
  });

  // Games & Catalog
  ipcMain.handle("games:get-installed", async () => {
    return await gameService.getInstalledGames();
  });

  ipcMain.handle("games:search-catalog", async (_event, query: string, limit: number = 50) => {
    return await gameService.searchCatalog(query, limit);
  });

  ipcMain.handle("games:sync-catalog", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", "Synchronizing online game catalog cache...");
    const res = await gameService.syncCatalog();
    broadcastLog(win, res.success ? "success" : "error", `Catalog synced: ${res.totalGames} titles indexed.`);
    return res;
  });

  // Lua & Manifests
  ipcMain.handle("lua:generate-install", async (event, appId: string | number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", `Generating unlock Lua and syncing manifests for AppID ${appId}...`);
    try {
      const res = await luaService.generateAndInstallLua(appId);
      broadcastLog(win, "success", res.message);
      return res;
    } catch (err: any) {
      broadcastLog(win, "error", `Lua generation error: ${err.message}`);
      throw err;
    }
  });

  ipcMain.handle("lua:fix-all-manifests", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", "Scanning local Lua scripts and validating depot cache manifests...");
    try {
      const res = await luaService.fixAllManifests();
      broadcastLog(
        win,
        "success",
        `Fix complete: ${res.totalManifestsDownloaded} manifest(s) downloaded, ${res.luaFilesUpdated} Lua file(s) updated across ${res.scannedCount} scripts.`
      );
      return res;
    } catch (err: any) {
      broadcastLog(win, "error", `Manifest fixer failed: ${err.message}`);
      throw err;
    }
  });

  ipcMain.handle("lua:import-manual", async (event, filePath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", `Importing manual Lua file: ${filePath}...`);
    try {
      const res = await luaService.importManualLua(filePath);
      broadcastLog(win, "success", res.message);
      return res;
    } catch (err: any) {
      broadcastLog(win, "error", `Manual Lua import failed: ${err.message}`);
      throw err;
    }
  });

  ipcMain.handle("lua:list-installed", async () => {
    return await luaService.listInstalledLuas();
  });

  ipcMain.handle("lua:remove", async (event, appId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const res = await luaService.removeLua(appId);
    broadcastLog(win, res ? "success" : "warn", res ? `Removed Lua configuration for AppID ${appId}` : `Lua not found for ${appId}`);
    return res;
  });

  // Plugins
  ipcMain.handle("plugins:install-millennium", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", "Downloading Millennium plugin loader installer...");
    const res = await pluginService.installMillennium();
    broadcastLog(win, res.success ? "success" : "error", res.message);
    return res;
  });

  ipcMain.handle("plugins:install-luamanager", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", "Downloading and deploying LuaManager plugin to Steam/plugins...");
    const res = await pluginService.installLuaManager();
    broadcastLog(win, res.success ? "success" : "error", res.message);
    return res;
  });

  // Online Fix
  ipcMain.handle("onlinefix:download", async (event, gameName: string, targetPath: string, password?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    broadcastLog(win, "info", `Querying Online-Fix repository for "${gameName}"...`);
    try {
      const res = await onlineFixService.downloadOnlineFix(gameName, targetPath, password);
      broadcastLog(win, res.success ? "success" : "error", res.message);
      return res;
    } catch (err: any) {
      broadcastLog(win, "error", `Online-Fix error: ${err.message}`);
      throw err;
    }
  });

  // System Dialogs
  ipcMain.handle("dialog:select-directory", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const res = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"]
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  ipcMain.handle("dialog:select-file", async (event, extensions?: string[]) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const filters = extensions && extensions.length > 0
      ? [{ name: "Supported Files", extensions }]
      : [{ name: "All Files", extensions: ["*"] }];

    const res = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });
}
