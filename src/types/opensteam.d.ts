export interface SteamGame {
  appid: string;
  name: string;
  installed?: boolean;
  installPath?: string;
}

export interface SteamPathInfo {
  path: string;
  isDefault: boolean;
  exists: boolean;
  isPatched: boolean;
  patchMode?: number;
  injectedFiles: string[];
  luaPath: string;
  depotCachePath: string;
}

export interface SteamProofDepot {
  depotId: number | string;
  maxSize?: number | string;
  manifests?: {
    public?: {
      manifestId: string;
    };
    [branch: string]: any;
  };
}

export interface SteamProofApp {
  appId: number | string;
  depots: SteamProofDepot[];
}

export interface ManifestDownloadItem {
  depotId: string;
  manifestId: string;
  url: string;
}

export interface FixManifestsResult {
  totalManifestsDownloaded: number;
  luaFilesUpdated: number;
  scannedCount: number;
  missingDepots: number;
}

export interface ProcessStatus {
  steamRunning: boolean;
  helperRunning: boolean;
}

export interface OpenSteamAPI {
  // 1-Click Fast Install
  oneClickInstall: (appId: string | number, gameName?: string) => Promise<{ success: boolean; appId: string; gameName: string; message: string }>;

  // Steam management
  getSteamPathInfo: () => Promise<SteamPathInfo>;
  setCustomSteamPath: (customPath: string) => Promise<SteamPathInfo>;
  getProcessStatus: () => Promise<ProcessStatus>;
  killSteamProcesses: () => Promise<boolean>;
  restartSteam: (noBrowser?: boolean) => Promise<boolean>;
  startSteam: () => Promise<boolean>;
  launchSteamInstall: (appId: string | number) => Promise<boolean>;
  launchSteamRun: (appId: string | number) => Promise<boolean>;

  // Patching
  patchSteam: (mode: number) => Promise<{ success: boolean; message: string }>;
  unpatchSteam: () => Promise<{ success: boolean; message: string }>;

  // Games & Catalog
  getInstalledGames: () => Promise<SteamGame[]>;
  searchCatalog: (query: string, limit?: number) => Promise<SteamGame[]>;
  syncCatalog: () => Promise<{ success: boolean; totalGames: number }>;

  // Lua & Manifests
  generateAndInstallLua: (appId: string | number) => Promise<{ success: boolean; luaPath: string; manifestsCount: number; message: string }>;
  fixAllManifests: () => Promise<FixManifestsResult>;
  importManualLua: (filePath?: string) => Promise<{ success: boolean; importedFile: string; message: string }>;
  listInstalledLuas: () => Promise<string[]>;
  getInstalledLuasWithNames: () => Promise<Array<{ appId: string; name: string }>>;
  removeLua: (appId: string) => Promise<boolean>;

  // Plugins
  installMillennium: () => Promise<{ success: boolean; message: string }>;
  installLuaManager: () => Promise<{ success: boolean; message: string }>;

  // Online Fix
  downloadOnlineFix: (gameName: string, targetPath: string, password?: string) => Promise<{ success: boolean; message: string }>;

  // System
  selectDirectory: () => Promise<string | null>;
  selectFile: (extensions?: string[]) => Promise<string | null>;

  // Events
  onLog: (callback: (data: { level: "info" | "success" | "warn" | "error"; message: string }) => void) => void;
}

declare global {
  type OpenSteamGame = SteamGame;
  type OpenSteamPathInfo = SteamPathInfo;
  type OpenSteamProcessStatus = ProcessStatus;
  type OpenSteamFixManifestsResult = FixManifestsResult;

  interface Window {
    openSteamAPI: OpenSteamAPI;
  }
}
