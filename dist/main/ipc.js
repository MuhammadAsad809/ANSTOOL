"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllIpcHandlers = registerAllIpcHandlers;
const electron_1 = require("electron");
function registerAllIpcHandlers(steamService, gameService, luaService, pluginService, onlineFixService) {
    function broadcastLog(window, level, message) {
        if (window && !window.isDestroyed()) {
            window.webContents.send("app:log", { level, message });
        }
    }
    // Steam Management
    electron_1.ipcMain.handle("steam:get-path-info", async () => {
        return await steamService.getSteamPathInfo();
    });
    electron_1.ipcMain.handle("steam:set-custom-path", async (_event, customPath) => {
        steamService.setCustomSteamPath(customPath);
        return await steamService.getSteamPathInfo();
    });
    electron_1.ipcMain.handle("steam:get-process-status", async () => {
        return await steamService.getProcessStatus();
    });
    electron_1.ipcMain.handle("steam:kill-processes", async (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", "Terminating Steam and webhelper processes...");
        const res = await steamService.killSteamProcesses();
        broadcastLog(win, res ? "success" : "warn", res ? "Steam processes terminated." : "No active processes found.");
        return res;
    });
    electron_1.ipcMain.handle("steam:restart", async (event, noBrowser = false) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", `Restarting Steam (noBrowser=${noBrowser})...`);
        const res = await steamService.restartSteam(noBrowser);
        broadcastLog(win, res ? "success" : "error", res ? "Steam relaunch command dispatched." : "Failed to restart Steam.");
        return res;
    });
    electron_1.ipcMain.handle("steam:install-game", async (event, appId) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", `Triggering Steam native installer for AppID ${appId}...`);
        try {
            await electron_1.shell.openExternal(`steam://install/${appId}`);
            broadcastLog(win, "success", `Dispatched steam://install/${appId} to Steam client.`);
            return true;
        }
        catch (err) {
            broadcastLog(win, "error", `Failed to dispatch steam://install/${appId}: ${err.message}`);
            return false;
        }
    });
    electron_1.ipcMain.handle("steam:run-game", async (event, appId) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", `Triggering Steam run for AppID ${appId}...`);
        try {
            await electron_1.shell.openExternal(`steam://run/${appId}`);
            broadcastLog(win, "success", `Dispatched steam://run/${appId} to Steam client.`);
            return true;
        }
        catch (err) {
            broadcastLog(win, "error", `Failed to dispatch steam://run/${appId}: ${err.message}`);
            return false;
        }
    });
    // Patching
    electron_1.ipcMain.handle("steam:patch", async (event, mode = 1) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", `Applying Steam hook (Mode ${mode})...`);
        try {
            const res = await steamService.patchSteam(mode);
            broadcastLog(win, "success", res.message);
            return res;
        }
        catch (err) {
            broadcastLog(win, "error", `Patch failed: ${err.message}`);
            throw err;
        }
    });
    electron_1.ipcMain.handle("steam:unpatch", async (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", "Removing injected Steam hooks and proxy DLLs...");
        try {
            const res = await steamService.unpatchSteam();
            broadcastLog(win, "success", res.message);
            return res;
        }
        catch (err) {
            broadcastLog(win, "error", `Unpatch failed: ${err.message}`);
            throw err;
        }
    });
    // Games & Catalog
    electron_1.ipcMain.handle("games:get-installed", async () => {
        return await gameService.getInstalledGames();
    });
    electron_1.ipcMain.handle("games:search-catalog", async (_event, query, limit = 50) => {
        return await gameService.searchCatalog(query, limit);
    });
    electron_1.ipcMain.handle("games:sync-catalog", async (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", "Synchronizing online game catalog cache...");
        const res = await gameService.syncCatalog();
        broadcastLog(win, res.success ? "success" : "error", `Catalog synced: ${res.totalGames} titles indexed.`);
        return res;
    });
    // Lua & Manifests
    electron_1.ipcMain.handle("lua:generate-install", async (event, appId) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", `Generating unlock Lua and syncing manifests for AppID ${appId}...`);
        try {
            const res = await luaService.generateAndInstallLua(appId);
            broadcastLog(win, "success", res.message);
            return res;
        }
        catch (err) {
            broadcastLog(win, "error", `Lua generation error: ${err.message}`);
            throw err;
        }
    });
    electron_1.ipcMain.handle("lua:fix-all-manifests", async (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", "Scanning local Lua scripts and validating depot cache manifests...");
        try {
            const res = await luaService.fixAllManifests();
            broadcastLog(win, "success", `Fix complete: ${res.totalManifestsDownloaded} manifest(s) downloaded, ${res.luaFilesUpdated} Lua file(s) updated across ${res.scannedCount} scripts.`);
            return res;
        }
        catch (err) {
            broadcastLog(win, "error", `Manifest fixer failed: ${err.message}`);
            throw err;
        }
    });
    electron_1.ipcMain.handle("lua:import-manual", async (event, filePath) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", `Importing manual Lua file: ${filePath}...`);
        try {
            const res = await luaService.importManualLua(filePath);
            broadcastLog(win, "success", res.message);
            return res;
        }
        catch (err) {
            broadcastLog(win, "error", `Manual Lua import failed: ${err.message}`);
            throw err;
        }
    });
    electron_1.ipcMain.handle("lua:list-installed", async () => {
        return await luaService.listInstalledLuas();
    });
    electron_1.ipcMain.handle("lua:remove", async (event, appId) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        const res = await luaService.removeLua(appId);
        broadcastLog(win, res ? "success" : "warn", res ? `Removed Lua configuration for AppID ${appId}` : `Lua not found for ${appId}`);
        return res;
    });
    // Plugins
    electron_1.ipcMain.handle("plugins:install-millennium", async (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", "Downloading Millennium plugin loader installer...");
        const res = await pluginService.installMillennium();
        broadcastLog(win, res.success ? "success" : "error", res.message);
        return res;
    });
    electron_1.ipcMain.handle("plugins:install-luamanager", async (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", "Downloading and deploying LuaManager plugin to Steam/plugins...");
        const res = await pluginService.installLuaManager();
        broadcastLog(win, res.success ? "success" : "error", res.message);
        return res;
    });
    // Online Fix
    electron_1.ipcMain.handle("onlinefix:download", async (event, gameName, targetPath, password) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        broadcastLog(win, "info", `Querying Online-Fix repository for "${gameName}"...`);
        try {
            const res = await onlineFixService.downloadOnlineFix(gameName, targetPath, password);
            broadcastLog(win, res.success ? "success" : "error", res.message);
            return res;
        }
        catch (err) {
            broadcastLog(win, "error", `Online-Fix error: ${err.message}`);
            throw err;
        }
    });
    // System Dialogs
    electron_1.ipcMain.handle("dialog:select-directory", async (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (!win)
            return null;
        const res = await electron_1.dialog.showOpenDialog(win, {
            properties: ["openDirectory"]
        });
        return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
    });
    electron_1.ipcMain.handle("dialog:select-file", async (event, extensions) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (!win)
            return null;
        const filters = extensions && extensions.length > 0
            ? [{ name: "Supported Files", extensions }]
            : [{ name: "All Files", extensions: ["*"] }];
        const res = await electron_1.dialog.showOpenDialog(win, {
            properties: ["openFile"],
            filters
        });
        return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
    });
}
