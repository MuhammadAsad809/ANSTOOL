"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const openSteamAPI = {
    // Steam management
    getSteamPathInfo: () => {
        return electron_1.ipcRenderer.invoke("steam:get-path-info");
    },
    setCustomSteamPath: (customPath) => {
        return electron_1.ipcRenderer.invoke("steam:set-custom-path", customPath);
    },
    getProcessStatus: () => {
        return electron_1.ipcRenderer.invoke("steam:get-process-status");
    },
    killSteamProcesses: () => {
        return electron_1.ipcRenderer.invoke("steam:kill-processes");
    },
    restartSteam: (noBrowser = false) => {
        return electron_1.ipcRenderer.invoke("steam:restart", noBrowser);
    },
    // Patching
    patchSteam: (mode) => {
        return electron_1.ipcRenderer.invoke("steam:patch", mode);
    },
    unpatchSteam: () => {
        return electron_1.ipcRenderer.invoke("steam:unpatch");
    },
    // Games & Catalog
    getInstalledGames: () => {
        return electron_1.ipcRenderer.invoke("games:get-installed");
    },
    searchCatalog: (query, limit = 50) => {
        return electron_1.ipcRenderer.invoke("games:search-catalog", query, limit);
    },
    syncCatalog: () => {
        return electron_1.ipcRenderer.invoke("games:sync-catalog");
    },
    // Lua & Manifests
    generateAndInstallLua: (appId) => {
        return electron_1.ipcRenderer.invoke("lua:generate-install", appId);
    },
    fixAllManifests: () => {
        return electron_1.ipcRenderer.invoke("lua:fix-all-manifests");
    },
    importManualLua: (filePath) => {
        return electron_1.ipcRenderer.invoke("lua:import-manual", filePath);
    },
    listInstalledLuas: () => {
        return electron_1.ipcRenderer.invoke("lua:list-installed");
    },
    removeLua: (appId) => {
        return electron_1.ipcRenderer.invoke("lua:remove", appId);
    },
    // Plugins
    installMillennium: () => {
        return electron_1.ipcRenderer.invoke("plugins:install-millennium");
    },
    installLuaManager: () => {
        return electron_1.ipcRenderer.invoke("plugins:install-luamanager");
    },
    // Online Fix
    downloadOnlineFix: (gameName, targetPath, password) => {
        return electron_1.ipcRenderer.invoke("onlinefix:download", gameName, targetPath, password);
    },
    // System Dialogs
    selectDirectory: () => {
        return electron_1.ipcRenderer.invoke("dialog:select-directory");
    },
    selectFile: (extensions) => {
        return electron_1.ipcRenderer.invoke("dialog:select-file", extensions);
    },
    // Events
    onLog: (callback) => {
        electron_1.ipcRenderer.on("app:log", (_event, data) => {
            callback(data);
        });
    }
};
electron_1.contextBridge.exposeInMainWorld("openSteamAPI", openSteamAPI);
