import { contextBridge, ipcRenderer } from "electron";
import { OpenSteamAPI, SteamPathInfo, ProcessStatus, SteamGame, FixManifestsResult } from "../types/opensteam";

const openSteamAPI: OpenSteamAPI = {
  // Steam management
  getSteamPathInfo: (): Promise<SteamPathInfo> => {
    return ipcRenderer.invoke("steam:get-path-info");
  },
  setCustomSteamPath: (customPath: string): Promise<SteamPathInfo> => {
    return ipcRenderer.invoke("steam:set-custom-path", customPath);
  },
  getProcessStatus: (): Promise<ProcessStatus> => {
    return ipcRenderer.invoke("steam:get-process-status");
  },
  killSteamProcesses: (): Promise<boolean> => {
    return ipcRenderer.invoke("steam:kill-processes");
  },
  restartSteam: (noBrowser: boolean = false): Promise<boolean> => {
    return ipcRenderer.invoke("steam:restart", noBrowser);
  },
  launchSteamInstall: (appId: string | number): Promise<boolean> => {
    return ipcRenderer.invoke("steam:install-game", appId);
  },
  launchSteamRun: (appId: string | number): Promise<boolean> => {
    return ipcRenderer.invoke("steam:run-game", appId);
  },

  // Patching
  patchSteam: (mode: number): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke("steam:patch", mode);
  },
  unpatchSteam: (): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke("steam:unpatch");
  },

  // Games & Catalog
  getInstalledGames: (): Promise<SteamGame[]> => {
    return ipcRenderer.invoke("games:get-installed");
  },
  searchCatalog: (query: string, limit: number = 50): Promise<SteamGame[]> => {
    return ipcRenderer.invoke("games:search-catalog", query, limit);
  },
  syncCatalog: (): Promise<{ success: boolean; totalGames: number }> => {
    return ipcRenderer.invoke("games:sync-catalog");
  },

  // Lua & Manifests
  generateAndInstallLua: (appId: string | number): Promise<{ success: boolean; luaPath: string; manifestsCount: number; message: string }> => {
    return ipcRenderer.invoke("lua:generate-install", appId);
  },
  fixAllManifests: (): Promise<FixManifestsResult> => {
    return ipcRenderer.invoke("lua:fix-all-manifests");
  },
  importManualLua: (filePath?: string): Promise<{ success: boolean; importedFile: string; message: string }> => {
    return ipcRenderer.invoke("lua:import-manual", filePath);
  },
  listInstalledLuas: (): Promise<string[]> => {
    return ipcRenderer.invoke("lua:list-installed");
  },
  removeLua: (appId: string): Promise<boolean> => {
    return ipcRenderer.invoke("lua:remove", appId);
  },

  // Plugins
  installMillennium: (): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke("plugins:install-millennium");
  },
  installLuaManager: (): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke("plugins:install-luamanager");
  },

  // Online Fix
  downloadOnlineFix: (gameName: string, targetPath: string, password?: string): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke("onlinefix:download", gameName, targetPath, password);
  },

  // System Dialogs
  selectDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke("dialog:select-directory");
  },
  selectFile: (extensions?: string[]): Promise<string | null> => {
    return ipcRenderer.invoke("dialog:select-file", extensions);
  },

  // Events
  onLog: (callback: (data: { level: "info" | "success" | "warn" | "error"; message: string }) => void): void => {
    ipcRenderer.on("app:log", (_event, data) => {
      callback(data);
    });
  }
};

contextBridge.exposeInMainWorld("openSteamAPI", openSteamAPI);
